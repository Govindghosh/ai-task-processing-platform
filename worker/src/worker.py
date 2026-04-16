"""
AI Task Worker
Consumes raw JSON jobs from Redis queue (BRPOP).
Processes text operations and updates MongoDB directly.
Implements retry with exponential backoff and dead-letter queue.
"""

import os
import sys
import json
import signal
import time
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
import redis
from pymongo import MongoClient, ReturnDocument
from bson import ObjectId

from processors import process_task

# Load environment variables
load_dotenv()

# ---------------------
# Structured JSON Logging
# ---------------------
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JSONFormatter())

logger = logging.getLogger("task-worker")
logger.setLevel(logging.INFO)
logger.addHandler(handler)
logger.propagate = False

# ---------------------
# Configuration
# ---------------------
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/ai-tasks")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "ai-tasks")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
QUEUE_NAME = "tasks:queue"
DLQ_NAME = "tasks:dlq"
WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "5"))

# Retry backoff delays in seconds
RETRY_DELAYS = [1, 5, 15]

# ---------------------
# MongoDB Connection
# ---------------------
mongo_client = MongoClient(
    MONGODB_URI,
    maxPoolSize=10,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
)
db = mongo_client.get_database(MONGODB_DB_NAME)
tasks_collection = db["tasks"]
logger.info(f"Connected to MongoDB: {MONGODB_URI} (DB: {MONGODB_DB_NAME})")

# ---------------------
# Redis Connection
# ---------------------
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
    retry_on_timeout=True,
)
logger.info(f"Connected to Redis: {REDIS_HOST}:{REDIS_PORT}")

# ---------------------
# Graceful Shutdown
# ---------------------
shutdown_flag = False

def handle_signal(sig, frame):
    global shutdown_flag
    logger.info(f"Received signal {sig}. Shutting down gracefully...")
    shutdown_flag = True

signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def add_log_entry(task_id, message, level="info"):
    """Append a structured log entry to the task's logs array in MongoDB."""
    try:
        tasks_collection.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$push": {
                    "logs": {
                        "timestamp": datetime.now(timezone.utc),
                        "message": message,
                        "level": level,
                    }
                }
            },
        )
    except Exception as e:
        logger.error(f"Failed to add log entry for task {task_id}: {e}")


def atomic_claim_task(task_id):
    """
    Atomically claim a task using findOneAndUpdate.
    Prevents race conditions when multiple workers pick the same job.
    Only claims if status is 'pending'.
    Returns the updated task document, or None if already claimed.
    """
    result = tasks_collection.find_one_and_update(
        {
            "_id": ObjectId(task_id),
            "status": {"$in": ["pending"]},  # Only claim pending tasks
        },
        {
            "$set": {
                "status": "running",
                "startedAt": datetime.now(timezone.utc),
            },
            "$push": {
                "logs": {
                    "timestamp": datetime.now(timezone.utc),
                    "message": "Worker claimed task. Processing started.",
                    "level": "info",
                }
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    return result


def process_job(raw_job):
    """
    Process a single job from the queue.
    Implements idempotency, atomic claims, and retry logic.
    """
    try:
        job_data = json.loads(raw_job)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in queue: {e}")
        return

    task_id = job_data.get("taskId")
    input_text = job_data.get("input", "")
    operation = job_data.get("operation", "")
    attempt = job_data.get("attempt", 1)
    max_attempts = job_data.get("maxAttempts", 3)

    if not task_id:
        logger.error("Job missing taskId, discarding")
        return

    logger.info(f"Processing job | Task: {task_id} | Operation: {operation} | Attempt: {attempt}/{max_attempts}")

    # ---------------------
    # Idempotency Check
    # If task is already 'success', skip it
    # ---------------------
    existing = tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not existing:
        logger.warning(f"Task {task_id} not found in database, discarding")
        return

    if existing.get("status") == "success":
        logger.info(f"Task {task_id} already completed successfully, skipping (idempotent)")
        return

    # ---------------------
    # Atomic Claim (prevents race conditions)
    # ---------------------
    claimed = atomic_claim_task(task_id)
    if not claimed:
        logger.warning(f"Task {task_id} could not be claimed (status: {existing.get('status')}), skipping")
        return

    try:
        # Process the task
        result = process_task(operation, input_text)

        # Update to success
        tasks_collection.update_one(
            {"_id": ObjectId(task_id)},
            {
                "$set": {
                    "status": "success",
                    "result": result,
                    "completedAt": datetime.now(timezone.utc),
                },
            },
        )
        add_log_entry(
            task_id,
            f"Task completed successfully. Result length: {len(result)} characters",
            "info",
        )
        logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        error_message = str(e)
        logger.error(f"Task {task_id} failed on attempt {attempt}: {error_message}")

        if attempt < max_attempts:
            # ---------------------
            # Retry with exponential backoff
            # ---------------------
            delay_index = min(attempt - 1, len(RETRY_DELAYS) - 1)
            delay = RETRY_DELAYS[delay_index]

            logger.info(f"Scheduling retry {attempt + 1}/{max_attempts} for task {task_id} in {delay}s")

            # Reset status to pending for retry
            tasks_collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$set": {"status": "pending"},
                    "$inc": {"retryCount": 1},
                },
            )
            add_log_entry(task_id, f"Attempt {attempt} failed: {error_message}. Retrying in {delay}s...", "warn")

            time.sleep(delay)

            # Re-enqueue with incremented attempt
            retry_job = json.dumps({
                **job_data,
                "attempt": attempt + 1,
            })
            redis_client.lpush(QUEUE_NAME, retry_job)

        else:
            # ---------------------
            # Max retries exhausted → Dead-Letter Queue
            # ---------------------
            logger.error(f"Task {task_id} exhausted all {max_attempts} attempts. Moving to DLQ.")

            tasks_collection.update_one(
                {"_id": ObjectId(task_id)},
                {
                    "$set": {
                        "status": "failed",
                        "completedAt": datetime.now(timezone.utc),
                    },
                },
            )
            add_log_entry(
                task_id,
                f"Task failed after {max_attempts} attempts: {error_message}. Moved to dead-letter queue.",
                "error",
            )

            # Push to DLQ for investigation
            dlq_entry = json.dumps({
                **job_data,
                "failedAt": datetime.now(timezone.utc).isoformat(),
                "error": error_message,
            })
            redis_client.lpush(DLQ_NAME, dlq_entry)


def main():
    """Main loop — continuously BRPOP from Redis queue."""
    logger.info("Starting AI Task Worker...")
    logger.info(f"Queue: {QUEUE_NAME} | DLQ: {DLQ_NAME}")
    logger.info(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
    logger.info("Waiting for jobs...")

    while not shutdown_flag:
        try:
            # BRPOP blocks until a job is available (timeout 1s for shutdown check)
            result = redis_client.brpop(QUEUE_NAME, timeout=1)

            if result is None:
                continue  # Timeout, check shutdown flag

            queue_name, raw_job = result
            process_job(raw_job)

        except redis.ConnectionError as e:
            logger.error(f"Redis connection error: {e}. Retrying in 5s...")
            time.sleep(5)

        except redis.TimeoutError as e:
            logger.error(f"Redis timeout: {e}. Retrying in 2s...")
            time.sleep(2)

        except Exception as e:
            logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
            time.sleep(1)

    # Cleanup
    logger.info("Closing connections...")
    redis_client.close()
    mongo_client.close()
    logger.info("Worker shut down cleanly.")


if __name__ == "__main__":
    main()

import Redis from 'ioredis';
import redisConfig from '../config/redis.js';

const QUEUE_NAME = 'tasks:queue';
const DLQ_NAME = 'tasks:dlq';

// Create Redis client for queue operations
const redisClient = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.log(`Redis retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
  enableReadyCheck: true,
});

redisClient.on('connect', () => {
  console.log('✅ Queue Redis client connected');
});

redisClient.on('error', (error) => {
  console.error('❌ Queue Redis client error:', error.message);
});

/**
 * Add a task job to the Redis queue.
 * Uses LPUSH for FIFO processing (worker uses BRPOP).
 *
 * @param {string} taskId - MongoDB task document ID
 * @param {string} input - Input text to process
 * @param {string} operation - Operation to perform
 * @returns {Promise<void>}
 */
export const addTaskJob = async (taskId, input, operation) => {
  const job = JSON.stringify({
    taskId,
    input,
    operation,
    attempt: 1,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
  });

  await redisClient.lpush(QUEUE_NAME, job);
  console.log(`📤 Job pushed to queue for task ${taskId}`);
};

/**
 * Get current queue length (for monitoring/observability).
 * @returns {Promise<number>}
 */
export const getQueueLength = async () => {
  return redisClient.llen(QUEUE_NAME);
};

/**
 * Get dead-letter queue length.
 * @returns {Promise<number>}
 */
export const getDLQLength = async () => {
  return redisClient.llen(DLQ_NAME);
};

export { redisClient, QUEUE_NAME, DLQ_NAME };

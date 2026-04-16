# ---------- Stage 1: Install dependencies ----------
FROM python:3.12-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- Stage 2: Production image ----------
FROM python:3.12-slim

# Security: non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Remove dev files
RUN rm -rf .env .env.* __pycache__ *.pyc

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import redis; r=redis.Redis(host='${REDIS_HOST:-redis}', port=int('${REDIS_PORT:-6379}')); r.ping()" || exit 1

CMD ["python", "src/worker.py"]

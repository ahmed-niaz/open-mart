#!/usr/bin/env bash
# ==============================================================================
# Open-Mart: Automated PostgreSQL Database Backup Script
# Usage: ./scripts/backup-database.sh
# Cron example (Daily at 2:00 AM): 0 2 * * * /path/to/scripts/backup-database.sh
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/open_mart_${TIMESTAMP}.sql.gz"

# Database connection credentials from environment or defaults
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-6432}"
DB_USER="${POSTGRES_USER:-openmart}"
DB_NAME="${POSTGRES_DB:-open-mart}"
export PGPASSWORD="${POSTGRES_PASSWORD:-pgmart}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting PostgreSQL backup for database: '${DB_NAME}'..."

# Dump and compress atomically
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"
elif docker ps --format '{{.Names}}' | grep -q "openmart-postgres"; then
  echo "[INFO] Using docker exec to dump from container 'openmart-postgres'..."
  docker exec openmart-postgres pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"
else
  echo "[ERROR] Neither 'pg_dump' nor Docker container 'openmart-postgres' was found." >&2
  exit 1
fi

FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup completed successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Prune old backups older than RETENTION_DAYS
echo "[$(date -Iseconds)] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "open_mart_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete || true

echo "[$(date -Iseconds)] Backup process finished cleanly."


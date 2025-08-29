# Backup & Restore Runbook

## Backup (Online, Safe to run)
```bash
# Daily full backup (UTC timestamped)
docker compose exec db bash -lc '
  mkdir -p /backups &&
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -Z 9 \
    -f "/backups/lgs-$(date -u +%Y%m%dT%H%M%SZ).dump"
'
# Copy out
docker cp lgs_db:/backups ./db_backups
```

## Restore
```bash
# Stop app to avoid writes
docker compose stop app

# Restore from file
docker compose exec db bash -lc '
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/<dumpfile>.dump
'
# Start app
docker compose start app
```

## Rotation
- Keep **7 daily**, **4 weekly**, **6 monthly** backups.
- Store encrypted copies offline (e.g., VeraCrypt). Verify integrity quarterly.

## Disaster Recovery
1. Provision a host with Docker.
2. Restore `db_backups` + repo + `.env` (rotate secrets).
3. `docker compose up -d --build`
4. Verify with smoke tests: `/healthz`, login, audit viewer.

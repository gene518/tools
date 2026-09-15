#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
compose_file="${1:-compose.production.yml}"
backup_dir="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose -f "$compose_file" exec -T db pg_dump -U assets -d assets -Fc > "$backup_dir/assets.dump"
tar -czf "$backup_dir/uploads.tar.gz" -C data uploads
docker compose -f "$compose_file" exec -T db pg_restore --list < "$backup_dir/assets.dump" > "$backup_dir/manifest.txt"
echo "Backup verified: $backup_dir"

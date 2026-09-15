#!/usr/bin/env bash
set -euo pipefail

base_dir=/home/ubuntu/sftpgo
backup_dir="$base_dir/backups/$(date -u +%Y%m%dT%H%M%SZ)"

umask 077
mkdir -p "$backup_dir"

docker exec company-assets-db-1 pg_dump -U assets -d sftpgo -Fc > "$backup_dir/sftpgo.dump"
tar -czf "$backup_dir/files.tar.gz" -C "$base_dir/data" data
tar -czf "$backup_dir/configuration.tar.gz" -C "$base_dir" config/sftpgo.json sftpgo.local.env
docker exec -i company-assets-db-1 pg_restore --list < "$backup_dir/sftpgo.dump" > "$backup_dir/manifest.txt"

echo "Backup verified: $backup_dir"

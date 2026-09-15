#!/usr/bin/env bash
set -euo pipefail

env_file=/home/ubuntu/sftpgo/sftpgo.local.env
credentials_file=/home/ubuntu/sftpgo/credentials.local.txt

if [[ -e "$env_file" || -e "$credentials_file" ]]; then
  echo "SFTPGo secret files already exist; refusing to overwrite"
  exit 1
fi

db_password=$(openssl rand -hex 32)
admin_password=$(openssl rand -hex 24)
signing_passphrase=$(openssl rand -hex 48)

role_exists=$(docker exec company-assets-db-1 psql -X -U assets -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'sftpgo'")
database_exists=$(docker exec company-assets-db-1 psql -X -U assets -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sftpgo'")

if [[ -n "$role_exists" || -n "$database_exists" ]]; then
  echo "SFTPGo database or role already exists; refusing to change it"
  exit 1
fi

docker exec company-assets-db-1 psql -X -v ON_ERROR_STOP=1 -U assets -d postgres -c "CREATE ROLE sftpgo LOGIN PASSWORD '$db_password'"
docker exec company-assets-db-1 psql -X -v ON_ERROR_STOP=1 -U assets -d postgres -c "CREATE DATABASE sftpgo OWNER sftpgo"

umask 077
printf 'SFTPGO_DATA_PROVIDER__PASSWORD=%s\nSFTPGO_HTTPD__SIGNING_PASSPHRASE=%s\n' "$db_password" "$signing_passphrase" > "$env_file"
printf 'SFTPGo administrator URL: https://124.221.244.227/files/web/admin\nUsername: files-admin\nPassword: %s\n' "$admin_password" > "$credentials_file"
chmod 600 "$env_file" "$credentials_file"

echo "SFTPGo database and secret files created."

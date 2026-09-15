#!/usr/bin/env bash
set -euo pipefail

credentials_file=/home/ubuntu/sftpgo/credentials.local.txt
new_password=$(openssl rand -hex 24)
output_file=$(mktemp)
trap 'rm -f "$output_file"' EXIT

if ! printf '%s\n%s\n' "$new_password" "$new_password" | script -eq -c \
  'docker exec -it sftpgo /usr/bin/sftpgo resetpwd --admin files-admin --config-dir /etc/sftpgo' \
  /dev/null > "$output_file"; then
  cat "$output_file"
  exit 1
fi

if ! grep -q 'Password updated for admin' "$output_file"; then
  cat "$output_file"
  exit 1
fi

sed -i "s/^Password: .*/Password: $new_password/" "$credentials_file"
chmod 600 "$credentials_file"

echo "SFTPGo administrator password rotated."

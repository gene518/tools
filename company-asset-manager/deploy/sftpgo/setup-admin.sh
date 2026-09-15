#!/usr/bin/env bash
set -euo pipefail

credentials_file=/home/ubuntu/sftpgo/credentials.local.txt
cookie_file=$(mktemp)
response_file=$(mktemp)
trap 'rm -f "$cookie_file" "$response_file"' EXIT

admin_password=$(sed -n 's/^Password: //p' "$credentials_file")
setup_html=$(curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
  -c "$cookie_file" \
  -H 'Host: 124.221.244.227' \
  http://127.0.0.1:4319/files/web/admin/setup)
csrf_token=$(printf '%s' "$setup_html" | sed -n 's/.*name="_form_token" value="\([^"]*\)".*/\1/p')

if [[ -z "$admin_password" || -z "$csrf_token" ]]; then
  echo "Unable to obtain the initial-admin form token"
  exit 1
fi

status_code=$(curl --silent --show-error --connect-timeout 5 --max-time 15 \
  -o "$response_file" \
  -w '%{http_code}' \
  -b "$cookie_file" \
  -c "$cookie_file" \
  -H 'Host: 124.221.244.227' \
  --data-urlencode 'username=files-admin' \
  --data-urlencode "password=$admin_password" \
  --data-urlencode "confirm_password=$admin_password" \
  --data-urlencode "_form_token=$csrf_token" \
  http://127.0.0.1:4319/files/web/admin/setup)

if [[ "$status_code" != 303 && "$status_code" != 302 ]]; then
  echo "Initial administrator creation failed with HTTP $status_code"
  sed -n '1,80p' "$response_file"
  exit 1
fi

echo "Initial SFTPGo administrator created."

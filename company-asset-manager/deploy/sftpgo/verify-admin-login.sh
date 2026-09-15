#!/usr/bin/env bash
set -euo pipefail

admin_password=$(ssh -T -i /Users/jin/.ssh/tencent_vps_jin \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o ConnectTimeout=10 \
  ubuntu@124.221.244.227 \
  "sed -n 's/^Password: //p' /home/ubuntu/sftpgo/credentials.local.txt")

if [[ -z "$admin_password" ]]; then
  echo "Unable to read the SFTPGo administrator password"
  exit 1
fi

pwcli=/Users/jin/.codex/skills/playwright/scripts/playwright_cli.sh
"$pwcli" fill e16 files-admin > /dev/null
"$pwcli" fill e19 "$admin_password" > /dev/null
"$pwcli" click e24 > /dev/null
"$pwcli" snapshot

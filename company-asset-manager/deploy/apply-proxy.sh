#!/usr/bin/env bash
set -euo pipefail
expected_hash="${1:?Pass the SHA-256 of the inspected current Caddyfile}"
config="/home/ubuntu/company-assets/deploy/Caddyfile"
current_hash="$(sha256sum /etc/caddy/Caddyfile | cut -d ' ' -f 1)"
if [ "$current_hash" != "$expected_hash" ]; then
  echo "Current proxy configuration differs from the inspected version." >&2
  exit 1
fi
sudo -n caddy validate --config "$config" --adapter caddyfile
backup="/etc/caddy/Caddyfile.before-assets-update-$(date -u +%Y%m%dT%H%M%SZ)"
sudo -n cp -p /etc/caddy/Caddyfile "$backup"
sudo -n install -m 644 "$config" /etc/caddy/Caddyfile
if ! sudo -n systemctl reload caddy; then
  sudo -n cp -p "$backup" /etc/caddy/Caddyfile
  sudo -n systemctl reload caddy
  exit 1
fi
echo "Proxy reloaded; previous configuration: $backup"

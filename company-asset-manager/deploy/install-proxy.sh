#!/usr/bin/env bash
set -euo pipefail
current_hash="$(sha256sum /etc/caddy/Caddyfile | cut -d ' ' -f 1)"
expected_hash="b9688115c78d63f513f32fbd39e0508fa8a6fd04ec3c0414f016140926297863"
if [ "$current_hash" != "$expected_hash" ]; then
  echo "Caddy configuration changed since inspection; refusing to overwrite it." >&2
  exit 1
fi
backup_path="/etc/caddy/Caddyfile.before-company-assets-$(date -u +%Y%m%dT%H%M%SZ)"
sudo -n cp -p /etc/caddy/Caddyfile "$backup_path"
sudo -n caddy validate --config /home/ubuntu/company-assets/Caddyfile --adapter caddyfile
sudo -n install -m 644 /home/ubuntu/company-assets/Caddyfile /etc/caddy/Caddyfile
if ! sudo -n systemctl reload caddy; then
  sudo -n cp -p "$backup_path" /etc/caddy/Caddyfile
  sudo -n systemctl reload caddy
  exit 1
fi
echo "Caddy reloaded. Previous configuration: $backup_path"

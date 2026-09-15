#!/usr/bin/env bash
set -euo pipefail
umask 027
exec 9>/run/lock/company-assets-ip-certificate.lock
flock -n 9 || exit 0
source_dir=/home/ubuntu/company-assets/certificates/caddy/certificates/acme-v02.api.letsencrypt.org-directory/124.221.244.227
destination=/etc/caddy/company-assets-tls
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
install -m 600 "$source_dir/124.221.244.227.crt" "$staging/fullchain.pem"
install -m 600 "$source_dir/124.221.244.227.key" "$staging/privkey.pem"
certificate="$staging/fullchain.pem"
private_key="$staging/privkey.pem"
openssl x509 -in "$certificate" -noout -checkend 86400 >/dev/null
openssl x509 -in "$certificate" -noout -checkip 124.221.244.227 >/dev/null
openssl verify -untrusted "$certificate" "$certificate" >/dev/null
cert_key="$(openssl x509 -in "$certificate" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum | cut -d ' ' -f 1)"
actual_key="$(openssl pkey -in "$private_key" -pubout -outform DER | sha256sum | cut -d ' ' -f 1)"
if [ "$cert_key" != "$actual_key" ]; then
  echo "Certificate and key do not match; keeping the current pair." >&2
  exit 1
fi
fingerprint="$(sha256sum "$certificate" | cut -d ' ' -f 1)"
if [ "${1:-}" != "--force-install" ] && [ -f "$destination/current/fullchain.pem" ] && cmp -s "$certificate" "$destination/current/fullchain.pem"; then
  echo "IP certificate is current."
  exit 0
fi
install -d -m 750 -o root -g caddy "$destination" "$destination/$fingerprint"
install -m 640 -o root -g caddy "$certificate" "$destination/$fingerprint/fullchain.pem"
install -m 640 -o root -g caddy "$private_key" "$destination/$fingerprint/privkey.pem"
previous="$(readlink "$destination/current" || true)"
ln -s "$fingerprint" "$destination/pending-$$"
mv -Tf "$destination/pending-$$" "$destination/current"
if [ "${1:-}" != "--stage-only" ]; then
  if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || ! caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile --force; then
    if [ -n "$previous" ]; then
      ln -s "$previous" "$destination/rollback-$$"
      mv -Tf "$destination/rollback-$$" "$destination/current"
      caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile --force
    fi
    exit 1
  fi
fi
echo "Installed valid IP certificate: $fingerprint"

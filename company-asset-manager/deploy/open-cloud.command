#!/usr/bin/env bash
set -euo pipefail
cloud_url="https://tencent.geneecho.top/asset-manager/"
curl --silent --fail --max-time 10 "${cloud_url}api/health" >/dev/null
open "$cloud_url"
echo "Opened the Tencent deployment over verified public HTTPS."

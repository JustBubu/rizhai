#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install Node 20+ from https://nodejs.org/ then run this again."
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Rizhai at http://127.0.0.1:43123"
url="http://127.0.0.1:43123"
if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "$url") &
elif command -v xdg-open >/dev/null 2>&1; then
  (sleep 2 && xdg-open "$url") &
fi

npm run dev

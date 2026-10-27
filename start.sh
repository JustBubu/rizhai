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

open_browser() {
  local url="http://127.0.0.1:43123"
  if command -v open >/dev/null 2>&1; then
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url"
  fi
}

if curl -fsS --max-time 2 "http://127.0.0.1:43123/" >/dev/null 2>&1; then
  echo "Rizhai is already running at http://127.0.0.1:43123"
  open_browser
  exit 0
fi

echo "Starting Rizhai at http://127.0.0.1:43123"
(
  for _ in $(seq 1 90); do
    if curl -fsS --max-time 2 "http://127.0.0.1:43123/" >/dev/null 2>&1; then
      open_browser
      exit 0
    fi
    sleep 1
  done
) &

npm run dev

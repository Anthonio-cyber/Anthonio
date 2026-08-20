#!/usr/bin/env bash
# ==========================================================
#  GRADE 8 HUB - macOS and Linux start file
#  Run it with:   ./start.sh
# ==========================================================
set -e
cd "$(dirname "$0")"

echo
echo "=========================================================="
echo "  GRADE 8 HUB"
echo "=========================================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js was not found on this computer."
  echo
  echo "  The Grade 8 Hub needs Node.js version 18 or newer."
  echo "  Install it from https://nodejs.org and run ./start.sh again."
  echo
  exit 1
fi

echo "  Node.js $(node -v) found."

if [ ! -d node_modules ]; then
  echo
  echo "  First run - installing what the app needs."
  echo "  This can take a few minutes. Please wait."
  echo
  npm install
fi

echo
echo "  Starting the server..."
echo "  Open this address in your browser:"
echo
echo "      http://localhost:3000"
echo
echo "  Press Ctrl + C to stop it."
echo

npm start

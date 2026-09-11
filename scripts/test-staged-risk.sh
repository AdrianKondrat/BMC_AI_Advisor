#!/bin/bash
set -euo pipefail

# Exit immediately if no arguments (defensive; lint-staged should only call on match)
if [[ $# -eq 0 ]]; then
  exit 0
fi

# Build the app once
npm run build

# Run vitest on the staged risk-area files
npx vitest related "$@" --run --project workerd

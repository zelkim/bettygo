#!/bin/bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found" >&2
  exit 1
fi

SECRETS=(
  DISCORD_CLIENT_SECRET
  DISCORD_BOT_TOKEN
  HMAC_SECRET
  API_SECRET
)

for key in "${SECRETS[@]}"; do
  value=$(grep "^${key}=" "$ENV_FILE" | cut -d'=' -f2-)
  if [ -z "$value" ]; then
    echo "Skipping $key (not set in $ENV_FILE)"
    continue
  fi
  echo "Pushing secret: $key"
  echo "$value" | wrangler secret put "$key"
done

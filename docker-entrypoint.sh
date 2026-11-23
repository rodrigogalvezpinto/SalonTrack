#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  database_dir="$(dirname "${DATABASE_FILE:-/data/salontrack.sqlite}")"
  mkdir -p "$database_dir"
  chown -R node:node "$database_dir"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"

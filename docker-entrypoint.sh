#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  db="${DATABASE_FILE:-/data/salontrack.sqlite}"
  database_dir="$(dirname "$db")"
  mkdir -p "$database_dir"
  chown node:node "$database_dir"
  for file in "$db" "$db-wal" "$db-shm" "$db-journal"; do
    if [ -e "$file" ]; then
      chown node:node "$file"
    fi
  done
  if [ -d "$database_dir/backups" ]; then
    chown -R node:node "$database_dir/backups"
  fi
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"

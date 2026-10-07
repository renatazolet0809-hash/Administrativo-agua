#!/usr/bin/env bash
# Sincroniza prisma/schema.postgres.prisma a partir de prisma/schema.prisma.
# Úsalo SIEMPRE que modifiques los modelos en schema.prisma, para que la
# versión PostgreSQL (Neon/Vercel) quede idéntica y sin deriva.
#
#   bash scripts/sync-postgres-schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="prisma/schema.prisma"
DST="prisma/schema.postgres.prisma"

sed '/^datasource db {/,/^}/c\
datasource db {\
  provider  = "postgresql"\
  url       = env("DATABASE_URL")\
  directUrl = env("DIRECT_URL")\
}' "$SRC" > "$DST"

echo "OK: $DST regenerado desde $SRC"
echo "Recuerda validar: npx prisma validate --schema $DST"

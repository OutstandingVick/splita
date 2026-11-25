#!/bin/sh
# Dev server for apps/clerk with core and web rebuilt on save, so package changes show up
# without restarting. Ctrl+C stops all three processes.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
pnpm --filter @splita/core --filter @splita/web build
trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT
(cd packages/core && exec npx tsc -w -p tsconfig.json --preserveWatchOutput) &
(cd packages/web && exec npx tsc -w -p tsconfig.json --preserveWatchOutput) &
cd apps/clerk && npx next dev "$@"

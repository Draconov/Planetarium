#!/usr/bin/env sh
set -eu
npm run check
npm run build:web
echo "Web build created in dist/web"

#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/01 - Projects/Flowti CLI/src/flowti-cli.mjs" "$@"

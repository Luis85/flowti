#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../../01 - Projects/Flowti CLI"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  */Flowti\ CLI/src/*.ts|*/Flowti\ CLI/tests/*.ts)
    cd "$PROJECT_DIR" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | tail -10;;
esac

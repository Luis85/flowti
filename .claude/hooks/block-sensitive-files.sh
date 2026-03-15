#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILE=$(node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.tool_input.file_path||'')" 2>/dev/null)
case "$FILE" in
  *.env|*.env.*) echo "BLOCKED: Cannot edit $FILE — contains secrets" >&2; exit 1;;
  *package-lock.json|*pnpm-lock.yaml) echo "BLOCKED: Cannot edit lock file $FILE" >&2; exit 1;;
esac

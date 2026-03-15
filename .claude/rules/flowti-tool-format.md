---
paths:
  - ".flowti/ai-tools/**"
  - "01 - Projects/Flowti CLI/src/domain/ai-tools/**"
---

# Flowti AI Tool Definition Format

AI tools are JSON files in `.flowti/ai-tools/<name>.json` at vault level.

## JSON Schema

```json
{
  "name": "tool-name",
  "description": "What the tool does",
  "version": "1.0.0",
  "run": "shell command to execute",
  "cwd": "working directory (relative to vault root)",
  "params": [
    {
      "name": "param-name",
      "type": "string|number|boolean|array|object",
      "description": "What the parameter does",
      "required": true,
      "default": "optional default value"
    }
  ],
  "tags": ["category"]
}
```

## Naming Convention

Tool names must be lowercase alphanumeric with hyphens or underscores: `my-tool`, `build_check`.

## Creating Tools

Use the Flowti CLI: `flowti ai:new` or create JSON files directly. After creation, run `flowti claude:sync` to update Claude Code skill files.

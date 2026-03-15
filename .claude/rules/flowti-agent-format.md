---
paths:
  - "03 - Resources/Agents/**"
  - "01 - Projects/Flowti CLI/docs/agents/**"
  - "01 - Projects/Flowti CLI/src/domain/agents/**"
---

# Flowti Agent Definition Format

Agents are markdown files with YAML frontmatter. Location is configured in `.flowti/config.json` under `agents.dir` (default: `03 - Resources/Agents/`).

## File Convention

Each agent can have up to 3 files:
- `<name>.md` — Main definition (YAML frontmatter + markdown body)
- `<name>.json` — Companion JSON for complex nested data (components, goals, AI config, relationships)
- `<name>.prompt.md` — System prompt used when invoking the agent

File names are kebab-case: "Product Owner" becomes `product-owner.md`.

## Frontmatter Schema

```yaml
---
type: Agent
name: Agent Name
agentType: ai | human
description: What the agent does
domain: business-domain
skills:
  - Skill Name|proficiency-level
tools:
  - tool-name
roles:
  - Role Name
behaviors:
  - behavior-name
preferredPhases:
  - planned
  - in-progress
suggestedTasks:
  - Task description|phase1,phase2
---
```

`preferredPhases` lists iteration lifecycle phases where this agent is most active (e.g., `new`, `planned`, `ready`, `in-progress`, `in-review`, `done`).

## Companion JSON Schema

```json
{
  "components": [{ "name": "string", "type": "string", "config": {} }],
  "goals": [{ "name": "string", "priority": 1, "condition": "string" }],
  "ai": {
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic",
    "systemPrompt": "optional inline prompt",
    "contextWindow": 200000,
    "maxTokens": 8192
  },
  "relationships": [{ "target": "Agent Name", "type": "collaborates", "description": "string" }],
  "inventory": [{ "path": "relative/to/vault/file.md", "label": "optional display name" }]
}
```

Relationship types: `supervises`, `reports-to`, `collaborates`, `delegates-to`, `uses`, `depends-on`.

`inventory` holds markdown files the agent owns or carries — reference documents, templates, or working artifacts. Paths are relative to vault root.

## Creating Agents

Use the Flowti CLI: `flowti agents:add` (interactive) or create files directly following the schema above. After creation, run `flowti claude:sync` to update Claude Code skill files.

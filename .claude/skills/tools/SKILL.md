---
name: tools
description: Browse all Flowti AI tool definitions — commands, parameters, and usage
user-invocable: true
---

# Flowti AI Tools

| Tool | Version | Description | Tags |
|------|---------|-------------|------|
| agent-status | 1.0.0 | View a specific agent's full component map, status, and recent actions | state, monitoring, agents |
| world-state-json | 1.0.0 | Get the raw world state as JSON — for programmatic consumption by agents or visualizations | state, monitoring, agents, api |
| world-state | 1.0.0 | View the full world state — all agents, projects, iterations, and recent activity log | state, monitoring, agents |

---

## agent-status

> View a specific agent's full component map, status, and recent actions

**Run**: `node .flowti/bin/main.js state --agent="${name}"`
**Working Directory**: `.`
**Version**: 1.0.0

**Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | yes | Agent name (e.g. Bob, Product Owner, Software Architect) |

**Tags**: state, monitoring, agents

---

## world-state-json

> Get the raw world state as JSON — for programmatic consumption by agents or visualizations

**Run**: `node .flowti/bin/main.js state --json`
**Working Directory**: `.`
**Version**: 1.0.0

**Tags**: state, monitoring, agents, api

---

## world-state

> View the full world state — all agents, projects, iterations, and recent activity log

**Run**: `node .flowti/bin/main.js state`
**Working Directory**: `.`
**Version**: 1.0.0

**Tags**: state, monitoring, agents

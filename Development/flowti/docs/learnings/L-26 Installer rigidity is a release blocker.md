---
type: Learning
cycle: 10
domain: installer
tags:
  - installer
  - adaptability
---

# L-26: Installer rigidity is a release blocker

## Context

The FolderScaffoldStep creates 23 hardcoded PARA folders. During rapid development, the folder structure evolves frequently. Each change requires modifying TypeScript code, rebuilding, and redistributing.

## Observation

When schemas and structures change rapidly, hardcoded configurations become stale within a single iteration. What worked for the author's vault may not match a new user's needs. The installer is the first impression — a rigid, stale structure undermines trust.

## Takeaway

Externalize configuration that changes faster than the release cycle. Folder structures, seed content, and installer steps should live in versioned JSON configs that can be updated independently of the codebase. This is a prerequisite for any public release.

## Applied

- Created versioned JSON folder config item (critical priority, release blocker RB-1)
- Created seed content item (high priority, release blocker RB-4)
- Created pluggable step registry item (medium priority, future extensibility)

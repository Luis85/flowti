---
type: Idea
stage: discovery
origin: inbox
domain: automation
parent: "[[Automation PRD]]"
description: "Auto-prompt users to set the type frontmatter when a new file is created, if not already documented."
tags:
priority: 01 - medium
rank:
---

# Prompt File Type Documentation on Creation

When a new file is created in the vault without a `type:` frontmatter field, Flowti could display a gentle prompt asking the user to classify it. This nudge-based approach ensures documentation conformance (ADR-030) without blocking the user's workflow. The prompt could offer a dropdown of known types and auto-insert the selected value into the file's frontmatter.

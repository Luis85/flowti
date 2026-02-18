---
type: TechDebt
severity: low
category: documentation
layer: cross-cutting
status: open
effort: small
updated: 2026-02-15
description: "Building the Frontend with JSON.md" in /docs/ideas/ is a 0-byte empty file — an orphaned placeholder with no content or frontmatter.
---
# TD-88: Empty placeholder in ideas directory

## Problem

The file `docs/ideas/Building the Frontend with JSON.md` is 0 bytes. It has:
- No frontmatter
- No content
- No links to or from other documents

The ideas directory otherwise contains functional content:
- 2 canvas files (visual design documents)
- 3 populated markdown files (Flowti IBDE, The Digital Twin, manual-test-strategy)
- 1 homepage index

This empty file is the only orphaned placeholder in the ideas directory.

## Impact

- Minor: creates noise in file listings and search results
- Breaks any automated completeness checks that scan for empty files
- If the concept is valuable, it is being lost; if not, the file is dead weight

## Suggested Remediation

1. If "Building the Frontend with JSON" is a valid concept, populate with at least a problem statement and initial thoughts
2. If the concept was abandoned or absorbed elsewhere, delete the file
3. Add `stage: idea` frontmatter to all ideas to distinguish them from abandoned placeholders

## Affected Files

- `docs/ideas/Building the Frontend with JSON.md`

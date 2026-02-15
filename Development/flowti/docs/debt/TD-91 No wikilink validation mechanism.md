---
severity: medium
category: architecture
layer: infrastructure
status: open
effort: medium
updated: 2026-02-15
description: 216+ wikilinks exist across documentation with no automated validation. Broken references are only discovered at read time, undermining the reliability of cross-references that make the docs a navigable living system.
---
# TD-91: No wikilink validation mechanism

## Problem

The documentation system uses Obsidian-style wikilinks (`[[Target]]`) extensively for cross-referencing. Over 216 wikilinks exist across 400+ files, connecting:
- Components to parent components
- Components to source files
- Flows to services and events
- Decisions (ADRs) to related decisions and architecture docs
- Sitemap views to features and source files
- Templates to related documentation

There is no mechanism to validate that these links resolve to actual files. When a file is renamed, moved, or deleted, all inbound wikilinks silently break. Broken references are only discovered when a human follows the link and finds nothing.

The PRD Audit (2026-02-15) identified 9 phantom events and multiple naming inconsistencies — symptoms of unvalidated cross-references drifting over time.

## Impact

- Cross-references degrade silently — the documentation network develops dead links without warning
- Readers following links to understand context hit dead ends
- Renaming or restructuring files is risky — no way to find all references that need updating
- The "living organism" metaphor requires functioning circulation; broken links are clots

## Suggested Remediation

1. Create a wikilink validation script that scans all markdown files, extracts `[[...]]` references, and checks resolution
2. Run validation as part of the documentation review process
3. Consider integrating as a pre-commit hook or CI check
4. Output a report of broken links with file location and target

## Affected Files

- Cross-cutting: all 400+ documentation files
- Implementation target: build tooling or CI pipeline

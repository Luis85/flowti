---
type: TechDebt
severity: medium
category: documentation
layer: cross-cutting
status: open
effort: medium
updated: 2026-02-15
description: All 5 user story files contain only titles — no acceptance criteria, no actor context, no business value, no feature links. No User Story Template exists.
---
# TD-81: User stories have no content

## Problem

The `/docs/user-stories/` directory contains 5 files. All are title-only stubs with no substantive content:

- As Obsidian Plugin Developer...
- I want to create a review-request...
- I want to create and maintain lifecycle...
- I want to trigger a process from Canvas...
- I want to trigger a process from Markdown...

Each file has minimal frontmatter but lacks:
- Acceptance criteria
- Actor/persona context
- Business value statement
- Related feature or PRD links
- Status or stage field

The Development Lifecycle document (Phase 1) positions user stories as the primary feedback artifact, yet the actual story files contain nothing actionable. No User Story Template exists in `/docs/templates/`.

## Impact

- Development Lifecycle Phase 1 feedback loop cannot function — stories carry no requirements
- Feature validation has no user-story basis — acceptance criteria are missing
- The `03 - User Stories.base` database view references files with no queryable content
- Product Service Book and Domain Book chapters expecting user story material find none

## Suggested Remediation

1. Create a User Story Template in `/docs/templates/` with: frontmatter (type, persona, feature, stage, priority), narrative (As a... I want... So that...), acceptance criteria, business value, related features
2. Populate the 5 existing story files using the template
3. Cross-link stories to features in `/docs/features/`
4. Add `stage` field to frontmatter for lifecycle tracking

## Affected Files

- 5 files in `docs/user-stories/`
- Missing: `docs/templates/User Story Template.md`

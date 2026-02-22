---
type: TechDebt
severity: medium
category: process
layer: cross-cutting
status: open
effort: medium
updated: 2026-02-18
description: No codified pull-request process exists. Code changes are committed directly without peer review, branch protection, or CI/CD gating.
---
# TD-92: No pull-request process in place

## Problem

There is no process for pull requests. Code changes are committed directly to the main branch without:

- Peer review or approval workflow
- Branch protection rules
- CI/CD pipeline gating (tests, lint, build must pass before merge)
- Conventional commit enforcement
- Changelog generation from PR descriptions

This is acceptable for a solo developer in early phases but becomes a risk as the codebase grows (166+ source files, 2,177 tests) and as the plugin approaches publication.

## Impact

- No second pair of eyes on architectural decisions or code quality
- No automated gate preventing broken builds from landing on main
- No audit trail of why changes were made (commit messages are the only record)
- Future contributors would have no onboarding workflow

## Suggested Remediation

1. Define a lightweight PR process (draft → review → merge) documented in `docs/knowledgebase/`
2. Configure branch protection on `master` (require passing CI before merge)
3. Set up GitHub Actions for `npm run build` on PR
4. Consider conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`) for changelog generation
5. Evaluate whether this is needed now or can wait until multi-contributor phase

## Related

- TD-37: No Release- and Publishing Strategy
- ADR-028: Obsidian CLI for Automated Testing (proposed)

## Note (2026-02-22)

This item becomes **critical** as the project approaches release. The codebase now contains 230+ source files, 3,548 tests, and 15 bounded contexts. Shipping without a PR process means no gated quality checks before code reaches users. Recommend prioritizing at least branch protection + CI gating before the first public release.

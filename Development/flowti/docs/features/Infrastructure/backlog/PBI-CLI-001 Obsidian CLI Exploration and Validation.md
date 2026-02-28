---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: high
stage: planned
planned_in: "[[Cycle 53 - Obsidian CLI Spike]]"
estimated_loc: 30
estimated_tests: 0
effort: small
tags:
  - backlog
  - cli
  - infrastructure
related:
  - "[[Automated testing with Obsidian CLI]]"
  - "[[ADR-028 Obsidian CLI for Automated Testing]]"
---

## User Story

As a plugin developer, I want to validate that the Obsidian CLI (1.12+) works with Flowti's development vault so that I can confidently build E2E test infrastructure and development workflow tooling on top of it.

### User Pains

- E2E testing has been blocked since Cycle 9 (ADR-028) due to lack of CLI tooling
- Plugin reload during development requires manual action in Obsidian
- No programmatic way to verify plugin state after changes

### User Needs

- Confirm CLI is operational against the development vault
- Verify Flowti plugin is visible and manageable via CLI
- Validate hot-reload workflow via `plugin:reload`
- Document setup requirements and gotchas

## Solution Statement

### Functional Requirements

- [ ] Enable CLI in Obsidian 1.12+ settings
- [ ] Configure Windows PATH and `Obsidian.com` redirector
- [ ] Validate basic commands: `obsidian version`, `obsidian vault`, `obsidian files total`, `obsidian plugins versions`
- [ ] Verify Flowti plugin appears in `obsidian plugins` output
- [ ] Test `obsidian plugin:reload flowti-ibde` for hot-reload
- [ ] Document setup steps and requirements

## INVEST Assessment

| Criterion | Met? | Notes |
|-----------|------|-------|
| Independent | Yes | No code dependencies — pure setup and validation |
| Negotiable | Yes | Scope of validation commands can be adjusted |
| Valuable | Yes | Unblocks all subsequent increments in the cycle |
| Estimable | Yes | ~30 LOC (setup docs), 0 tests. Small bounded task |
| Small | Yes | Single increment, manual validation |
| Testable | Yes | Binary: CLI responds or it doesn't. Plugin listed or not |

## Acceptance Criteria

- [ ] CLI responds to `obsidian version` (v1.12+)
- [ ] `obsidian plugins` lists `flowti-ibde`
- [ ] `plugin:reload flowti-ibde` triggers Flowti's `onunload()/onload()` cycle
- [ ] Setup documented in spike notes

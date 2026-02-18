---
type: Learning
id: L-21
source: "[[Development Lifecycle]]"
source_pbi: Documentation Audit 2026-02-18
domain: process
tags:
  - learning
  - process
  - documentation
---

# L-21: Documentation debt compounds silently

A full audit of 534 docs revealed 105 missing `type:` fields, 28 missing `stage:` fields, 2 missing flow docs, 1 stale event reference, and ~20 empty stub files. None of these gaps were visible during normal development — each was a small omission that compounded over months.

## Pattern

- Documentation gaps don't cause test failures or build errors
- Each individual omission is trivial — "I'll add the frontmatter later"
- Over time, small gaps compound into systemic inconsistency (19.6% of docs non-conforming)
- Automated queries (Dataview, scanners) silently produce incomplete results

## When to Apply

- After every increment: quick audit of new docs for frontmatter completeness
- When creating a new document category: define the `type:` value upfront
- Periodically (quarterly): run the frontmatter conformance script to catch drift
- When a Dataview query returns unexpected results: check if `type:` is missing

## Remediation

- ADR-030 establishes canonical type values and an idempotent fix script
- Run `scripts/fix-frontmatter.mjs` to fix existing violations
- Add frontmatter conformance to the Development Lifecycle Phase 9 checklist

## Related

- [[ADR-030 Frontmatter Type Conformance Standard]]
- [[Development Lifecycle]] (Phase 9: Documentation)

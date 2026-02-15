---
severity: medium
category: documentation
layer: domain
status: open
effort: large
updated: 2026-02-15
description: Only Event System has Problemspace.md and Solutionspace.md files. The remaining 27 features merge problem and solution concerns into a single PRD, preventing independent problem analysis.
---
# TD-83: Only 1 of 28 features has problem-solution separation

## Problem

The feature documentation structure supports three complementary artifacts per feature:
- **PRD** — Requirements and acceptance criteria
- **Problemspace.md** — Independent problem analysis (who, what, why, constraints)
- **Solutionspace.md** — Solution design (how, trade-offs, alternatives)

Only **Event System** implements all three. The remaining 27 features either:
- Have a PRD only (21 features)
- Have no documentation at all (6 features are stubs)

Problem-solution separation matters because:
- Problems should be understood before solutions are proposed
- Multiple solutions can address the same problem — without separation, the first solution becomes the only one considered
- Reviewers need to evaluate problem validity independently from solution quality

## Impact

- Problem analysis is entangled with solution design in 27 features
- Three Amigos sessions cannot independently review problem clarity vs. solution fitness
- The PRD Template's "Problem Statement" section is a single paragraph — insufficient for complex feature domains
- Domain Book Chapter 3 (Problem Space) has no dedicated source material for 27 of 28 features

## Suggested Remediation

1. Prioritize Tier 2–3 features (those with complete PRDs) for problem-solution extraction
2. Create Problemspace.md for features currently in `development` or `design` stage first: Event Catalog, Infrastructure, Settings, Hubs
3. Solutionspace.md can follow once problem clarity is established
4. For Tier 4 stub features, problem-solution separation should be required before PRD creation

## Affected Files

- 27 feature directories in `docs/features/` (all except Event System)

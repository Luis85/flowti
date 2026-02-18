---
type: Learning
id: L-19
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 10
domain: architecture
tags:
  - learning
  - architecture
  - decisions
---

# L-19: Superseding ADRs is a healthy sign

ADR-025 (separate artifacts vs. activity) was accepted during design but superseded during delivery when real usage showed artifacts were a strict subset of activity. The separate sections confused users. Writing ADRs creates decisions that can be revisited — they're not permanent constraints. The supersession was documented in Inc 10 with clear rationale.

## Pattern

- ADRs capture the best decision at the time with the information available
- Real-world usage may invalidate the decision — that's expected
- Supersede with a clear rationale in the ADR itself and the increment that made the change
- The ADR history shows the evolution of thinking, which is valuable

## When to Apply

- When implementation reveals a design decision was wrong
- Document the supersession, don't just silently change the code

## Related

- [[ADR-025 Activity Log Separate from Artifacts]] (superseded)

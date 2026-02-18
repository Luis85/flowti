---
type: Learning
id: L-18
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 10
domain: process
tags:
  - learning
  - process
  - delivery
---

# L-18: Cross-PBI delivery keeps momentum

Inc 10 delivered PBI-SW-001 and PBI-SW-002 (from Session Workspaces PRD) within PBI-002's increment structure. This avoided creating a separate delivery pipeline for a feature that shares the same service and view. When a child PRD's requirements naturally fit into the parent's next increment, deliver them together rather than creating artificial separation.

## Pattern

- When a new PRD's requirements overlap with the current PBI's next increment, deliver them together
- Tag the increment with `cross_pbi` references in frontmatter
- Update both PRDs to reflect the cross-delivery

## When to Apply

- When a child feature PRD shares code surface area with the parent PBI
- When creating a separate delivery pipeline would add overhead without value

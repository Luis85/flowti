---
type: Learning
id: L-23
source: "[[Cycle 2 - Session Types and Decision Log]]"
source_pbi: "[[PBI-SW-004 Decision Log]]"
source_increment: 4
domain: design
tags:
  - learning
  - design
  - ux
  - types
---

# L-23: Optional fields simplify UX

Making `description` optional on `SessionDecision` let users record quick decisions without friction. The original design required both title and description, but user feedback during Cycle 2 showed that most decisions are captured as quick one-liners. Requiring a description added unnecessary friction to the recording flow.

## Pattern

- Default to minimal required fields for user-facing types
- Make supplementary fields optional from the start
- Adapt rendering to handle presence/absence gracefully: `- **Title**` vs `- **Title**: desc`
- Thread optionality through the full stack: type → event → service → UI → summary

## When to Apply

- Any user-input type where some fields are contextually useful but not always needed
- When the UX flow prioritizes speed of capture over completeness
- When a field adds value in some contexts but creates friction in the common case

## Related

- [[PBI-SW-004 Decision Log]]
- [[L-09 Thread new fields through all creation paths]]

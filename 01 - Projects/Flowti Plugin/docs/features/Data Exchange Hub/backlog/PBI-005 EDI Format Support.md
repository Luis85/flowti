---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: discovery
priority: low
dependencies: []
tags:
  - data-exchange
  - format-support
user_story: "[[EDI Integration]]"
---

## User Story - Problemspace

As a supply chain analyst, I want to import EDI (Electronic Data Interchange) files into my vault so that I can manage operational data from logistics, healthcare, and manufacturing systems alongside my knowledge graph.

### User Pains

- EDI is a staple format in many industries but Flowti only supports CSV
- Users must manually convert EDI to CSV before importing, adding friction
- No way to view EDI files within Obsidian

### User Needs

- EDI file detection and parsing (EDIFACT, X12 formats)
- EDI viewer similar to the CSV viewer
- Import wizard for EDI-to-notes conversion
- Registration as import source in Data Exchange Hub

## Solutionstatement

### Functional Requirements

- [ ] EDI parser: Parse common EDI formats (EDIFACT, X12) into structured records
- [ ] EDI viewer: Dedicated view showing segments and elements
- [ ] Import wizard: Map EDI segments/elements to frontmatter properties
- [ ] Register as import source type in Data Exchange Hub alongside CSV
- [ ] File extension detection: `.edi`, `.x12`, `.edifact`

## Acceptance Criteria

- [ ] EDI files detected by extension
- [ ] Basic EDI segment parsing works for EDIFACT and X12
- [ ] EDI viewer displays segment/element breakdown
- [ ] Import wizard converts EDI to typed notes
- [ ] npm run build passes

## Related

- PRD: [[Data Exchange Hub PRD]]
- Inbox: [[EDI Integration]]

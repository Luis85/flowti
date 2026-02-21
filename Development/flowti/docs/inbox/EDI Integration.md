---
type: idea
stage: discovery
origin: inbox
domain: data-exchange
description: "Support EDI (Electronic Data Interchange) file format as an import source alongside CSV, with a dedicated viewer."
tags:
  - data-exchange
  - format-support
priority: "03 - low"
parent: "[[Data Exchange Hub PRD]]"
---

As EDI is like CSV a staple in the industry, Flowti should be able to read EDI and provide import and view options like our CSV viewer.

## Problem

Flowti currently only supports CSV as a data import format. EDI (Electronic Data Interchange) is a standard format in logistics, supply chain, healthcare, and manufacturing. Without EDI support, users in these industries cannot use Flowti to ingest their operational data.

## Proposed Solution

1. EDI parser: Parse common EDI formats (EDIFACT, X12) into structured records
2. EDI viewer: Dedicated view similar to the CSV viewer showing segments and elements
3. Import wizard: Map EDI segments/elements to frontmatter properties
4. Register as import source type in Data Exchange Hub alongside CSV

## Acceptance Criteria

- [ ] EDI file detection (`.edi`, `.x12`, `.edifact` extensions)
- [ ] Basic EDI segment parsing
- [ ] EDI viewer with segment/element breakdown
- [ ] Import wizard for EDI-to-notes conversion
- [ ] npm run build passes

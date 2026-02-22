---
type: Persona
stage: done
description: "Receives and processes information daily, needs organization without scripting"
plugin: "[[Development/flowti/README|README]]"
domain: Flowti
roles:
  - user
related_domains:
  - inbox
  - data-exchange
  - session
  - canvas
  - hub
related_features:
  - Data Exchange Hub
  - Inbox
  - Session Workspaces
  - Canvas Integration
---
# Knowledge Worker

## Identity

### Name & Role

Knowledge Worker — the information processor who receives, organizes, and acts on data daily without writing code.

### Archetype

Receives and processes information daily. Uses Obsidian as an operational inbox and knowledge base. Needs automation without scripting — structured imports, notifications, and focused work sessions to tame information overload.

### Quote

> "I spend half my day just getting information into the right place. The other half I spend trying to find it again."

### Profile Summary

A non-technical professional who handles reports, datasets, meeting notes, and cross-system updates daily. They use Obsidian as their operational hub but struggle with the manual effort of getting external data into their vault in a structured way. Flowti's Data Exchange Hub provides CSV/canvas import without coding, the Inbox keeps them aware of system changes, Session Workspaces create focus periods for deep processing, and pipeline automation reduces repetitive filing tasks. They don't model domains or write events — they consume structured information and need it organized.

## Goals & Motivations

### Primary Goals

| Goal | Priority | Related Feature |
|---|---|---|
| Process incoming data efficiently | Critical | [[Data Exchange Hub]] (CSV import, canvas import) |
| Stay organized without manual filing | Critical | [[Data Exchange Hub]] (pipelines, merge keys) |
| Track what happened and when | High | [[Session Workspaces]] (reflection journaling, session statistics) |
| Reduce information overload | High | [[Inbox]] (500-item cap, mark read/dismiss) |
| Focus on deep work without distractions | High | [[Session Workspaces]] (6-state lifecycle, cognitive overload detection) |
| Import visual structures into vault | Medium | [[Canvas Integration]] (canvas-to-vault, hierarchy detection) |
| Export processed data in useful formats | Medium | [[Data Exchange Hub]] (CSV/JSON/Markdown export) |

### Success Criteria

- Incoming reports and datasets imported via DX Hub without manual reformatting
- Inbox notifications provide passive awareness without constant checking
- Focused processing sessions tracked with intent and energy
- Canvas diagrams (meeting maps, org charts) converted to structured notes
- Exported summaries available in CSV, JSON, or Markdown for stakeholders

## Jobs To Be Done

- Import CSV data from external reports using Data Exchange Hub merge keys to avoid duplicates
- Convert Obsidian .canvas files (meeting maps, process diagrams) into structured vault notes via Canvas Integration
- Monitor system changes through Inbox notifications (6 source events, mark read/dismiss/clear)
- Create focused data processing sessions in Session Workspaces with intent, energy tracking, and reflection
- Export processed information as CSV/JSON/Markdown for sharing with stakeholders
- Build multi-source pipelines to automate recurring data aggregation tasks
- Use Base file integration for structured data within the vault

## Pain Points

| Pain Point | Severity | Current Workaround | Flowti Feature |
|---|---|---|---|
| Information overload from multiple sources | Critical | Manual triage, ignore most | [[Inbox]] (6 source events, 500-item cap, mark read/dismiss) ✓ |
| Manual copy-paste from reports into vault | Critical | Manual data entry | [[Data Exchange Hub]] (CSV import with merge keys) ✓ |
| Lost context between work sessions | High | Scattered notes, memory | [[Session Workspaces]] (reflection journaling, closure ritual) ✓ |
| No automated routing of incoming data | High | Manual folder sorting | [[Data Exchange Hub]] (multi-source pipelines, target folders) ✓ |
| Visual diagrams stuck in canvas format | Medium | Manually recreate as notes | [[Canvas Integration]] (canvas parser, hierarchy detection) ✓ |
| No way to track processing progress | Medium | Checkbox lists | [[Session Workspaces]] (execution tasks, session statistics) ✓ |
| Exporting data requires technical skills | Medium | Ask a developer | [[Data Exchange Hub]] (CSV/JSON/Markdown export with formulas) ✓ |

## What Flowti Delivers

- **Data Exchange Hub** — CSV import with merge keys for deduplication, CSV/JSON/Markdown export with formula support, multi-source pipelines with aggregated results, canvas import (Obsidian .canvas → vault notes), Base file integration. 7 tabs for different data operations ✓
- **Inbox/Notifications** — 6 source events with mark read/dismiss/clear, 500-item cap, unread count in User Hub. Passive awareness without constant checking ✓
- **Session Workspaces** — Focused processing sessions with 6-state lifecycle (prepared→running→paused→reviewing→completed→archived), intent setting, energy tracking, execution tasks, reflection journaling, and cognitive overload detection ✓
- **Canvas Integration** — Convert meeting maps, org charts, and process diagrams from Obsidian .canvas format into structured vault notes with hierarchy detection (flat/nested/grouped) and saved configurations ✓
- **User Hub** — Session statistics for tracking processing patterns, inbox panel for quick notification review ✓

## Domain Interaction Map

| Domain | Interaction Level | Primary Use |
|---|---|---|
| data-exchange | Heavy | CSV/canvas import, export, pipelines |
| inbox | Heavy | Notification awareness, change tracking |
| session | Heavy | Focused processing sessions |
| canvas | Moderate | Visual diagram conversion |
| hub | Moderate | Navigation, tab workflows |
| user-hub | Light | Session statistics, inbox panel |
| notification | Light | System alerts |

## Related Artifacts

### Jobs To Be Done

- [[JTBD - Process Incoming Data]]
- [[JTBD - Stay Organized Without Scripting]]
- [[JTBD - Focus on Deep Work]]
- [[JTBD - Import and Transform Data]]

### Features Used

- [[Data Exchange Hub]]
- [[Inbox]]
- [[Session Workspaces]]
- [[Canvas Integration]]
- [[User Hub]]

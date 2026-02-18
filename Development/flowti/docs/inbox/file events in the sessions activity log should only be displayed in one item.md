---
type: idea
stage: delivered
origin: inbox
domain: session
parent: "[[Session Workspaces PRD]]"
description: "Activity log shows one row per file event — too granular. Group by file path showing creation timestamp and modification count instead."
tags:
priority: 2 - high
rank:
planned_in: "[[Cycle 4 - Auto-Session and Activity Polish]]"
delivered_in: "[[Cycle 4 - Auto-Session and Activity Polish]]"
delivered_date: 2026-02-18
note: "Delivered in Cycle 4 Inc 2. groupActivityByFile() pure function groups SessionActivity entries by file path. Rows show file name, latest action badge, ×N count badge, timestamp."
---

Currently, every event gets tracked and displayed per action per file. This lets the activity log grow very big. We don't need it that granular. We just need the files in a list with information about creation and how many modifications during session.

**Plan:** Cycle 4 Inc 1 will group `SessionActivity` entries by file path in `SessionActivityPanel`. Each file shows one row with: file name, latest action badge, edit count (if > 1), and latest timestamp.

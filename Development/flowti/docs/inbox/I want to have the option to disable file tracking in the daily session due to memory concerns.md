---
type: UserStory
stage: partially-delivered
origin: inbox
domain: session
parent: "[[Session Workspaces PRD]]"
description: "Option to disable or limit file tracking in daily sessions for performance."
priority: "01 - medium"
note: "Daily session uses 30s dedup window (vs 1s for focused) to reduce noise. Activity log capped at 1000 entries. Global and per-session folder filters exist. Full disable toggle for daily tracking not yet implemented — users can disable enableDailySession entirely but cannot run daily session without tracking."
related:
  - "[[PBI-SW-007 Auto-Session and Session Nudges]]"
tags:
---

---
type: UserStory
feature: "[[Session Workspaces PRD]]"
stage: refined
priority: high
persona: Domain Architect
domain: Session
journey: Session Activity Tracking
jtbd: "When reviewing session activity, I want irrelevant folders hidden so I can focus on meaningful changes"
parent: "[[PBI-SW-001 Activity Log]]"
source: inbox
---

## User Story

As a vault user, I want to filter folders from appearing in my sessions activity log, so that I can focus on meaningful file activity without noise from system folders, templates, or other irrelevant paths.

### User Pains

- Activity logs show every file change, including system folders (.obsidian, node_modules, templates)
- No way to distinguish signal from noise during a focused session
- Different sessions work in different vault areas — a global filter alone isn't enough
- Reviewing session outcomes is tedious when cluttered with irrelevant entries

### User Needs

- Configure general folder filters that apply to all sessions (global exclusion list)
- Configure per-session folder filters independently (scoped to a specific workspace area)
- Filters should apply to the activity log display, not to artifact tracking
- Easy to add/remove folders from filter lists

### Acceptance Criteria

```gherkin
Scenario: Configure global folder filters
  Given I am in the plugin settings
  When I add "templates/" and ".obsidian/" to the global session folder filter
  Then no session activity log shows changes from those folders

Scenario: Configure per-session folder filters
  Given I have an active session focused on "src/domain/"
  When I add "src/ui/" to this session's folder filter
  Then only changes within "src/domain/" appear in the activity log

Scenario: Per-session filters extend global filters
  Given global filters exclude ".obsidian/"
  And this session filters exclude "docs/"
  Then the activity log excludes both ".obsidian/" and "docs/"
```

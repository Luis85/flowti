---
type: UserStory
feature: "[[Hubs PRD]]"
stage: refined
priority: high
persona: Domain Architect
relates_to: "[[PBI-002 Documentation Sessions]]"
tags:
  - sessions
  - focus
  - preparation
---

# I want to prepare a working session, so that I can focus on one task at a time

## User Story

As a **domain architect**, I want to **prepare a working session with goals, notes, and a focus file** so that I can **focus on one task at a time** and track what I accomplished.

## User Pains

- Starting a session today means setting a timer and working — there's no structure for **what** I want to accomplish
- No way to define goals before starting, so sessions feel aimless
- Notes taken during a session are scattered across files with no link back to the session
- The focus file is just a reference — there's no dedicated workspace that brings everything together
- After completing a session, I can't see what goals I achieved vs what remains

## User Needs

- **Pre-session preparation**: Define 1-5 concrete goals before starting (e.g., "Review types.ts", "Update events.ts", "Write tests")
- **Focused workspace**: A dedicated view during the session that shows my timer, goals, notes, and focus file in one place — no distractions
- **In-session notes**: A persistent notes area where I capture thoughts, decisions, and observations as I work
- **Goal tracking**: Check off goals as I complete them; see progress (2/5) at a glance
- **Post-session review**: See which goals were completed, total time spent, and artifacts produced

## Solution Statement

### Use Cases

#### Prepare a session with goals
- User opens NewSessionModal → enters title, type, duration, focus file
- User adds 3 goals: "Review types.ts", "Update events.ts", "Write tests"
- Session is created in "prepared" status with goals attached

#### Work in a focused workspace
- User starts a session → SessionWorkspaceView auto-opens as a dedicated leaf
- Focus file opens in an adjacent split leaf
- Workspace shows: countdown timer, goals checklist, notes textarea, artifacts list
- User checks off goals as they work, types notes, creates files (auto-tracked as artifacts)

#### Complete and review
- Timer completes (or user clicks Complete) → session marked as completed
- Workspace shows final state: 2/3 goals completed, notes preserved, 5 artifacts listed
- Sessions tab shows the same data in the detail panel

### Gherkin

```gherkin
Feature: Session Preparation and Focus

  Scenario: Prepare a session with goals
    Given I open the NewSessionModal
    When I enter a title, type, duration, and add 3 goals
    And I click "Create"
    Then a session is created in "prepared" status
    And the session has 3 goals with completed=false

  Scenario: Work in the session workspace
    Given I have a prepared session with goals and a focus file
    When I click "Start"
    Then the SessionWorkspaceView opens in a new leaf
    And the focus file opens in an adjacent split leaf
    And I see the countdown timer, goals checklist, notes area, and artifacts list

  Scenario: Track goal progress during session
    Given I have an active session with 3 goals
    When I check off the first goal
    Then the goal shows as completed with a timestamp
    And the goals header shows "1/3"

  Scenario: Take notes during session
    Given I have an active session
    When I type notes in the workspace notes area
    Then the notes are saved automatically after 500ms
    And the notes persist on the session after completion

  Scenario: Review completed session
    Given I have completed a session with 2/3 goals done
    When I view the session in the Sessions tab
    Then I see the goals with completion status
    And I see the notes, timeline, and artifacts
```

## Acceptance Criteria

- [ ] Can add goals to a session during creation (NewSessionModal)
- [ ] Goals appear as a checklist in the session detail panel
- [ ] Can check/uncheck goals during active and paused sessions
- [ ] Notes can be edited inline and are auto-saved
- [ ] SessionWorkspaceView opens as a dedicated leaf with timer, goals, notes, focus file, artifacts
- [ ] Workspace auto-opens when a session is started
- [ ] Focus file opens in adjacent leaf when workspace opens
- [ ] Goals carry forward on session rerun (unchecked)
- [ ] Goal texts saved in session templates
- [ ] Existing sessions without goals load without errors (backward compat)

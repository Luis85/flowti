---
type: ProductBacklogItem
feature: "[[Onboarding PRD]]"
priority: medium
stage: planned
dependencies:
  - "[[PBI-ONB-001 Post-Install Supplier Dashboard]]"
tags:
  - onboarding
  - installer
  - ux
planned_in: "[[Cycle 45 - Supplier Manager Onboarding]]"
user_story: "[[As Supplier-Manager, I want a seamless onboarding]]"
---

## User Story - Problemspace

As a new user completing the Flowti installer wizard, I want to be guided directly to the pre-built dashboard with a clear call-to-action so that I experience value immediately instead of guessing what to do next.

### User Pains

- Wizard completion page shows generic developer-oriented next steps ("Open the Event Catalog", "Define event definitions")
- A business user (Supplier Manager) does not know what "event definitions" or "subscriptions" mean
- After clicking "Close", user lands in the vault with no direction — must discover Analytics Hub manually
- The gap between install and first productive action is too large

### User Needs

- Supplier-relevant guidance on the completion page
- A primary action button that takes the user directly to the Analytics Hub with the seeded dashboard
- Clear, non-technical next steps that a Supplier Manager can follow

## Solutionstatement

### Functional Requirements

- [ ] Replace generic "What to do next" bullets with supplier-relevant guidance
- [ ] Add "Explore Your Dashboard" as primary button (`ft-btn-primary`)
- [ ] "Explore Your Dashboard" emits `ui.openAnalyticsHub` event and closes the modal
- [ ] Change "Close" to secondary button (`ft-btn-secondary`)
- [ ] Retry button on failure path remains unchanged

### Technical Requirements

- Changes confined to `InstallerWizardModal.renderCompletePage()` success path (lines 330-383)
- Uses existing `this.eventBus` (constructor-injected) — no new wiring needed
- Emits `ui.openAnalyticsHub` event already handled by UiCommandService

## Acceptance Criteria

- [ ] Completion page shows 4 supplier-relevant guidance bullets
- [ ] "Explore Your Dashboard" is primary, "Close" is secondary
- [ ] Clicking "Explore Your Dashboard" opens Analytics Hub and closes modal
- [ ] Failure path with Retry button unchanged
- [ ] `npm test` passes

## Related

- PRD: [[Onboarding PRD]]
- Depends on: [[PBI-ONB-001 Post-Install Supplier Dashboard]]
- Inbox: [[The Onboarding and Installation UX is lacking]]
- Cycle: [[Cycle 45 - Supplier Manager Onboarding]]

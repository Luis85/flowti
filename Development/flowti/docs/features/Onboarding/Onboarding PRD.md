---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: draft
related_events: []
maturity: L1
business_value: 4
implementation_cost: 3
maintenance_cost: 2
discovery_cost: 2
design_cost: 3
test_cost: 2
priority: 3
---

# Onboarding PRD

## 1. Problem Statement

After the Installer completes its first-run setup (user profile, folder scaffolding), new users are left without guidance on what to do next. The vault is structurally ready but the user does not know how to use Flowti's features -- event catalog, data exchange, documentation tabs, subscriptions, or ingestion. Without progressive onboarding, users explore randomly, miss key features, and fail to build productive habits. The gap between "installed" and "productive" needs to be bridged.

## 2. Outcome

New users receive guided, contextual onboarding that introduces Flowti's core features progressively. Rather than a single tutorial dump, the onboarding system surfaces tips, walkthroughs, and suggested actions at the right moment -- when the user first opens a view, creates their first flow, or imports their first CSV. Users reach productivity faster and discover features they would otherwise miss.

## 3. Scope

### In Scope

- Post-installer welcome guide or getting-started checklist
- Contextual tooltips or callouts on first visit to each major view
- Progressive feature discovery (introduce features as user is ready)
- Onboarding state tracking (which tips have been seen/dismissed)
- "Getting Started" checklist with suggested first actions
- Ability to reset/replay onboarding from Settings
- Integration with Installer completion event

### Out of Scope

- Interactive product tours with overlay highlighting
- Video tutorials or embedded media
- AI-powered personalized onboarding paths
- Onboarding for custom/third-party steps
- Multi-language onboarding content
- Analytics or telemetry on onboarding completion

## 4. UX Entry Points

The user must be able to pause or resume to the on-boarding at any given time. He can also skip the on-boarding after installation.

- **Post-installer**: Onboarding activates after `installer.completed` event
- **Event Catalog view**: First-visit callout explaining tabs and navigation
- **Data Exchange Hub**: First-visit callout explaining import/export workflow
- **Settings**: "Reset onboarding" button to replay all tips
- **Status bar or notice**: "Getting Started" checklist accessible from plugin UI

## 5. Functional Requirements

- [ ] Listen to `installer.completed` event to trigger onboarding start
- [ ] Display a "Getting Started" checklist with 5-7 suggested first actions
- [ ] Show contextual callouts on first visit to: Event Catalog, Data Exchange Hub, Documentation tabs, Settings
- [ ] Track which onboarding steps have been completed or dismissed
- [ ] Persist onboarding state so dismissed tips do not reappear
- [ ] Allow users to reset onboarding from Settings
- [ ] Provide non-intrusive UI (dismissible callouts, not blocking modals)
- [ ] Mark checklist items as complete when the user performs the associated action

## 6. Data Model Impact

| Entity | Fields | Storage |
|--------|--------|---------|
| `OnboardingState` | completedSteps (string[]), dismissedTips (string[]), startedAt (timestamp) | `onboarding` storage key |
| `OnboardingStep` | id, title, description, trigger (event or view), action (suggested) | Constant definition |
| `OnboardingTip` | id, targetView, content, dismissible | Constant definition |

## 7. Event Impact

### Produced

- `onboarding.started` -- Onboarding activated after installer
- `onboarding.step.completed` -- User completed a checklist action
- `onboarding.tip.dismissed` -- User dismissed a contextual tip
- `onboarding.completed` -- All checklist items completed
- `onboarding.reset` -- Onboarding state reset from Settings

### Consumed

- `installer.completed` -- Triggers onboarding activation
- View lifecycle events -- Detects first visit to views for contextual tips

## 8. UI Layout Impact

- **Getting Started checklist**: Small panel or modal accessible from the main view
- **Contextual callouts**: Non-blocking banners at the top of views on first visit
- **Settings addition**: "Reset onboarding" button in Flowti settings
- **Checklist items**: Checkbox list with action descriptions and status indicators

## 9. Adapter Impact

- `OnboardingService`: State management, step tracking, tip tracking, persistence
- `IStorageProvider`: Persists `OnboardingState` under `onboarding` key
- View integration: Each major view checks onboarding state to show/hide first-visit callouts
- EventBus listener: Subscribes to `installer.completed` and user action events

## 10. Non-Functional Requirements

- Onboarding UI must not block user workflow (dismissible, non-modal)
- State persistence must survive plugin reload
- Callouts must render within 100ms of view open
- Onboarding must degrade gracefully if installer was skipped (manual setup)
- Total onboarding content must be completable within 10 minutes

## 11. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Users find onboarding annoying or intrusive | High | Make all tips dismissible; keep content concise |
| Onboarding tips become stale as features evolve | Medium | Co-locate tip content with feature code; review on feature changes |
| Installer skipped (manual setup) leaves onboarding in limbo | Medium | Allow manual onboarding trigger from Settings |
| Too many tips overwhelm the user | Medium | Progressive disclosure; max 1 tip per view visit |

## 12. Acceptance Criteria

- [ ] After installer completes, a "Getting Started" checklist appears
- [ ] First visit to Event Catalog shows a contextual callout
- [ ] First visit to Data Exchange Hub shows a contextual callout
- [ ] Dismissing a tip persists -- it does not reappear on next visit
- [ ] Completing a checklist action marks it as done
- [ ] "Reset onboarding" in Settings restores all tips and checklist items
- [ ] Onboarding does not block any user workflow
- [ ] Onboarding state survives plugin reload

## 13. Definition of Done

- All acceptance criteria verified manually
- OnboardingService unit tested (state transitions, persistence, reset)
- Contextual tip rendering tested
- Integration with installer.completed event tested
- `npm run build` passes (vitest, tsc, eslint, esbuild)

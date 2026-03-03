---
type: ToolReference
date: "2026-03-03T08:40:30.943Z"
total_tools: 30
categories: 7
tags: 
  - assert
  - feedback
  - interactive
  - lifecycle
  - logging
  - navigation
---
# Journey Runner Tool Reference

> [!info] Summary
> Total tools: **30** | Categories: **7**
> Tags: `assert` `feedback` `interactive` `lifecycle` `logging` `navigation`

---

## Quick Reference

| Tool | Description | Tags |
|------|-------------|------|
| `command` | Execute an Obsidian command by ID |  |
| `click` | Click a DOM element by CSS selector |  |
| `input` | Type text into an input field |  |
| `highlight` | Add visual CSS annotation to a DOM element |  |
| `wait` | Pause execution for a specified duration |  |
| `screenshot` | Capture a labeled screenshot of the current state |  |
| `navigate` | Navigate to a hub tab via the EventBus |  |
| `assert` | Validate DOM, event, or eval state |  |
| `emit` | Emit an event on the plugin EventBus |  |
| `eval` | Execute JavaScript in Obsidian and optionally store the result |  |
| `manual` | Document a human QA checkpoint |  |
| `notice` | Display an Obsidian notice toast message |  |
| `theme` | Switch Obsidian's CSS theme |  |
| `ribbon` | Click a ribbon button by aria-label with visual highlight |  |
| `create-file` | Create a file in the vault via the Obsidian API | `lifecycle` |
| `delete-file` | Delete a vault file via the Obsidian API | `lifecycle` |
| `open-file` | Open a vault file in an editor tab | `lifecycle` |
| `open-url` | Open a URL in the Obsidian WebViewer via CLI 'web' command | `lifecycle` |
| `close-leaves` | Close all workspace leaves of a given view type | `lifecycle` |
| `close-modals` | Close all open Obsidian modals and dialogs | `lifecycle` |
| `seed` | Create, verify, or delete seed files from the centralized registry | `lifecycle` |
| `set-input` | Set an input value using React-compatible native setter with input/change events |  |
| `frontmatter` | Read or set YAML frontmatter properties on a vault file |  |
| `query-trace` | Query the E2E event trace for events of a specific type |  |
| `write-run-log` | Append a line to the E2E Test Run log file at the vault root | `logging` |
| `visual-inspection` | Show a pass/fail notice for operator visual inspection; on fail, prompt for reason | `interactive` |
| `scroll-to` | Scroll an element into view in the DOM or inside a webview | `navigation` |
| `assert-text` | Assert that an element's text content contains an expected string | `assert` |
| `assert-number` | Assert that an element's text content parses to a number matching a comparison | `assert` |
| `spinner` | Show or hide a persistent loading spinner notice | `feedback` |

---

## General Tools

### `assert`

> Validate DOM, event, or eval state

**When to use**:

- Check element visibility or absence (visible, not-visible)
- Verify text content of a DOM element (text)
- Confirm an event was emitted with expected payload (event)
- Assert a workspace leaf exists by view type (leaf)
- Evaluate a JavaScript expression and compare result (eval)

### `click`

> Click a DOM element by CSS selector

**When to use**:

- Dismiss a modal or dialog
- Select a template card or list item
- Press a button in the UI

### `command`

> Execute an Obsidian command by ID

**When to use**:

- Open a hub view via command palette
- Trigger plugin commands (e.g. start session, open settings)
- Execute built-in Obsidian commands

### `emit`

> Emit an event on the plugin EventBus

**When to use**:

- Trigger domain event handlers (e.g. session.pause)
- Simulate user actions via events
- Test event-driven workflows with custom payloads

### `eval`

> Execute JavaScript in Obsidian and optionally store the result

**When to use**:

- Query plugin state (e.g. active session, settings)
- Store values for cross-step variable passing
- Perform complex operations not covered by other tools

### `frontmatter`

> Read or set YAML frontmatter properties on a vault file

**When to use**:

- Set a frontmatter property for test setup (mode: set)
- Read a frontmatter value into a variable for downstream assertions (mode: read)
- Verify frontmatter was updated by a previous step

### `highlight`

> Add visual CSS annotation to a DOM element

**When to use**:

- Annotate UI elements for screenshot documentation
- Draw attention to active tab or selected item (element style)
- Show button interaction targets with animated pulse (button style)
- Indicate input focus state with glow effect (input style)

### `input`

> Type text into an input field

**When to use**:

- Fill a form field (e.g. session goal, file name)
- Enter a search query in the command palette
- Type filter text in a hub search bar

### `manual`

> Document a human QA checkpoint

**When to use**:

- Visual regression review (compare screenshots to expected layout)
- Verify content correctness that automated assertions can't check
- Cross-reference multiple screenshots within a step

### `navigate`

> Navigate to a hub tab via the EventBus

**When to use**:

- Switch tabs within a hub view
- Verify hub.tab.changed events in the event trace
- Set up a specific tab context before testing its content

### `notice`

> Display an Obsidian notice toast message

**When to use**:

- Annotate test progress in screenshots (e.g. 'Step 3/10')
- Show step status or summary for visual documentation
- Display interpolated variable values for debugging

### `query-trace`

> Query the E2E event trace for events of a specific type

**When to use**:

- Retrieve events emitted during a step for variable interpolation
- Count how many times a specific event was emitted
- Extract event payloads for cross-step data passing

### `ribbon`

> Click a ribbon button by aria-label with visual highlight

**When to use**:

- Click a ribbon sidebar icon to open a hub view
- Demonstrate ribbon button interaction with purple pulse highlight
- Verify ribbon buttons are accessible and clickable

### `screenshot`

> Capture a labeled screenshot of the current state

**When to use**:

- Document UI state for journey reports and canvases
- Create before/after comparisons (e.g. theme switching)
- Capture transient UI states (modals, notices, highlights)

### `set-input`

> Set an input value using React-compatible native setter with input/change events

**When to use**:

- Set values on React-controlled inputs where insertText doesn't propagate
- Update input fields that use synthetic event handlers
- Set values on textarea or input elements with proper event dispatch

### `theme`

> Switch Obsidian's CSS theme

**When to use**:

- Dark/light mode comparison screenshots
- Verify theme-aware styling in Flowti components
- Set a consistent baseline theme before screenshot capture

### `wait`

> Pause execution for a specified duration

**When to use**:

- Wait for async rendering or DOM updates to settle
- Allow theme transition CSS animations to complete
- Give Obsidian time to index a newly created file

---

## Assert Tools

### `assert-number`

> Assert that an element's text content parses to a number matching a comparison

**Tags**: `assert`

**When to use**:

- Verify a count badge shows at least N items (gte)
- Assert a KPI card value equals a specific number (eq)
- Check that a progress indicator is below a threshold (lt, lte)

### `assert-text`

> Assert that an element's text content contains an expected string

**Tags**: `assert`

**When to use**:

- Verify a counter or label shows the expected text (e.g. 'Step 1 of 3')
- Check that a heading, badge, or status message contains expected content
- Safer alternative to assert type:text — requires 'contains' field, preventing field-name mistakes

---

## Feedback Tools

### `spinner`

> Show or hide a persistent loading spinner notice

**Tags**: `feedback`

**When to use**:

- Indicate a long-running operation is in progress
- Show a spinner before a multi-action sequence and dismiss it when done
- Give the operator visual feedback while waiting for async work

---

## Interactive Tools

### `visual-inspection`

> Show a pass/fail notice for operator visual inspection; on fail, prompt for reason

**Tags**: `interactive`

**When to use**:

- Verify visual layout or styling that cannot be asserted programmatically
- Confirm a rendered view matches design expectations
- Interactive QA gate with documented failure reason

---

## Lifecycle Tools

### `close-leaves`

> Close all workspace leaves of a given view type

**Tags**: `lifecycle`

**When to use**:

- Clean up hub views during teardown
- Reset workspace layout between journey sections
- Close stale leaves that persist across steps

### `close-modals`

> Close all open Obsidian modals and dialogs

**Tags**: `lifecycle`

**When to use**:

- Dismiss stale modals during teardown
- Reset UI state between journey steps
- Ensure a clean workspace before assertions

### `create-file`

> Create a file in the vault via the Obsidian API

**Tags**: `lifecycle`

**When to use**:

- Seed test data files during setup
- Create markdown or CSV content for journey steps to interact with
- Scaffold vault folder structure before testing

### `delete-file`

> Delete a vault file via the Obsidian API

**Tags**: `lifecycle`

**When to use**:

- Clean up test files during teardown
- Remove seed data after a journey completes
- Reset vault to pre-test state

### `open-file`

> Open a vault file in an editor tab

**Tags**: `lifecycle`

**When to use**:

- Open a created file for visual verification
- Navigate to a specific vault file before testing
- Set up editor state with a target file open

### `open-url`

> Open a URL in the Obsidian WebViewer via CLI 'web' command

**Tags**: `lifecycle`

**When to use**:

- Open external documentation or web resources during a journey
- Navigate to a web-based dashboard or API endpoint
- Verify WebViewer integration with external URLs

### `seed`

> Create, verify, or delete seed files from the centralized registry

**Tags**: `lifecycle`

**When to use**:

- Verify seed files exist in skip mode (mode: verify)
- Remove seed files before a fresh install (mode: delete)
- Repair missing seed files and folders (mode: create)

---

## Logging Tools

### `write-run-log`

> Append a line to the E2E Test Run log file at the vault root

**Tags**: `logging`

**When to use**:

- Log step results to E2E Test Run.md for live visibility
- Write chapter headers to structure the run log
- Record pass/fail details for post-run review

---

## Navigation Tools

### `scroll-to`

> Scroll an element into view in the DOM or inside a webview

**Tags**: `navigation`

**When to use**:

- Scroll to a specific section before taking a screenshot
- Bring a deeply nested element into the visible viewport
- Scroll inside a webview to reveal content below the fold

---

---
type: ToolReference
date: "2026-03-07T15:24:13.817Z"
total_tools: 35
categories: 7
tags:
  - assert
  - feedback
  - interactive
  - lifecycle
  - logging
  - navigation
  - performance
---

# Journey Runner Tool Reference

> [!info] Summary
> Total tools: **35** | Categories: **7**
> Tags: `assert` `feedback` `interactive` `lifecycle` `logging` `navigation` `performance`

> [!tip] Common field
> All tools accept an optional `description` field (string) for human-readable context in reports.

---

## Quick Reference

| Tool | Description | Tags |
|---|---|---|
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
| `copy-file` | Copy a file on the filesystem (absolute or vault-relative paths) | `lifecycle` |
| `move-file` | Move or rename a file on the filesystem (absolute or vault-relative paths) | `lifecycle` |
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
| `assert-value` | Assert that a form element's value matches an expected string | `assert` |
| `select` | Select an option from a <select> dropdown by value |  |
| `spinner` | Show or hide a persistent loading spinner notice | `feedback` |
| `parallel-group` | Batch multiple read-only assertions into a single subprocess eval call | `assert` `performance` |

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

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | Assertion type — `visible` \| `not-visible` \| `text` \| `event` \| `leaf` \| `eval` \| `count` \| `attr` |
| `selector` | `string` | No | CSS selector (for visible, not-visible, text, count, attr) |
| `contains` | `string` | No | Expected text substring (for text) |
| `event` | `string` | No | Event name (for event) |
| `payload` | `object` | No | Expected event payload fields (for event) |
| `viewType` | `string` | No | View type (for leaf) |
| `code` | `string` | No | JavaScript expression (for eval) |
| `expected` | `string` | No | Expected eval result (for eval) |
| `count` | `number` | No | Expected element count (for count) |
| `attr` | `string` | No | Attribute name (for attr) |
| `value` | `string` | No | Expected attribute value (for attr) |

**Examples**:

*Check element is visible*
```json
{
  "tool": "assert",
  "type": "visible",
  "selector": ".ft-hub"
}
```

*Verify event was emitted*
```json
{
  "tool": "assert",
  "type": "event",
  "event": "hub.tab.changed"
}
```

---

### `click`

> Click a DOM element by CSS selector

**When to use**:

- Dismiss a modal or dialog
- Select a template card or list item
- Press a button in the UI

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the element to click |

**Examples**:

*Click the primary action button*
```json
{
  "tool": "click",
  "selector": ".mod-cta"
}
```

*Select a list item by test ID*
```json
{
  "tool": "click",
  "selector": "[data-test-id='item-1']"
}
```

---

### `command`

> Execute an Obsidian command by ID

**When to use**:

- Open a hub view via command palette
- Trigger plugin commands (e.g. start session, open settings)
- Execute built-in Obsidian commands

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Command ID (e.g. "flowti:open-user-hub") |

**Examples**:

*Open the User Hub view*
```json
{
  "tool": "command",
  "id": "flowti:open-user-hub"
}
```

*Start a new session*
```json
{
  "tool": "command",
  "id": "flowti:start-session"
}
```

---

### `emit`

> Emit an event on the plugin EventBus

**When to use**:

- Trigger domain event handlers (e.g. session.pause)
- Simulate user actions via events
- Test event-driven workflows with custom payloads

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `event` | `string` | Yes | EventBus event name |
| `payload` | `object` | No | Event payload (string values support {{variable}} interpolation) |

**Examples**:

*Emit a tab change event*
```json
{
  "tool": "emit",
  "event": "hub.tab.changed",
  "payload": {
    "hub": "user-hub",
    "tab": "sessions"
  }
}
```

---

### `eval`

> Execute JavaScript in Obsidian and optionally store the result

**When to use**:

- Query plugin state (e.g. active session, settings)
- Store values for cross-step variable passing
- Perform complex operations not covered by other tools

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | Yes | JavaScript code to execute (supports {{variable}} interpolation) |
| `store` | `string` | No | Store the result in a named variable |
| `expect` | `object` | No | Assertion on the result: { type: "equals", value } | { type: "truthy" } | { type: "json", match } |

**Examples**:

*Store the event trace length*
```json
{
  "tool": "eval",
  "code": "window._e2eEventTrace.length",
  "store": "traceCount"
}
```

*Assert a boolean expression*
```json
{
  "tool": "eval",
  "code": "window._flowtiInstalled === true",
  "expect": {
    "type": "truthy"
  }
}
```

---

### `frontmatter`

> Read or set YAML frontmatter properties on a vault file

**When to use**:

- Set a frontmatter property for test setup (mode: set)
- Read a frontmatter value into a variable for downstream assertions (mode: read)
- Verify frontmatter was updated by a previous step

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Vault-relative path of the file (supports {{variable}}) |
| `mode` | `string` | Yes | Operation mode — `set` \| `read` |
| `property` | `string` | Yes | Frontmatter property name |
| `value` | `string` | No | Property value (for "set" mode, supports {{variable}}) |
| `store` | `string` | No | Store the read value in a named variable (for "read" mode) |

**Examples**:

*Set a frontmatter property*
```json
{
  "tool": "frontmatter",
  "path": "file.md",
  "mode": "set",
  "property": "status",
  "value": "active"
}
```

*Read a frontmatter value into a variable*
```json
{
  "tool": "frontmatter",
  "path": "file.md",
  "mode": "read",
  "property": "status",
  "store": "fileStatus"
}
```

---

### `highlight`

> Add visual CSS annotation to a DOM element

**When to use**:

- Annotate UI elements for screenshot documentation
- Draw attention to active tab or selected item (element style)
- Show button interaction targets with animated pulse (button style)
- Indicate input focus state with glow effect (input style)

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the element to highlight |
| `style` | `string` | No | Highlight style (default: "element") — `element` \| `button` \| `input` |
| `target` | `string` | No | DOM context (default: "dom") — `dom` \| `webview` |
| `duration` | `number` | No | Auto-remove after this many ms (omit to persist) |

**Examples**:

*Highlight the active tab*
```json
{
  "tool": "highlight",
  "selector": ".ft-tab.is-active",
  "style": "element"
}
```

*Pulse a button target*
```json
{
  "tool": "highlight",
  "selector": ".ft-btn-primary",
  "style": "button"
}
```

---

### `input`

> Type text into an input field

**When to use**:

- Fill a form field (e.g. session goal, file name)
- Enter a search query in the command palette
- Type filter text in a hub search bar

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the input element |
| `value` | `string` | Yes | Text to type into the input |

**Examples**:

*Type a search query*
```json
{
  "tool": "input",
  "selector": "[data-test-id='search']",
  "value": "analytics"
}
```

---

### `manual`

> Document a human QA checkpoint

**When to use**:

- Visual regression review (compare screenshots to expected layout)
- Verify content correctness that automated assertions can't check
- Cross-reference multiple screenshots within a step

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `instruction` | `string` | Yes | What the operator should do manually |
| `timeout` | `number` | No | Timeout in ms before auto-failing (default: 300000) |
| `interactive` | `boolean` | No | If false, auto-approve — appears only on reports (default: true) |

**Examples**:

*Visual regression checkpoint*
```json
{
  "tool": "manual",
  "instruction": "Verify the dashboard layout matches the design mockup"
}
```

---

### `navigate`

> Navigate to a hub tab via the EventBus

**When to use**:

- Switch tabs within a hub view
- Verify hub.tab.changed events in the event trace
- Set up a specific tab context before testing its content

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `hub` | `string` | Yes | Hub ID (e.g. "flowti-user-hub") |
| `viewType` | `string` | Yes | View type (e.g. "flowti-user-hub") |
| `tab` | `string` | Yes | Tab ID (e.g. "sessions") |

**Examples**:

*Switch to the Sessions tab*
```json
{
  "tool": "navigate",
  "hub": "flowti-user-hub",
  "viewType": "flowti-user-hub",
  "tab": "sessions"
}
```

---

### `notice`

> Display an Obsidian notice toast message

**When to use**:

- Annotate test progress in screenshots (e.g. 'Step 3/10')
- Show step status or summary for visual documentation
- Display interpolated variable values for debugging

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | Message to display (supports {{variable}} interpolation) |
| `duration` | `number` | No | Duration in ms (default: 5000) |
| `style` | `string` | No | Visual style — `success` \| `error` |

**Examples**:

*Show step progress*
```json
{
  "tool": "notice",
  "message": "Step 3/10 — Verifying tabs"
}
```

*Show a success message*
```json
{
  "tool": "notice",
  "message": "All checks passed!",
  "style": "success"
}
```

---

### `query-trace`

> Query the E2E event trace for events of a specific type

**When to use**:

- Retrieve events emitted during a step for variable interpolation
- Count how many times a specific event was emitted
- Extract event payloads for cross-step data passing

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `event` | `string` | Yes | Event type to search for (supports {{variable}}) |
| `limit` | `number` | No | Maximum number of events to return (default: 10) |
| `store` | `string` | No | Store the JSON result in a named variable |

**Examples**:

*Query emitted tab-change events*
```json
{
  "tool": "query-trace",
  "event": "hub.tab.changed",
  "store": "tabEvents"
}
```

---

### `ribbon`

> Click a ribbon button by aria-label with visual highlight

**When to use**:

- Click a ribbon sidebar icon to open a hub view
- Demonstrate ribbon button interaction with purple pulse highlight
- Verify ribbon buttons are accessible and clickable

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | Yes | Text to match against the ribbon button's aria-label (partial match) |

**Examples**:

*Click the Flowti ribbon button*
```json
{
  "tool": "ribbon",
  "label": "Open Flowti"
}
```

---

### `screenshot`

> Capture a labeled screenshot of the current state

**When to use**:

- Document UI state for journey reports and canvases
- Create before/after comparisons (e.g. theme switching)
- Capture transient UI states (modals, notices, highlights)

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | No | Label for filename: {stepId}--{label}.png (auto-numbered if omitted) |

**Examples**:

*Capture the hub overview*
```json
{
  "tool": "screenshot",
  "label": "hub-overview"
}
```

---

### `select`

> Select an option from a <select> dropdown by value

**When to use**:

- Choose a tool from a grouped select picker
- Select a swimlane, category, or type from a dropdown
- Set a dropdown value with proper change event dispatch

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the <select> element |
| `value` | `string` | Yes | The option value to select |

**Examples**:

*Select a dropdown option*
```json
{
  "tool": "select",
  "selector": "[data-test-id='tool-select']",
  "value": "click"
}
```

---

### `set-input`

> Set an input value using React-compatible native setter with input/change events

**When to use**:

- Set values on React-controlled inputs where insertText doesn't propagate
- Update input fields that use synthetic event handlers
- Set values on textarea or input elements with proper event dispatch

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the input element |
| `value` | `string` | Yes | Value to set (supports {{variable}}) |
| `dispatchEvent` | `boolean` | No | Dispatch input/change events (default: true) |

**Examples**:

*Set a form field value*
```json
{
  "tool": "set-input",
  "selector": "[data-test-id='name']",
  "value": "My Session"
}
```

---

### `theme`

> Switch Obsidian's CSS theme

**When to use**:

- Dark/light mode comparison screenshots
- Verify theme-aware styling in Flowti components
- Set a consistent baseline theme before screenshot capture

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `theme` | `string` | Yes | Theme name ("obsidian" for dark, "moonstone" for light) |

**Examples**:

*Switch to dark mode*
```json
{
  "tool": "theme",
  "theme": "obsidian"
}
```

*Switch to light mode*
```json
{
  "tool": "theme",
  "theme": "moonstone"
}
```

---

### `wait`

> Pause execution for a specified duration

**When to use**:

- Wait for async rendering or DOM updates to settle
- Allow theme transition CSS animations to complete
- Give Obsidian time to index a newly created file

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `ms` | `number` | Yes | Milliseconds to wait |

**Examples**:

*Wait for UI to settle*
```json
{
  "tool": "wait",
  "ms": 500
}
```

---

## Assert Tools

### `assert-number`

> Assert that an element's text content parses to a number matching a comparison

**Tags**: `assert`

**When to use**:

- Verify a count badge shows at least N items (gte)
- Assert a KPI card value equals a specific number (eq)
- Check that a progress indicator is below a threshold (lt, lte)

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the element whose textContent is parsed as a number |
| `operator` | `string` | Yes | Comparison operator — `eq` \| `gt` \| `gte` \| `lt` \| `lte` |
| `value` | `number` | Yes | Value to compare against |

**Examples**:

*Check count is at least 5*
```json
{
  "tool": "assert-number",
  "selector": ".ft-count",
  "operator": "gte",
  "value": 5
}
```

---

### `assert-text`

> Assert that an element's text content contains an expected string

**Tags**: `assert`

**When to use**:

- Verify a counter or label shows the expected text (e.g. 'Step 1 of 3')
- Check that a heading, badge, or status message contains expected content
- Safer alternative to assert type:text — requires 'contains' field, preventing field-name mistakes

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the element to check |
| `contains` | `string` | Yes | Expected text (checked via textContent.includes) |

**Examples**:

*Verify label text*
```json
{
  "tool": "assert-text",
  "selector": ".ft-badge",
  "contains": "3 items"
}
```

---

### `assert-value`

> Assert that a form element's value matches an expected string

**Tags**: `assert`

**When to use**:

- Verify an input or textarea contains the expected value after set-input
- Check that a select dropdown has the correct selected option
- Confirm form field values are populated correctly after loading data

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the input, textarea, or select element |
| `equals` | `string` | No | Expected exact value (el.value === expected) |
| `contains` | `string` | No | Expected substring (el.value.includes(substr)) |

**Examples**:

*Verify input value matches exactly*
```json
{
  "tool": "assert-value",
  "selector": "input[data-test-id='name']",
  "equals": "My Journey"
}
```

*Check textarea contains text*
```json
{
  "tool": "assert-value",
  "selector": "textarea.description",
  "contains": "step"
}
```

---

### `parallel-group`

> Batch multiple read-only assertions into a single subprocess eval call

**Tags**: `assert` `performance`

**When to use**:

- Batch visibility checks for a group of UI elements
- Run multiple independent assertions in one CLI call to reduce IPC overhead
- Get all-at-once failure reporting instead of stopping at the first failure

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `actions` | `array` | Yes | Array of read-only assertion sub-actions (assert, assert-text, assert-number, assert-value, eval without store) |

**Examples**:

*Batch visibility assertions*
```json
{
  "tool": "parallel-group",
  "description": "Verify form elements",
  "actions": [
    {
      "tool": "assert",
      "type": "visible",
      "selector": "[data-test-id='form']"
    },
    {
      "tool": "assert",
      "type": "visible",
      "selector": "[data-test-id='submit-btn']"
    }
  ]
}
```

---

## Feedback Tools

### `spinner`

> Show or hide a persistent loading spinner notice

**Tags**: `feedback`

**When to use**:

- Indicate a long-running operation is in progress
- Show a spinner before a multi-action sequence and dismiss it when done
- Give the operator visual feedback while waiting for async work

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique ID to match start/stop pairs |
| `mode` | `string` | Yes | Show or dismiss the spinner — `start` \| `stop` |
| `message` | `string` | No | Message shown alongside the spinner (start only, supports {{variable}}) |

**Examples**:

*Show a loading spinner*
```json
{
  "tool": "spinner",
  "id": "load",
  "mode": "start",
  "message": "Loading data..."
}
```

*Dismiss the spinner*
```json
{
  "tool": "spinner",
  "id": "load",
  "mode": "stop"
}
```

---

## Interactive Tools

### `visual-inspection`

> Show a pass/fail notice for operator visual inspection; on fail, prompt for reason

**Tags**: `interactive`

**When to use**:

- Verify visual layout or styling that cannot be asserted programmatically
- Confirm a rendered view matches design expectations
- Interactive QA gate with documented failure reason

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `prompt` | `string` | Yes | Prompt describing what to inspect (supports {{variable}}) |
| `timeout` | `number` | No | Timeout in ms before auto-failing (default: 300000) |
| `interactive` | `boolean` | No | If false, auto-approve — appears only on reports (default: true) |

**Examples**:

*Interactive visual QA gate*
```json
{
  "tool": "visual-inspection",
  "prompt": "Does the dashboard layout match the design?"
}
```

---

## Lifecycle Tools

### `close-leaves`

> Close all workspace leaves of a given view type

**Tags**: `lifecycle`

**When to use**:

- Clean up hub views during teardown
- Reset workspace layout between journey sections
- Close stale leaves that persist across steps

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `viewType` | `string` | Yes | View type of leaves to close (e.g. "flowti-user-hub") |

**Examples**:

*Close all User Hub leaves*
```json
{
  "tool": "close-leaves",
  "viewType": "flowti-user-hub"
}
```

---

### `close-modals`

> Close all open Obsidian modals and dialogs

**Tags**: `lifecycle`

**When to use**:

- Dismiss stale modals during teardown
- Reset UI state between journey steps
- Ensure a clean workspace before assertions

*No parameters — use as-is.*

**Examples**:

*Dismiss all open modals*
```json
{
  "tool": "close-modals"
}
```

---

### `copy-file`

> Copy a file on the filesystem (absolute or vault-relative paths)

**Tags**: `lifecycle`

**When to use**:

- Duplicate a seed file to a new location during setup
- Back up a file before modifying it in a test
- Copy files between vault and non-vault locations

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `string` | Yes | Source file path — absolute or vault-relative (supports {{variable}}) |
| `to` | `string` | Yes | Destination file path — absolute or vault-relative (supports {{variable}}) |

**Examples**:

*Copy a file within the vault*
```json
{
  "tool": "copy-file",
  "from": "templates/default.md",
  "to": "test/copy.md"
}
```

*Copy from an absolute path*
```json
{
  "tool": "copy-file",
  "from": "C:/backups/config.json",
  "to": "test/config.json"
}
```

---

### `create-file`

> Create a file in the vault via the Obsidian API

**Tags**: `lifecycle`

**When to use**:

- Seed test data files during setup
- Create markdown or CSV content for journey steps to interact with
- Scaffold vault folder structure before testing

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Vault-relative path for the new file (supports {{variable}}) |
| `content` | `string` | Yes | File content (supports {{variable}}) |
| `store` | `string` | No | Store the created path in a named variable |

**Examples**:

*Create a test markdown file*
```json
{
  "tool": "create-file",
  "path": "test/sample.md",
  "content": "# Sample\nTest content"
}
```

---

### `delete-file`

> Delete a vault file via the Obsidian API

**Tags**: `lifecycle`

**When to use**:

- Clean up test files during teardown
- Remove seed data after a journey completes
- Reset vault to pre-test state

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Vault-relative path of the file to delete (supports {{variable}}) |

**Examples**:

*Clean up a test file*
```json
{
  "tool": "delete-file",
  "path": "test/sample.md"
}
```

---

### `move-file`

> Move or rename a file on the filesystem (absolute or vault-relative paths)

**Tags**: `lifecycle`

**When to use**:

- Rename a file during test setup or teardown
- Move files between vault and non-vault locations
- Relocate generated artifacts to a different folder

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `string` | Yes | Source file path — absolute or vault-relative (supports {{variable}}) |
| `to` | `string` | Yes | Destination file path — absolute or vault-relative (supports {{variable}}) |

**Examples**:

*Rename a file*
```json
{
  "tool": "move-file",
  "from": "test/draft.md",
  "to": "test/final.md"
}
```

*Move a file to an absolute path*
```json
{
  "tool": "move-file",
  "from": "test/export.csv",
  "to": "C:/exports/export.csv"
}
```

---

### `open-file`

> Open a vault file in an editor tab

**Tags**: `lifecycle`

**When to use**:

- Open a created file for visual verification
- Navigate to a specific vault file before testing
- Set up editor state with a target file open

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `path` | `string` | Yes | Vault-relative path of the file to open (supports {{variable}}) |

**Examples**:

*Open a vault file in the editor*
```json
{
  "tool": "open-file",
  "path": "test/sample.md"
}
```

---

### `open-url`

> Open a URL in the Obsidian WebViewer via CLI 'web' command

**Tags**: `lifecycle`

**When to use**:

- Open external documentation or web resources during a journey
- Navigate to a web-based dashboard or API endpoint
- Verify WebViewer integration with external URLs

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | Yes | URL to open (supports {{variable}}) |

**Examples**:

*Open an external URL*
```json
{
  "tool": "open-url",
  "url": "https://docs.example.com"
}
```

---

### `seed`

> Create, verify, or delete seed files from the centralized registry

**Tags**: `lifecycle`

**When to use**:

- Verify seed files exist in skip mode (mode: verify)
- Remove seed files before a fresh install (mode: delete)
- Repair missing seed files and folders (mode: create)

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Seed file identifier (e.g. "welcome-note", "all", "folders") |
| `mode` | `string` | No | Operation mode (default: "create") — `create` \| `verify` \| `delete` |

**Examples**:

*Create all seed data*
```json
{
  "tool": "seed",
  "id": "all",
  "mode": "create"
}
```

*Verify seed files exist*
```json
{
  "tool": "seed",
  "id": "all",
  "mode": "verify"
}
```

---

## Logging Tools

### `write-run-log`

> Append a line to the E2E Test Run log file at the vault root

**Tags**: `logging`

**When to use**:

- Log step results to E2E Test Run.md for live visibility
- Write chapter headers to structure the run log
- Record pass/fail details for post-run review

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `message` | `string` | Yes | Log line to append (supports {{variable}}) |

**Examples**:

*Write a chapter header*
```json
{
  "tool": "write-run-log",
  "message": "## Chapter 1: Setup"
}
```

---

## Navigation Tools

### `scroll-to`

> Scroll an element into view in the DOM or inside a webview

**Tags**: `navigation`

**When to use**:

- Scroll to a specific section before taking a screenshot
- Bring a deeply nested element into the visible viewport
- Scroll inside a webview to reveal content below the fold

**Parameters**:

| Param | Type | Required | Description |
|---|---|---|---|
| `selector` | `string` | Yes | CSS selector for the element to scroll into view |
| `target` | `string` | No | DOM context (default: "dom") — `dom` \| `webview` |
| `behavior` | `string` | No | Scroll behavior (default: "smooth") — `smooth` \| `instant` |
| `block` | `string` | No | Vertical alignment (default: "center") — `start` \| `center` \| `end` \| `nearest` |

**Examples**:

*Scroll an element into view*
```json
{
  "tool": "scroll-to",
  "selector": ".ft-footer",
  "behavior": "smooth"
}
```

---

Recommendations for Easy Journey Creation
R1: Action Templates (quick-add patterns)
Instead of building actions one-by-one, offer common patterns:

Template	Generates
"Open via command"	command + wait(500) + assert(leaf)
"Click element"	click(selector) + wait(300)
"Verify visible"	assert(visible, selector)
"Take screenshot"	screenshot(label)
User picks a template → fills in the blanks (command ID, selector, etc.) → actions are added as a group.

Recommendation: Implement in v2 after basic action-by-action adding works.

R2: Command Picker
When adding a command action, show a searchable dropdown of all registered commands (from registry.ts). The plugin already has ~40 commands — don't make users memorize IDs.

Recommendation: Implement in v1 — essential for usability.

R3: Event Autocomplete
For Start/End events, provide typeahead search over EVENT_CATALOG (360+ events). Group by category, show description on hover.

Recommendation: Implement in v1 — this is the user's explicit requirement.

R4: Auto-generate Test File
When exporting, also generate the .test.ts executor file alongside the journey JSON. The test file is always the same 8-line boilerplate — no reason to make users create it manually.

Recommendation: Implement in v1 — trivial and high-value.

R5: Live JSON Preview
A collapsible panel at the bottom of the sidebar showing the generated JSON in real-time. Helps power users verify the output before exporting.

Recommendation: Implement in v2.

R6: Assert Builder
When adding an assert action, guided form:

Type: leaf | visible | event | eval
Per-type fields:
leaf: viewType input (with autocomplete from registered view types)
visible: CSS selector input
event: event name (autocomplete from catalog)
eval: code textarea + optional expected value

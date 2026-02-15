---
type: UseCase
domain: Flowti
stage: done
description: The user enables debug mode in Settings to activate console-level event tracing for troubleshooting unexpected behavior.
view: "[[Flowti Settings Tab]]"
feature: "[[Infrastructure PRD]]"
testplanRef: UC-100
tags:
  - use-case
  - infrastructure
  - diagnostics
---

# Enable Debug Mode for Troubleshooting

## Summary

A user encounters unexpected behavior in the plugin — a view not updating, an import not starting, or an event not firing as expected. They enable debug mode in Settings to see a real-time event trace in the browser console, helping them identify what happened and where the flow broke.

## Preconditions

- The Flowti IBDE plugin is installed and enabled in Obsidian.
- The user has access to the browser DevTools console (Ctrl+Shift+I in Obsidian).

## Steps

1. **Open Settings** — The user opens Obsidian Settings > Flowti IBDE.
2. **Enable Debug Mode** — The user toggles "Debug Mode" to on. The LoggerService receives `settings.changed` and activates the wildcard event trace listener.
3. **Open DevTools console** — The user opens the browser console (Ctrl+Shift+I > Console tab).
4. **Perform the action** — The user performs the action they want to trace (e.g., clicking "+" to create a flow doc).
5. **Read the trace** — The console shows each event in sequence:
   ```
   [Flowti] file.create.request { path: "03 - Resources/.../Flows/New Flow.md", ... }
   [Flowti] file.created { path: "03 - Resources/.../Flows/New Flow.md" }
   [Flowti] event.file.triggered { path: "...", action: "create" }
   ```
6. **Identify the issue** — If an expected event is missing or has wrong data, the user can see exactly where the flow diverges from expectations.
7. **Disable Debug Mode** — After troubleshooting, the user toggles debug mode off. The trace listener is removed and debug-level logs are suppressed.

## Outcome

The user has full visibility into the plugin's internal event flow without needing to read source code. They can trace any operation from trigger to completion and identify exactly where unexpected behavior occurs.

## Variations

- **Debug mode already on**: Some users prefer to keep debug mode on permanently for awareness. This works but increases console noise.
- **Error in the trace**: If an `error.occurred` event appears in the trace, it includes the full error details (code, category, severity, context) for immediate diagnosis.
- **Performance concern**: The event trace has < 1ms overhead per event. For vaults with rapid file changes, this is negligible.

## Related

- Feature: [[Infrastructure PRD]]
- PBI: [[PBI-003 Diagnostics and Debug Mode]]

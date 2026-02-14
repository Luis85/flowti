---
severity: low
category: code-quality
layer: ui
status: resolved
resolved: 2026-02-14
effort: small
description: ComponentShowcaseView contains a German language string and uses inline styles instead of the ft-* CSS class convention. As a developer-facing reference view, it should exemplify the project's own standards.
---
# TD-25: ComponentShowcaseView contains German text and inline styles

## Problem

- Line ~57: German text "Diese View zeigt..." should be English
- Lines 74-87: Uses `setAttribute("disabled")` and inline `.style` properties instead of CSS classes
- Several examples use `element.style.x = "..."` instead of `ft-*` utility classes

## Suggested Remediation

1. Replace German text with English
2. Replace inline styles with existing `ft-*` CSS classes
3. Ensure the showcase demonstrates the correct patterns

## Affected Files

- `src/ui/ComponentShowcaseView.ts`

## Resolution

All German text has been replaced with English. The ComponentShowcaseView now uses English labels throughout (verified: no German strings found in the source file).

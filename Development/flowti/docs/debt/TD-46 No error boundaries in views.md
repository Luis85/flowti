---
status: open
severity: medium
category: reliability
layer: ui
created: 2026-02-15
effort: small
description: "No try/catch wraps component render calls. A single throw in renderMaster() or renderDetail() crashes the entire view with no recovery."
source: "[[Technical Review 2026-02-15]]"
---
# TD-46: No error boundaries in view render paths

## Problem

If a component's `render()`, `renderMaster()`, or `renderDetail()` method throws an exception, the entire view breaks with no recovery. No try/catch wraps render dispatch calls in any orchestrator.

### Scenarios that could trigger

1. Malformed frontmatter in a doc file → `fmString()` / `fmArray()` returns unexpected type
2. Missing catalog entry during cross-reference resolution → null dereference
3. EventBus listener fires with unexpected payload shape → property access on undefined
4. File system race: doc deleted between scan and render → stale entry reference

### Current behavior

View shows blank content or partial render. User must close and reopen the view. No error message is displayed.

## Impact

A single bad file or unexpected state can make an entire tab unusable. User gets no feedback about what went wrong or how to fix it.

## Suggested Fix

Wrap component render calls in try/catch with error banner rendering:

```typescript
// In orchestrator render dispatch
private renderActiveTab(): void {
  this.masterEl.empty();
  this.detailEl.empty();
  try {
    this.activeComponent.renderMaster(this.masterEl);
    this.activeComponent.renderDetail(this.detailEl);
  } catch (e) {
    console.error("[Flowti] Render error in", this.activeTab, e);
    this.masterEl.empty();
    const banner = this.masterEl.createDiv({ cls: "ft-alert ft-alert-error" });
    banner.createEl("strong", { text: "Render error" });
    banner.createEl("p", { text: error instanceof Error ? error.message : String(e) });
    const retry = banner.createEl("button", { text: "Retry", cls: "ft-btn ft-btn-sm" });
    retry.addEventListener("click", () => this.scheduleRender());
  }
}
```

### Scope

Add error boundaries to:
1. `EventCatalogView.renderContent()` — wraps active tab render
2. `DataExchangeHubView.renderContent()` — wraps active tab render
3. `CsvActionView.renderContent()` — wraps active page render
4. `ExportView.renderContent()` — wraps active page render

## Affected Files

- `src/ui/EventCatalogView.ts` — render dispatch (~line 570)
- `src/ui/DataExchangeHubView.ts` — render dispatch
- `src/ui/CsvActionView.ts` — page render dispatch
- `src/ui/ExportView.ts` — page render dispatch

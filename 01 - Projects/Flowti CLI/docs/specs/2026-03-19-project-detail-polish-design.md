# Project Detail Polish — Design Spec

**Date:** 2026-03-19
**Status:** Draft

## Goal

Polish the project detail sidepanel: fix visual inconsistencies, add loading feedback, make output dismissable, display Project Brief frontmatter, and wire "Open folder" to reveal in vault.

## Changes

### 1. Remove redundant first-section border

The `.section` CSS has `border-top` but the `.tab-bar` already has `border-bottom`, creating a double-line. Fix: add `.section:first-of-type { border-top: none; }` so the first section after tabs has no top border.

### 2. "Note" → "Project Brief"

Rename the section title from "Note" to "Project Brief". Update button labels:
- "Project note" link → "Open brief"
- "No project note found" → "No project brief"
- "Create note" → "Create brief"

### 3. Storybook badge + status in section title row

Move the framework badge and status label from the storybook section body into the section title rendered by the parent. The parent's `renderStorybookSection()` becomes:

```html
<div class="section-title">
  Storybook
  <span class="framework-badge">html</span>
  <span class="status-label">Installed</span>
</div>
```

Remove the duplicate status row from `flowti-storybook-section.ts`'s `renderInstalled()` and `renderRunning()` — they only render action buttons now.

### 4. Open folder → reveal-path event

Wire `storybook-open-folder` in `project-handlers.ts` to dispatch a generic `reveal-path` event:

```typescript
el.addEventListener("storybook-open-folder", (() => {
    const config = (el.config as { storybookDir?: string } | undefined);
    const dir = config?.storybookDir ?? "components";
    el.dispatchEvent(new CustomEvent("reveal-path", {
        detail: { path: currentProject + "/" + dir },
        bubbles: true, composed: true,
    }));
}) as EventListener);
```

The Plugin shell listens for `reveal-path` and handles via Obsidian API. This is a reusable pattern — no changes to `ProjectHandlerDeps`.

### 5. Disable buttons during busy + loading indicators

When `busy=true`:
- All action buttons get `disabled` attribute
- Active operation button shows inline spinner next to its label
- Already have spinner CSS (`.spinner` class) — reuse it

### 6. Dismissable output log

After process finishes (`busy=false`) and output exists:
- Show a dismiss button (x) in the output log header
- Clicking it clears `storybookOutput` to `[]`
- Log stays visible until explicitly dismissed

### 7. Project Brief frontmatter display

#### Schema

```yaml
---
type: ProjectBrief
start: 2026-03-01
end: 2026-04-15
goal: "One-line project objective"
description: "Longer description"
status: active
---
```

All fields optional. Only present fields are displayed.

#### Type addition

Add to `ProjectDetail`:

```typescript
readonly brief?: {
    readonly start?: string;
    readonly end?: string;
    readonly goal?: string;
    readonly description?: string;
    readonly status?: string;
};
```

#### Data flow

`VaultProjectService.getProject()` reads the ProjectBrief note's YAML frontmatter via Obsidian's `metadataCache.getFileCache(file)?.frontmatter` and extracts the five fields.

#### Display

Render between the header and tabs in `flowti-project-detail.ts`. Compact key-value layout:

```
Goal: Build a component library for the Flowti CLI
Status: active  |  Start: 2026-03-01  |  End: 2026-04-15
Description: (paragraph text if present)
```

Only fields that exist get rendered. No empty placeholders.

## Files to Modify

| File | Change |
|------|--------|
| `Plugin/src/components/projects/flowti-project-detail.ts` | CSS fix, rename Note→Brief, brief display, storybook title row |
| `Plugin/src/components/projects/flowti-storybook-section.ts` | Remove status row from renderInstalled/Running, disable buttons when busy, dismissable log |
| `Plugin/src/infrastructure/handlers/project-handlers.ts` | Wire open-folder→reveal-path, pass brief data to element |
| `Plugin/src/infrastructure/projects/vault-project-service.ts` | Read brief frontmatter in getProject() |
| `Plugin/src/domain/projects/types.ts` | Add `brief` to ProjectDetail |

## Out of Scope

- Editing brief frontmatter from the UI
- Brief field validation
- ProjectBrief template creation (existing create-note flow is sufficient)

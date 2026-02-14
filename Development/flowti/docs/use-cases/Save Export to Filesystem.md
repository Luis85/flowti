---
type: UseCase
domain: Flowti
stage: done
description: "Save an export file to the local filesystem outside the vault using a native save dialog"
view: "[[Export View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-85"
tags:
  - use-case
  - export
---

# Save Export to Filesystem

## Summary

A user clicks the "Save to filesystem" button in the Export wizard to write the exported file to an arbitrary location on the local filesystem, outside the Obsidian vault. This is useful for sharing data with external systems or colleagues.

## Preconditions

- The Export wizard is open with a valid source (base view or folder) and at least one column selected.
- The Obsidian desktop app is running (Electron's `remote.dialog` API is available).

## Steps

1. Complete the source selection and column configuration steps in the Export wizard as usual.
2. In the output configuration page, click the **"Save to filesystem"** button (hard-drive icon) instead of specifying a vault-internal path.
3. An Electron native **Save File** dialog opens, defaulting to the user's Documents folder with the suggested filename and appropriate extension (`.csv` or `.txt`).
4. Navigate to the desired directory in the native dialog and confirm the save location.
5. The wizard sets the `isExternal` flag on the `ExportConfig` and records the absolute filesystem path.
6. Review the preview table to verify the output content.
7. Click **Export** to trigger the export pipeline. The `WriteExternalFileCallback` is invoked, which uses Node.js `fs.mkdirSync` (to ensure the directory exists) and `fs.writeFileSync` to write the file.

## Outcome

The export file is written to the chosen filesystem path outside the vault. A success notice displays the absolute path and row count. The file can be opened in any spreadsheet application or text editor.

## Variations

- **Dialog cancelled**: If the user dismisses the native save dialog without selecting a path, the wizard remains on the output configuration page with no changes applied.
- **Permission error**: If the target directory is read-only or inaccessible, the export fails with an error notice describing the filesystem permission issue.
- **Switching back to vault**: After clicking "Save to filesystem", the user can clear the external path and specify a vault-internal path instead, resetting the `isExternal` flag.

## Related

- View: [[Export View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-85 in [[Testplan]]

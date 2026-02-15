---
status: postponed
severity: low
effort: medium
layer: cross-cutting
category: infrastructure
updated: 2026-02-16
description: No release or publishing strategy in place. Plugin is manually built and copied into .obsidian/plugins. GitHub releases deferred until plugin matures.
---
# TD-37: No Release- and Publishing Strategy

## Problem

There is no release- or publishing-strategy in place. Currently the plugin gets built and copied into the `.obsidian/plugins` folder.

## Assessment (2026-02-16)

In the future releases should target GitHub. The build pipeline (`vitest > typedoc > tsc > eslint > esbuild`) is solid and produces a clean `main.js` + `manifest.json` + `styles.css`. What's missing:
- Semantic versioning scheme
- GitHub Actions CI/CD workflow
- Release notes automation
- `manifest.json` version bumping

Put on backburner until the plugin is ready for external distribution.

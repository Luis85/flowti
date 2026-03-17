---
type: DecisionNote
adr: ADR-022
title: Release Strategy
status: Accepted
date: 2026-02-15
domain: cross-cutting
category: Infrastructure
drivers:
  - Traceability
  - Reproducibility
  - User Communication
tags:
  - decision
  - infrastructure
  - release
---

# ADR-022: Release Strategy

## Status

**Accepted** — minimal release hygiene established.

## Context

The plugin is at version `0.0.1` with no changelog, no versioning convention, and no release automation. The build pipeline (`vitest → typedoc → tsc → eslint → esbuild`) produces clean artifacts, but there is no way to track what changed between builds.

### Alternatives Considered

1. **No versioning** — just copy `main.js` to plugins folder — current state, no traceability
2. **Full CI/CD with GitHub Actions** — automated releases, tag-based builds — premature for a single-developer plugin
3. **Semantic versioning + CHANGELOG (chosen)** — lightweight convention that scales when automation is needed

## Decision

### Versioning: Semantic Versioning (SemVer)

Follow [semver.org](https://semver.org/) with these plugin-specific interpretations:

| Bump | When | Example |
|------|------|---------|
| **MAJOR** (1.0.0) | Breaking changes to persisted settings schema, event contracts, or vault structure | Renaming storage keys, removing events |
| **MINOR** (0.x.0) | New user-facing features, new domains, new views | Adding Products tab, Data Exchange Hub |
| **PATCH** (0.0.x) | Bug fixes, internal refactoring, documentation | Fixing dual-state bug, splitting contentGenerator |

### Source of Truth

- `manifest.json` holds the canonical version
- `package.json` version should match `manifest.json`
- No automated bumping yet — manual update at release time

### CHANGELOG

- Maintained at `Development/flowti/CHANGELOG.md`
- Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- Sections: Added, Changed, Fixed, Removed
- `[Unreleased]` section accumulates changes between versions

### When to Release

- **No schedule** — release when a meaningful set of changes is ready
- **Pre-1.0**: MINOR bumps for feature milestones, PATCH for bug fixes
- **1.0.0 criteria**: All core features stable, installer tested, documentation complete

### Future Automation (deferred)

When the plugin is ready for external distribution:
1. GitHub Actions workflow triggered by version tag
2. `manifest.json` + `main.js` + `styles.css` bundled as GitHub Release
3. Community plugins submission (Obsidian plugin registry)

## Consequences

### Positive

- **Traceability**: CHANGELOG records what changed and why
- **Communication**: Users can see what's new before updating
- **Foundation**: SemVer convention ready for future CI/CD

### Negative

- **Manual process**: Version bumps and CHANGELOG updates are manual
- **No enforcement**: Nothing prevents forgetting to update the CHANGELOG

## Related

- [[ADR-012 Build Pipeline as Quality Gate]] — build pipeline produces release artifacts
- TD-37: No release and publishing strategy — this ADR addresses the gap

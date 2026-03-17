---
type: Report
title: "Go to Market - Flowti IBDE"
status: Draft
date: 2026-02-20
author: Analysis Report
tags:
  - go-to-market
  - publishing
  - brat
  - marketplace
  - roadmap
---

# Go to Market — Flowti IBDE

## Executive Summary

Flowti IBDE is a technically mature Obsidian plugin with strong architecture, comprehensive test coverage (1,787 passing tests), and well-documented design decisions (32 ADRs). However, significant gaps exist between the current development state and a publishable product. This report identifies **19 blockers** across 5 categories, proposes a **4-phase roadmap** from BRAT beta to Obsidian marketplace, and provides a risk register for the go-live journey.

**Bottom line:** The plugin is architecturally ready. What's missing is the packaging — release automation, user-facing documentation, marketplace compliance, and community infrastructure. The recommended path is a **BRAT-first strategy** that buys time for marketplace compliance work while gathering real user feedback.

---

## 1. Current State Assessment

### What's Strong

| Area | Status | Evidence |
|------|--------|----------|
| Architecture | Excellent | 32 ADRs, DDD with 15 bounded contexts, event-driven |
| Test suite | Strong | 1,787 passing, 110 test files, 79 suites, ~98.3% pass rate |
| Build pipeline | Solid | esbuild with production/dev/release/distribution modes |
| Type safety | Strict | TypeScript strict mode, Zod validation at boundaries |
| Error handling | Good | Centralized ErrorService, try-catch on all storage paths |
| Memory management | Excellent | 4 critical leaks resolved, IDisposable on 9/11 services |
| Security | Clean | No eval, no XSS vectors, no telemetry, no network calls |
| Internal docs | Comprehensive | 29 PRDs, 15 user flows, 8 sitemap docs, 62 component specs |
| First-run experience | Functional | 4-page installer wizard with folder scaffolding |

### What's Missing

| Area | Gap | Impact |
|------|-----|--------|
| Release automation | No GitHub Actions, no automated releases | Cannot distribute |
| Public repository | Repo is local/private | Cannot be installed by anyone |
| User documentation | Developer-focused README, no user guide | Users can't self-serve |
| Visual assets | No screenshots, no demo GIFs | Can't announce effectively |
| Community channels | No Discord, no forum thread, no issue tracker | No support path |
| Marketplace compliance | 707 inline styles, Title Case in UI | Marketplace will reject |
| Announcement materials | No marketing copy, no hero image | Can't go public |

---

## 2. Blocker Analysis

### Category A: Release Infrastructure (BRAT-blocking)

These must be resolved before any user can install the plugin.

| # | Blocker | Severity | Effort | Description |
|---|---------|----------|--------|-------------|
| A1 | No public GitHub repository | Critical | Small | Repo is local. Must be pushed to public GitHub (`Luis85/flowti` or similar). |
| A2 | No GitHub Actions release workflow | Critical | Medium | No `.github/workflows/` directory exists. Need CI workflow (test on PR) and release workflow (build + create GitHub release on tag). |
| A3 | No GitHub releases exist | Critical | Small | BRAT requires GitHub releases with `main.js`, `manifest.json`, `styles.css` as binary assets. Zero releases exist today. |
| A4 | `versions.json` only maps `1.0.0` | Medium | Tiny | Current entry is `"1.0.0": "0.15.0"`. Need entry for `0.0.1` (or whatever the first release version will be) mapping to `1.11.4`. |
| A5 | Version `0.0.1` signals pre-alpha | Low | Tiny | BRAT users expect at least `0.1.0` for a usable beta. Consider starting at `0.1.0`. |

### Category B: User Experience (Go-live-blocking)

These must be resolved before announcing to real users.

| # | Blocker | Severity | Effort | Description |
|---|---------|----------|--------|-------------|
| B1 | No user-facing README | High | Medium | Current README is an architecture document (531 lines of DDD, deployment views, crosscutting concepts). Users need: what it does, how to install, first steps. |
| B2 | No BRAT installation instructions | High | Small | No documentation explaining how to install via BRAT. Need a one-liner: `Luis85/flowti` in BRAT settings. |
| B3 | No screenshots or visual assets | High | Medium | Zero images in the repository. Users can't preview the plugin. Need 4-6 screenshots of key views (Event Catalog, Data Exchange Hub, Session Workspace, User Hub). |
| B4 | No support channel | High | Small | Users have no way to report bugs. Need at minimum: GitHub Issues enabled. Recommended: Discord server or GitHub Discussions. |
| B5 | No announcement materials | Medium | Medium | No forum post draft, no Reddit post, no social media copy. Need a launch announcement for Obsidian forum + Discord `#updates` channel. |
| B6 | Progressive onboarding not implemented | Medium | Large | Installer wizard works, but after that users have no guidance. Onboarding PRD exists but is in draft. Acceptable for beta if installer "What to do next" section is clear enough. |

### Category C: Marketplace Compliance (Marketplace-blocking)

These must be resolved before submitting to the Obsidian Community Plugin directory.

| # | Blocker | Severity | Effort | Description |
|---|---------|----------|--------|-------------|
| C1 | 707 inline style assignments | Critical | Very Large | Across 55 files. ObsidianReviewBot flags `element.style.*` usage. Must migrate to CSS classes. Top offenders: UserHubDashboard (49), UserHubSessions (61), UserHubSessionPreferences (37). |
| C2 | Title Case in UI text | Medium | Medium | Marketplace requires sentence case. Mixed usage detected in component labels, tab names, button text. |
| C3 | 2x `as any` casts | Low | Tiny | `CsvLanding.ts:132` and `SessionService.ts:371`. Both have ESLint disable comments with rationale. Reviewers may flag but likely acceptable with justification. |

### Category D: Technical Debt (Quality-blocking)

These should be resolved to prevent user-facing bugs.

| # | Blocker | Severity | Effort | Description |
|---|---------|----------|--------|-------------|
| D1 | TD-71: FolderScaffoldStep uses error string matching | Medium | Small | `error.message.includes('already exists')` breaks on non-English locales and Obsidian version changes. Check folder existence instead. |
| D2 | TD-62: generateEventKey falls back to UUID | Medium | Small | Pathless events defeat deduplication. Use deterministic hash of event type + payload instead. |
| D3 | TD-65: pendingCreatedPaths Set has no eviction | Low | Tiny | Unbounded Set grows over long sessions. Add TTL or max-size. |

### Category E: Operational Readiness (Success-blocking)

These ensure the team can respond to user feedback and iterate.

| # | Blocker | Severity | Effort | Description |
|---|---------|----------|--------|-------------|
| E1 | No issue triage process | Medium | Small | Need labels, templates, and a response SLA for GitHub Issues. |
| E2 | No automated quality gate on PRs | Medium | Medium | Without CI running tests on PRs, regressions can ship. |
| E3 | No telemetry or feedback mechanism | Low | Medium | After marketplace rules prohibit client-side telemetry, the only feedback channel is GitHub Issues/Discussions. Need to make this friction-free. |

---

## 3. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Marketplace rejection on inline styles** | Very High | High | Migrate to CSS classes before submission. Do BRAT beta first while this work proceeds. |
| **Marketplace review takes 6+ weeks** | High | Medium | Start with BRAT. Submit to marketplace early; iterate during review. |
| **Users hit bugs in untested UI paths** | Medium | High | ~32 UI components lack tests. Prioritize manual testing of critical flows before launch. |
| **Obsidian API breaks EventBridge** | Low | High | EventBridge abstraction layer isolates impact. Pin `minAppVersion` to tested Obsidian version. |
| **Canvas format changes break config storage** | Low | Medium | ADR-033 is Proposed, not implemented. If implemented, pin to `metadata.version`. |
| **First-run installer fails on edge cases** | Medium | High | TD-71 (error string matching) is fragile. Fix before go-live. |
| **User data loss from storage corruption** | Low | Critical | Zod validation + fallback to defaults prevents crash. But no backup/restore mechanism exists for user configs. |
| **Support volume overwhelms solo maintainer** | Medium | Medium | Start with limited beta (invite-only BRAT). Use GitHub Discussions for community self-help. |
| **CSV parsing blocks UI on large files** | Low | Medium | TD-48 deferred. Document max recommended file size in user docs. |
| **Beta version in manifest.json triggers auto-update** | Medium | High | Never commit beta version to default branch. Use release-only version bumps. |

---

## 4. Proposed Roadmap

### Phase 0: Foundation (Pre-launch)
**Goal:** Make the plugin installable and supportable.
**Duration estimate:** Sprint-sized

| Task | Blocker | Priority | Notes |
|------|---------|----------|-------|
| Push repo to public GitHub | A1 | P0 | Decide on org/repo name. Clean git history if needed. |
| Create GitHub Actions CI workflow | A2, E2 | P0 | Run tests + lint + typecheck on PR/push. |
| Create GitHub Actions release workflow | A2, A3 | P0 | Build + create release with assets on tag push. |
| Fix `versions.json` for initial release | A4 | P0 | Add `"0.1.0": "1.11.4"` entry. |
| Fix TD-71 (FolderScaffoldStep) | D1 | P0 | Replace error string matching with existence check. |
| Fix TD-62 (generateEventKey) | D2 | P0 | Deterministic hash instead of UUID. |
| Fix TD-65 (pendingCreatedPaths eviction) | D3 | P1 | TTL-based cleanup. |
| Enable GitHub Issues with templates | B4, E1 | P0 | Bug report + feature request templates. |
| Decide initial release version | A5 | P0 | Recommend `0.1.0` for beta signal. |
| Run `npm install && npm run build:release` | — | P0 | Verify full pipeline works end-to-end. |

**Exit criteria:** First GitHub release (`0.1.0`) created with working CI/CD. Plugin installable via BRAT.

---

### Phase 1: Private Beta via BRAT
**Goal:** Get the plugin into the hands of 5-20 trusted testers.
**Duration estimate:** 2-4 weeks

| Task | Blocker | Priority | Notes |
|------|---------|----------|-------|
| Write user-facing README section | B1 | P0 | "What it does", "Install via BRAT", "Getting Started" at the top. Architecture docs move to a "For Developers" section or separate file. |
| Write BRAT installation instructions | B2 | P0 | Add to README: "1. Install BRAT. 2. Add `Luis85/flowti`. 3. Enable plugin." |
| Capture 4-6 key screenshots | B3 | P0 | Event Catalog, Data Exchange Hub, Session Workspace, User Hub, Installer Wizard, CSV Import. |
| Create GitHub Discussions space | B4 | P1 | Q&A category + Show and Tell. |
| Draft beta announcement | B5 | P1 | Short post for Obsidian Discord + targeted outreach to testers. |
| Manual test critical user flows | — | P0 | First-run, CSV import, session creation, event browsing. |
| Monitor and triage beta feedback | E1 | Ongoing | Respond within 48h. Tag issues by severity. |
| Fix bugs discovered in beta | — | Ongoing | Prioritize crashers and data loss. |

**Exit criteria:** 5+ users have installed, used, and provided feedback. No P0 bugs open. Installer works reliably across environments.

---

### Phase 2: Public Beta + Marketplace Prep
**Goal:** Open beta to broader audience. Begin marketplace compliance work.
**Duration estimate:** 4-8 weeks (parallel tracks)

**Track A: Community Growth**

| Task | Priority | Notes |
|------|----------|-------|
| Publish announcement on Obsidian forum | P0 | Forum post with screenshots, use cases, BRAT link. |
| Post to Reddit r/ObsidianMD | P1 | Cross-post from forum. |
| Create demo vault | P1 | Pre-configured vault with sample data showing key features. |
| Write "Your First 10 Minutes" guide | P1 | Step-by-step tutorial: install → import CSV → browse events → start session. |
| Collect user testimonials | P2 | For marketplace submission and future announcements. |

**Track B: Marketplace Compliance (parallel)**

| Task | Blocker | Priority | Notes |
|------|---------|----------|-------|
| Migrate inline styles to CSS classes | C1 | P0 | 707 occurrences across 55 files. This is the largest work item. Approach: create a `ft-` utility class system for common patterns (flex, spacing, sizing), then systematically replace `element.style.*` calls. |
| Audit and fix Title Case in UI | C2 | P1 | Standardize to sentence case. |
| Document `as any` casts | C3 | P2 | Add JSDoc explaining why type safety is bypassed. |
| Run ObsidianReviewBot ESLint rules locally | — | P0 | Install `eslint-plugin-obsidian` (if available) or replicate known rules to catch issues before submission. |
| Verify no unhandled promises escaped | — | P1 | Full audit. Current discipline is good (1,021 void prefixes) but verify edge cases. |

**Exit criteria:** All C-category blockers resolved. ObsidianReviewBot-equivalent linting passes locally.

---

### Phase 3: Marketplace Submission
**Goal:** Submit to Obsidian Community Plugin directory and get accepted.
**Duration estimate:** 2-8 weeks (mostly waiting for review)

| Task | Priority | Notes |
|------|----------|-------|
| Fork `obsidianmd/obsidian-releases` | P0 | Add entry to `community-plugins.json`. |
| Prepare `community-plugins.json` entry | P0 | `id`, `name`, `author`, `description` must exactly match `manifest.json`. |
| Submit PR | P0 | Complete the submission checklist in preview mode. |
| Respond to ObsidianReviewBot feedback | P0 | Bot posts within hours. Fix issues, push to your repo (bot re-evaluates in ~6h). Do NOT open a new PR. |
| Wait for manual review | — | 2-6+ weeks typical. |
| Prepare marketplace launch announcement | P1 | Draft for Obsidian Discord `#updates` (requires developer role), forum, Reddit. |
| Publish marketplace launch announcement | P0 | Coordinate timing with acceptance. |
| Monitor post-launch feedback surge | Ongoing | First 48h after marketplace listing are highest traffic. |

**Exit criteria:** Plugin listed in Obsidian's Community Plugins browser. Users can install without BRAT.

---

### Phase 4: Post-Launch Operations
**Goal:** Sustain quality, grow community, iterate on feedback.
**Duration:** Ongoing

| Activity | Cadence | Notes |
|----------|---------|-------|
| Triage GitHub Issues | Daily (first month) → 2x/week | Respond within 48h. |
| Bug fix releases | As needed | Patch versions (`0.1.1`, `0.1.2`) for critical bugs. |
| Feature releases | Bi-weekly to monthly | Minor versions (`0.2.0`, `0.3.0`). |
| CHANGELOG updates | Every release | User-friendly language, not developer jargon. |
| Community engagement | Weekly | Respond to Discussions, collect feature requests. |
| Feedback-driven backlog | Sprint-based | Prioritize based on real user pain, not assumptions. |
| Progressive onboarding implementation | Phase 4+ | Now justified by real user data on drop-off points. |
| Mobile support exploration | Phase 4+ | Currently `isDesktopOnly: true`. Evaluate demand. |

---

## 5. The Inline Styles Problem (Deep Dive)

The 707 inline style assignments are the single largest blocker for marketplace acceptance. This section provides a migration strategy.

### Scale of the Problem

| File Group | Files | Occurrences | Pattern |
|------------|-------|-------------|---------|
| User Hub views | 5 | 166 | Layout, spacing, typography |
| Session views | 6 | 72 | Cards, overlays, indicators |
| Hub tabs | 7 | 55 | Tables, lists, badges |
| Catalog views | 8 | 48 | Grids, panels, filters |
| Core views | 4 | 38 | Container layout, flex |
| CSV views | 4 | 28 | Progress bars, forms |
| Export views | 3 | 22 | Forms, preview |
| Infrastructure UI | 6 | 18 | Modals, settings |
| Remaining | 12 | ~260 | Mixed |

### Migration Strategy

**Step 1: Create utility CSS classes** for the most common inline patterns:

```css
/* Layout */
.ft-flex          { display: flex; }
.ft-flex-col      { flex-direction: column; }
.ft-flex-row      { flex-direction: row; }
.ft-flex-1        { flex: 1; }
.ft-flex-wrap     { flex-wrap: wrap; }
.ft-items-center  { align-items: center; }
.ft-justify-between { justify-content: space-between; }

/* Spacing */
.ft-gap-xs        { gap: 4px; }
.ft-gap-sm        { gap: 8px; }
.ft-gap-md        { gap: 12px; }
.ft-gap-lg        { gap: 16px; }
.ft-p-sm          { padding: 8px; }
.ft-p-md          { padding: 12px; }
.ft-mb-sm         { margin-bottom: 8px; }

/* Sizing */
.ft-w-full        { width: 100%; }
.ft-h-full        { height: 100%; }

/* Text */
.ft-text-sm       { font-size: var(--font-ui-smaller); }
.ft-text-muted    { color: var(--text-muted); }
.ft-text-center   { text-align: center; }
.ft-text-bold     { font-weight: var(--font-semibold); }
.ft-text-mono     { font-family: var(--font-monospace); }

/* Display */
.ft-hidden        { display: none; }
.ft-overflow-auto { overflow: auto; }
```

**Step 2: Replace inline styles** file-by-file, starting with the highest-count files. Use `el.addClass("ft-flex", "ft-gap-sm")` instead of `el.style.display = "flex"; el.style.gap = "8px"`.

**Step 3: For dynamic/conditional styles** (e.g., progress bar width), use `el.setCssProps({"--progress": "75%"})` with a CSS rule `.ft-progress-bar { width: var(--progress); }`.

**Estimated effort:** 3-5 days of focused work for an experienced developer familiar with the codebase.

---

## 6. Automation Strategy

The long-term goal is to minimize manual release work so the maintainer can focus on features and feedback.

### CI Pipeline (GitHub Actions)

```
PR opened/pushed → install → lint → typecheck → test → build (verify) → report
```

### Release Pipeline (GitHub Actions)

```
git tag pushed → install → test → build:release → create GitHub release → upload assets
```

### Recommended Workflow

```bash
# 1. Bump version (updates manifest.json + versions.json)
npm version patch   # or minor/major

# 2. Push with tag
git push && git push --tags

# 3. GitHub Actions does the rest:
#    - Runs tests
#    - Builds main.js
#    - Creates GitHub release with assets
#    - BRAT users auto-update
#    - Marketplace users auto-update (after marketplace acceptance)
```

### Post-Marketplace Automation

Once accepted in the marketplace, subsequent releases require **no further review**. The cycle becomes:

```
Fix/feature → PR with passing CI → Merge → Tag → Auto-release → Users auto-update
```

---

## 7. Announcement Strategy

### BRAT Beta Announcement (Phase 1)

**Channel:** Targeted outreach (DMs, small community)
**Tone:** "Looking for beta testers"
**Content:**
- What Flowti does (2 sentences)
- What we're looking for (feedback on which features)
- How to install (BRAT instructions)
- Where to report issues (GitHub link)

### Public Beta Announcement (Phase 2)

**Channel:** Obsidian Forum + Reddit r/ObsidianMD
**Tone:** "Introducing Flowti IBDE"
**Content:**
- Problem statement (why business users need this)
- Feature highlights with screenshots (4-6 images)
- Use cases (import CRM data, document business processes, run structured sessions)
- Installation via BRAT
- Feedback welcome (GitHub Discussions link)

### Marketplace Launch (Phase 3)

**Channel:** Obsidian Discord `#updates` + Forum + Reddit
**Tone:** "Flowti is now available in Community Plugins"
**Content:**
- What's new since beta (improvements from user feedback)
- One-click install from Community Plugins
- Getting Started guide link
- Community testimonials (if available)
- Roadmap teaser (what's coming next)

---

## 8. Success Metrics

### Phase 1 (Private Beta)
- 5-20 installs via BRAT
- 3+ feedback reports received
- 0 data-loss bugs
- Installer completes successfully on 100% of test environments

### Phase 2 (Public Beta)
- 50-100 BRAT installs
- 10+ GitHub Issues/Discussions
- <48h average response time on issues
- Inline styles fully migrated

### Phase 3 (Marketplace)
- Marketplace acceptance (PR merged)
- 200+ installs in first month
- 4+ star rating (if Obsidian adds ratings)
- <5 P0 bugs reported

### Phase 4 (Growth)
- 500+ active installs
- Community contributors (PRs from external devs)
- Feature requests driving backlog
- Stable bi-weekly release cadence

---

## Appendix A: BRAT vs. Marketplace Requirements Comparison

| Requirement | BRAT | Marketplace |
|-------------|------|-------------|
| Public GitHub repo | Yes (or private + PAT) | Yes (must be public) |
| GitHub release with assets | Yes (`main.js`, `manifest.json`, `styles.css`) | Yes (same) |
| Tag format | Semver (incl. pre-release) | Strict semver `x.y.z` only |
| `versions.json` | Required | Required |
| `README.md` | Not required | Required |
| `LICENSE` | Not required | Required |
| Review process | None | Automated bot + manual (2-6 weeks) |
| Inline style restrictions | None | Enforced (CSS classes preferred) |
| `as any` restrictions | None | Flagged by reviewer |
| Sentence case requirement | None | Enforced |
| No telemetry | Not enforced | Strictly enforced |
| No "obsidian" in plugin ID | Not enforced | Enforced |
| Pre-release versions | Supported | Ignored (drafts/pre-releases skipped) |
| Auto-updates | Via BRAT | Native Obsidian |

## Appendix B: Release Checklist Template

```markdown
## Release vX.Y.Z Checklist

### Pre-Release
- [ ] All tests pass (`npm run test`)
- [ ] Type check clean (`npm run check`)
- [ ] No new inline styles introduced
- [ ] CHANGELOG.md updated with user-friendly entries
- [ ] versions.json includes new version entry
- [ ] manifest.json version matches tag

### Release
- [ ] `npm version patch|minor|major`
- [ ] `git push && git push --tags`
- [ ] Verify GitHub Actions created release
- [ ] Verify release has main.js, manifest.json, styles.css assets
- [ ] Install via BRAT and smoke test

### Post-Release
- [ ] Announce in appropriate channels (if significant)
- [ ] Monitor GitHub Issues for 48h
- [ ] Close resolved issues
```

## Appendix C: File Inventory for Marketplace Submission

| File | Status | Action Needed |
|------|--------|---------------|
| `manifest.json` | Ready | Bump version for release |
| `package.json` | Ready | Bump version (via `npm version`) |
| `versions.json` | Needs update | Add entry for release version |
| `LICENSE` | Ready | ISC license present |
| `README.md` | Needs rewrite | Add user-facing section at top |
| `styles.css` | Ready | 40KB, comprehensive |
| `main.js` | Not built | Generated by `npm run build` |
| `.github/workflows/ci.yml` | Missing | Create CI workflow |
| `.github/workflows/release.yml` | Missing | Create release workflow |
| `community-plugins.json` entry | Missing | Create when submitting to marketplace |

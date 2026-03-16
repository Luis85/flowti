# Product Content Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce 5 customer-facing product documents (1 brief + 4 feature one-pagers) for the Flowti CLI.

**Architecture:** Each document is a standalone markdown file in `01 - Projects/Flowti CLI/docs/product/`. Content follows the approved spec at `docs/specs/2026-03-16-product-content-design.md`. Tone is professional but approachable, audience is small dev teams (2-10).

**Tech Stack:** Markdown only. No code changes.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-16-product-content-design.md`

---

## File Structure

All files created in `01 - Projects/Flowti CLI/docs/product/`:

| File | Responsibility |
|------|---------------|
| `product-brief.md` | Top-level product overview — what, who, why, how |
| `feature-agent-workers.md` | Agent Workers feature one-pager |
| `feature-project-management.md` | Project Management Suite feature one-pager |
| `feature-multi-project.md` | Multi-Project Orchestration feature one-pager |
| `feature-markdown-advantage.md` | The Markdown Advantage feature one-pager |

---

## Chunk 1: Product Brief

### Task 1: Create the product directory

**Files:**
- Create: `01 - Projects/Flowti CLI/docs/product/` (directory)

- [ ] **Step 1: Create the output directory**

Run: `mkdir -p "01 - Projects/Flowti CLI/docs/product"`

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/docs/product"
git commit -m "chore: create product content directory"
```

### Task 2: Write the Product Brief

**Files:**
- Create: `01 - Projects/Flowti CLI/docs/product/product-brief.md`

**Source:** Spec sections 1 (Product Brief), Content Guidelines.

- [ ] **Step 1: Write the product brief**

Create `01 - Projects/Flowti CLI/docs/product/product-brief.md` with:

```markdown
# Flowti — Your Project's Operating System

One binary. Zero dependencies. Every project under control.

---

## What is Flowti?

Flowti is a project orchestrator that gives your team a single entry point
for building, testing, reviewing, and managing all your projects.

It runs locally on your machine, stores everything as markdown files in your
repository, and treats AI agents as first-class participants in your workflow.
No accounts to create, no cloud services to configure, no dependencies to install.

## Who is it for?

Small development teams — two to ten people — who want structure and visibility
without adopting a platform.

If your team has outgrown scattered npm scripts but doesn't want to onboard a
DevOps platform, Flowti fills that gap. It's for teams that value owning their
workflow, keeping things local, and staying lean.

## The Problem

**Tools are scattered.** Build scripts in one place, test commands in another,
project docs in a wiki, management in a SaaS tool. Every project works a little
differently, and new team members spend their first week figuring out how things
are stitched together.

**Quality is invisible.** You don't know how healthy a project is until something
breaks. Coverage drops, lint warnings pile up, tech debt grows — all silently,
until it's a problem.

**Project context lives in silos.** Decisions, risks, requirements, and timelines
sit in tools that aren't connected to the code they describe. When you need the
full picture, you're switching between three tabs and a spreadsheet.

**AI agents can't plug in.** Most workflows have no structured, non-interactive
interface for agents to read project state and take action. If you want AI help,
you copy-paste context into a chat window every time.

## How Flowti Solves It

**AI agents that react to your project.** Persistent agent workers are triggered
by project events and act — planning, reviewing, breaking down tasks. Not
one-shot prompts; ongoing collaborators that work with the same files your team
uses.

**Project management alongside your code.** Resources, deliverables, risks,
requirements, time tracking, and feature tracking — all as markdown files in
your repository. No separate tool to maintain.

**Every project, one binary.** Manage multiple projects of different types with
consistent commands, shared health scoring, and unified workflows. TypeScript
libraries, CLIs, plugins, web apps — all from the same entry point.

**Everything is a file you own.** Markdown with structured frontmatter.
Git-friendly, diffable, searchable, editable in any tool. No vendor lock-in,
no data migration, no "export as CSV" workarounds.

## How It Works

Install once. Point Flowti at your projects. You get a unified menu with every
capability — build, test, review, publish, reports, management, agents.

Start simple: run builds and tests across your projects. Then progressively opt
into quality gates, health scoring, event catalogs, and agent workers as your
team is ready.

Nothing activates until you configure it. There's no ceremony to get started.

## Key Principles

**Zero dependencies.** One self-contained binary. No npm install, no lock file
conflicts, no supply chain risk.

**Progressive opt-in.** Start with nothing configured. Features activate when
you're ready, not before.

**Definition-driven.** Structured definitions drive the system — project config
and UI layouts in JSON, management data and agent definitions in markdown.
Everything is auditable and diffable.

**Local-first.** Everything runs on your machine, stores in your repository, and
works offline.

**Security included.** Health scores factor in dependency vulnerability scanning
alongside tests, coverage, and lint — baseline dependency hygiene without a
separate tool.

---

*Flowti is for teams who believe the source of truth should live where the source
code lives.*
```

- [ ] **Step 2: Review against spec**

Read the spec at `docs/specs/2026-03-16-product-content-design.md` section 1. Verify every section from the spec is covered: What is Flowti, Who is it for, The Problem (4 bullets), How Flowti Solves It (4 bullets), How It Works, Key Principles (5 bullets). Verify tone matches "professional but approachable." Verify no technical jargon (DI, MVC, ECS, etc.).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/docs/product/product-brief.md"
git commit -m "docs: add Flowti product brief"
```

---

## Chunk 2: Agent Workers + Project Management One-Pagers

### Task 3: Write the Agent Workers feature one-pager

**Files:**
- Create: `01 - Projects/Flowti CLI/docs/product/feature-agent-workers.md`

**Source:** Spec section 2 (Agent Workers).

- [ ] **Step 1: Write the agent workers one-pager**

Create `01 - Projects/Flowti CLI/docs/product/feature-agent-workers.md` with:

```markdown
# Agent Workers — AI That Reacts to Your Project

Persistent AI collaborators that live inside your project and respond to what's
happening — not just when you ask them to.

---

## What it does

Most AI tools work like a search bar: you type a question, you get an answer,
the conversation ends. Agent workers are different. They live inside your project,
react to events as they happen, and take action on their own.

When a task is assigned, an agent can pick it up. When an iteration moves to a
new phase, an agent can review what's in scope. When work is ready for planning,
an agent can break it down into concrete steps.

They're not one-shot prompts. They're ongoing collaborators that stay aware of
your project's state.

## How it works

**Perceive.** An agent is triggered when something happens in your project — a
task was assigned, an iteration changed state, a scope item needs attention. The
system dispatches the event to the right agent based on its defined triggers.

**Decide.** The agent evaluates its rules to determine the right response.
Higher-priority rules take precedence when multiple events arrive at once. A
product owner might prioritize scope changes over routine task assignments.

**Act.** The agent executes in an isolated workspace — a clean copy of your
project where it can generate a plan, review a deliverable, or update project
state without interfering with your working directory. When it's done, results
are collected back to your project, stored as files, and traceable in git.

## Starter roles

Flowti includes ready-to-use agent definitions you can adapt:

- **Product Owner** — Refines iteration goals, identifies scope items, and
  prioritizes work across the team.
- **Software Architect** — Handles technical planning, breaking scope items into
  tasks with file-level detail.

These are starting points, not limits. Teams define their own agents with custom
rules and event triggers. Each agent gets a definition file describing its role,
its capabilities, and what events it cares about.

## Why it matters for your team

**Same data, no silos.** Agents work with the same markdown files your team
uses — project records, deliverables, iteration plans. There's no separate
system to sync or maintain.

**Full traceability.** Every agent action is stored as a file in your repository.
You can diff it, review it in a pull request, or trace back exactly what happened
and why.

**Flexible providers.** Teams define agents as AI-backed (using Claude, Cursor,
or a local binary) or as placeholder roles for human team members. Placeholder
agents require no API key — they acknowledge tasks and track status without an
LLM.

## Start when you're ready

You don't need agents to use Flowti. Add them when your project is ready. They
activate from a definition file — no infrastructure to set up, no service to run,
no configuration ceremony. Drop in a file, and the agent is live.
```

- [ ] **Step 2: Review against spec**

Read the spec section 2 (Agent Workers). Verify all subsections present: What it does, How it works (3-step), Starter roles, Why it matters (3 bullets), Progressive. Verify language uses "triggered by" not "subscribe to." Verify "starter roles" not "built-in roles."

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/docs/product/feature-agent-workers.md"
git commit -m "docs: add Agent Workers feature one-pager"
```

### Task 4: Write the Project Management feature one-pager

**Files:**
- Create: `01 - Projects/Flowti CLI/docs/product/feature-project-management.md`

**Source:** Spec section 3 (Project Management Suite).

- [ ] **Step 1: Write the project management one-pager**

Create `01 - Projects/Flowti CLI/docs/product/feature-project-management.md` with:

```markdown
# Project Management — Built Into Your Codebase, Not Bolted On

Track resources, deliverables, risks, iterations, and more — right next to
the code they describe.

---

## What it does

Flowti includes integrated management domains that live in your repository as
markdown files. Instead of switching to a separate tool to record a decision,
log a risk, or update a deliverable, you do it from the same CLI you use to
build and test.

Everything is stored as markdown with structured frontmatter. Readable in any
editor, queryable in Obsidian, diffable in pull requests.

## The domains

**Resources** — People, roles, budgets, and allocation. Know who's working on
what and what capacity looks like.

**Time Log** — Who worked on what, when, and how long. Simple time tracking
tied to your project, not a separate system.

**Deliverables** — What's due, who owns it, and how far along it is. Track
completion percentage, priority, and status.

**Iterations** — Plan work in time-boxed cycles with scope, capacity, and
agent assignments. Iterations drive the agent system — when an iteration moves
to a new phase, agents react.

**RAID Log** — Risks, assumptions, issues, dependencies, and decisions in one
place. The kind of project context that usually lives in someone's head or a
forgotten spreadsheet.

**CAPA** — Corrective and preventive actions. When something goes wrong, record
the root cause, the corrective action, and verify that it's actually fixed.

**Requirements** — User stories, use cases, and traceability back to
deliverables. Know what you're building and why.

**Features** — Track feature progress through defined phases, from ideation to
deprecation. See where each capability sits in its journey.

## Why it matters for your team

**No separate tool to maintain.** Management data lives in the same repository
as the code it describes. One source of truth, one version history.

**Visible in pull requests.** When someone updates a deliverable status or logs
a new risk, it shows up in the same diff as the code changes. Reviewers see the
full picture.

**Synced on git pull.** One team member updates a record; the rest see it in
their next pull. No sync issues, no stale dashboards, no "did you update the
tracker?"

## Not a replacement, a companion

Flowti doesn't try to replace Jira or Linear for daily ticket work. It gives
your team a structured, version-controlled record of the decisions, risks, and
progress that those tools don't capture well.

Think of it as the project's long-term memory — the context that outlasts any
individual sprint or ticket.
```

- [ ] **Step 2: Review against spec**

Read the spec section 3 (Project Management Suite). Verify all subsections: What it does, The domains (8 items: Resources, Time Log, Deliverables, Iterations, RAID, CAPA, Requirements, Features), Why it matters (3 bullets), Not a replacement. Verify "Iterations" mentions agent assignments. Verify "Features" not "Lifecycle."

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/docs/product/feature-project-management.md"
git commit -m "docs: add Project Management feature one-pager"
```

---

## Chunk 3: Multi-Project + Markdown Advantage One-Pagers

### Task 5: Write the Multi-Project Orchestration feature one-pager

**Files:**
- Create: `01 - Projects/Flowti CLI/docs/product/feature-multi-project.md`

**Source:** Spec section 4 (Multi-Project Orchestration).

- [ ] **Step 1: Write the multi-project one-pager**

Create `01 - Projects/Flowti CLI/docs/product/feature-multi-project.md` with:

```markdown
# Multi-Project Orchestration — One Binary, Every Project

Manage multiple projects of different types from a single CLI. Same commands,
same health scoring, same workflow — regardless of what each project builds.

---

## What it does

Most teams work on more than one project. A TypeScript library here, a CLI tool
there, maybe an Obsidian plugin or a web app. Each has its own build commands,
its own test setup, its own way of doing things.

Flowti gives you one entry point for all of them. Each project declares its own
capabilities — what it builds, how it tests, what quality thresholds to enforce —
and Flowti presents them in a unified menu with a consistent workflow.

No monorepo setup required. No workspace configuration. Just point Flowti at
your projects.

## How it works

**Declare capabilities.** Each project gets a config file describing its build
commands, test presets, quality thresholds, and management domains. The config
is the contract between your project and Flowti.

**Discover and select.** Flowti discovers your projects and presents them in a
menu. Select one and you get its full lifecycle: scaffold, build, test, review,
publish, reports, management.

**Consistent commands.** Build, test, health, and reports work the same way
everywhere. The commands are the same; the underlying tools adapt to each
project.

## What you get across projects

**Comparable health scores.** Every project gets a 0-100 health score on the
same scale — tests, coverage, build, lint, dependency security, and git hygiene
— with A-F grading. Compare projects at a glance and spot the ones that need
attention.

**Dependency awareness.** Flowti detects cross-project dependencies and analyzes
them for cycles. When project A depends on project B, you know — and you know
if that dependency creates a problem.

**Shared templates.** New projects start from proven scaffold definitions. Your
team's conventions are encoded once and reused everywhere.

## Why it matters for your team

**No more tribal knowledge.** "How do I run tests in that other project?" stops
being a question. Every project follows the same patterns, documented in the
same way.

**Faster onboarding.** New team members learn one workflow and it applies
everywhere. The second project feels familiar from day one.

## Start with one

You don't need multiple projects to use Flowti. Start with one. Add others as
they grow. Flowti adapts to each project's tools without forcing them into one
mold.
```

- [ ] **Step 2: Review against spec**

Read the spec section 4 (Multi-Project Orchestration). Verify all subsections: What it does, How it works (3 bullets), What you get across projects (3-4 bullets), Why it matters (2 bullets), Progressive. Verify health scoring mentions security component.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/docs/product/feature-multi-project.md"
git commit -m "docs: add Multi-Project Orchestration feature one-pager"
```

### Task 6: Write the Markdown Advantage feature one-pager

**Files:**
- Create: `01 - Projects/Flowti CLI/docs/product/feature-markdown-advantage.md`

**Source:** Spec section 5 (The Markdown Advantage).

- [ ] **Step 1: Write the markdown advantage one-pager**

Create `01 - Projects/Flowti CLI/docs/product/feature-markdown-advantage.md` with:

```markdown
# The Markdown Advantage — Your Data, Your Files, Your Terms

Everything Flowti produces is a plain text file in your repository.
No database, no proprietary format, no lock-in.

---

## The philosophy

Every piece of data Flowti manages — project records, event definitions,
reports, management data, agent output — is stored as a markdown file with
structured frontmatter in your repository.

This is a deliberate choice. Markdown is universal. It's readable without
special tools, editable in any text editor, and version-controlled by git out
of the box. Your project data isn't trapped in a vendor's database. It's right
there in your repo, alongside the code it describes.

## What this means in practice

**Every change is a git commit.** Who changed what, when, and why — all in
your version history. Roll back a decision. Blame a record. Diff two iterations
of a deliverable.

**Management changes appear in pull requests.** When someone updates a risk
assessment or marks a deliverable complete, it shows up in the same diff as
code changes. Reviewers see the full context.

**Search with the tools you already have.** Grep, your editor's search, or
Obsidian's query engine. No special query language, no API to learn.

**Event contracts are versionable.** Event definitions are markdown files with
structured frontmatter — domain, version, producers, consumers, payload schema.
Version them, diff them, validate them with the CLI. Your event catalog is as
reviewable as your source code.

**Works offline.** On a plane, in a cafe with bad wifi, on a train through a
tunnel. Flowti doesn't need an internet connection. Everything it needs is on
your machine.

**Portable by default.** Move to a different tool tomorrow. Your data is already
in a universal format. No export step, no migration script, no data loss.

## The Obsidian connection

Flowti is designed to work beautifully inside an Obsidian vault. Events link to
components, reports link to requirements, agents reference deliverables — all
through standard wikilinks that Obsidian understands natively.

But Obsidian is entirely optional. The CLI works standalone with any markdown
editor. The wikilinks are just regular `[[text]]` syntax that any tool can
ignore.

## Why it matters for your team

**No subscription, no migration.** Your data is files in a git repo. There's no
SaaS to subscribe to, no vendor to depend on, no "export as CSV" workaround when
you want your own data.

**Accessible to everyone.** Junior developers read project context in their editor
before asking questions. Stakeholders review records without needing access to a
platform. Auditors get a complete, versioned history by cloning the repo.

**Durable.** Markdown has been around for decades and isn't going anywhere. The
data you create today will be readable in ten years, with or without Flowti.

## The trade-off, honestly

Markdown files won't give you real-time dashboards or drag-and-drop boards.
There's no mobile app with push notifications. If your team needs those things,
Flowti isn't the right fit.

Flowti is for teams who believe the source of truth should live where the source
code lives.
```

- [ ] **Step 2: Review against spec**

Read the spec section 5 (The Markdown Advantage). Verify all subsections: The philosophy, What this means in practice (6 bullets), The Obsidian connection, Why it matters (3 bullets), The trade-off. Verify event catalog bullet is present. Verify Obsidian is framed as optional.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/docs/product/feature-markdown-advantage.md"
git commit -m "docs: add Markdown Advantage feature one-pager"
```

### Task 7: Final commit of all product content

- [ ] **Step 1: Verify all 5 files exist**

Run: `ls -la "01 - Projects/Flowti CLI/docs/product/"`
Expected: 5 markdown files (product-brief.md, feature-agent-workers.md, feature-project-management.md, feature-multi-project.md, feature-markdown-advantage.md)

- [ ] **Step 2: Verify no spec violations**

Read through each file and verify:
- No technical jargon (DI, MVC, ECS, DDD, ISP)
- No buzzwords (synergy, leverage, paradigm)
- Concrete language throughout
- Trade-offs acknowledged where relevant
- Progressive opt-in mentioned in each feature doc
- "Triggered by" not "subscribe to" for agent events
- "Starter roles" not "built-in roles"
- "Features" not "Lifecycle" in management domains
- Security scoped to dependency scanning

- [ ] **Step 3: Final commit if any corrections were made**

```bash
git add "01 - Projects/Flowti CLI/docs/product/"
git commit -m "docs: finalize product content — brief + 4 feature one-pagers"
```

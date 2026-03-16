# Product Content Design Spec

**Date**: 2026-03-16
**Status**: Approved
**Approach**: "Your Project's Operating System"
**Audience**: Small development teams (2-10 people)
**Tone**: Professional but approachable — clean product language, no buzzwords, polished but not corporate

---

## Deliverables

| # | Document | Title | Purpose |
|---|----------|-------|---------|
| 1 | Product Brief | Flowti — Your Project's Operating System | What Flowti is, who it's for, why it matters |
| 2 | Feature One-Pager | Agent Workers — AI That Reacts to Your Project | Persistent agents that react to project events and act |
| 3 | Feature One-Pager | Project Management — Built Into Your Codebase, Not Bolted On | Integrated management domains as markdown files |
| 4 | Feature One-Pager | Multi-Project Orchestration — One Binary, Every Project | Manage different project types from one CLI |
| 5 | Feature One-Pager | The Markdown Advantage — Your Data, Your Files, Your Terms | Local-first, git-friendly, no vendor lock-in |

---

## 1. Product Brief — Flowti — Your Project's Operating System

### What is Flowti?

One binary that gives your team a single entry point for building, testing, reviewing, and managing all your projects. No accounts, no cloud, no dependencies. Flowti is a project orchestrator that runs locally, stores everything as markdown, and treats AI agents as first-class participants in your workflow.

### Who is it for?

Small development teams (2-10 people) who want structure and visibility without adopting a platform. Teams that value owning their workflow, keeping things local, and staying lean. If your team has outgrown scattered npm scripts but doesn't want to onboard a DevOps platform, Flowti fills that gap.

### The Problem

- **Tools are scattered.** Build scripts in one place, test commands in another, project docs in a wiki, management in a SaaS tool. Every project is a little different.
- **Quality is invisible.** You don't know how healthy a project is until something breaks. Coverage drops, lint warnings pile up, tech debt grows — all silently.
- **Project context lives in silos.** Decisions, risks, requirements, and timelines sit in tools that aren't connected to the code they describe.
- **AI agents can't plug in.** Most workflows have no structured, non-interactive interface for agents to read project state and take action.

### How Flowti Solves It

- **AI agents that react to your project.** Persistent agent workers are triggered by project events and act — planning, reviewing, breaking down tasks. Not one-shot prompts; ongoing collaborators.
- **Project management alongside your code.** Resources, deliverables, risks, requirements, time tracking, and lifecycle management — all as markdown files in your repository.
- **Every project, one binary.** Manage multiple projects of different types with consistent commands, shared health scoring, and unified workflows.
- **Everything is a file you own.** Markdown with structured frontmatter. Git-friendly, diffable, searchable, editable in any tool. No vendor lock-in.

### How It Works

Install once. Point Flowti at your projects. Get a unified menu with every capability — build, test, review, publish, reports, management, agents. Start simple: run builds and tests. Then progressively opt into quality gates, health scoring, event catalogs, and agent workers as your team is ready. Nothing activates until you configure it.

### Key Principles

- **Zero dependencies.** One self-contained binary. No npm install, no lock file conflicts, no supply chain risk.
- **Progressive opt-in.** Start with nothing configured. Features activate when you're ready, not before.
- **Definition-driven.** Structured definitions drive the system — project config and UI layouts in JSON, management data and agent definitions in markdown. Auditable and diffable.
- **Local-first.** Everything runs on your machine, stores in your repository, and works offline.
- **Security included.** Health scores factor in vulnerability scanning alongside tests, coverage, and lint — no separate security tool needed.

---

## 2. Feature One-Pager — Agent Workers

### Agent Workers — AI That Reacts to Your Project

#### What it does

Persistent AI agents that live inside your project. They react to project events — task assigned, iteration moved, code reviewed — and act on them. Planning work, breaking down tasks, reviewing scope. Not one-shot prompts you invoke manually; ongoing collaborators that respond to what's happening in your project.

#### How it works

1. **Perceive.** An agent is triggered when something happens — a task was assigned, an iteration changed state, a scope item needs attention.
2. **Decide.** It evaluates its rules to determine the right response. Higher-priority rules take precedence when multiple events arrive.
3. **Act.** It executes in an isolated workspace — generating a plan, reviewing a deliverable, updating project state. Results are collected back to your project, stored as files, traceable in git.

#### Starter roles

- **Product Owner** — Refines iteration goals, identifies scope items, prioritizes work.
- **Software Architect** — Technical planning, breaks scope into tasks with file-level detail.
- These are included as ready-to-use definitions you can adapt. Teams can define their own agents with custom rules and event triggers. Each agent gets a definition file describing its role, capabilities, and what events it cares about.

#### Why it matters for your team

- Agents work with the same project data your team uses — markdown files, not a separate system.
- Every agent action is traceable — stored as files, diffable in git, reviewable in pull requests.
- No API keys required for non-AI agents. AI agents connect to your existing provider (Claude, Cursor, or a custom binary).

#### Progressive

Start without agents. Add them when your project is ready. They activate from a definition file — no infrastructure to set up, no service to run.

---

## 3. Feature One-Pager — Project Management Suite

### Project Management — Built Into Your Codebase, Not Bolted On

#### What it does

Integrated management domains that live right next to your source code as markdown files. Track resources, time, deliverables, risks, requirements, corrective actions, iterations, and project lifecycle — all from the same CLI you use to build and test.

#### The domains

- **Resources** — People, roles, budgets, and allocation.
- **Time Log** — Who worked on what, when, and how long.
- **Deliverables** — What's due, who owns it, how far along it is.
- **Iterations** — Plan work in time-boxed cycles with scope, capacity, and agent assignments.
- **RAID Log** — Risks, assumptions, issues, dependencies, and decisions in one place.
- **CAPA** — When something goes wrong: root cause, corrective action, verification that it's fixed.
- **Requirements** — User stories, use cases, and traceability back to deliverables.
- **Lifecycle** — Where each project, product, or feature sits in its journey, from inception to archive.

#### Why it matters for your team

- No separate tool to maintain. Management data lives in the same repository as the code it describes.
- Everything is a markdown file with frontmatter — readable in any editor, queryable in Obsidian, diffable in pull requests.
- One team member updates a deliverable status; the rest see it in their next git pull.

#### Not a replacement, a companion

Flowti doesn't try to replace Jira or Linear for daily ticket work. It gives your team a structured, version-controlled record of the decisions, risks, and progress that those tools don't capture well.

---

## 4. Feature One-Pager — Multi-Project Orchestration

### Multi-Project Orchestration — One Binary, Every Project

#### What it does

Manage multiple projects of different types from a single CLI. TypeScript libraries, CLIs, Obsidian plugins, web apps — each with its own build commands, test presets, and quality thresholds. One entry point, no monorepo setup required.

#### How it works

- Each project declares its capabilities in a config file — what it builds, how it tests, what thresholds to enforce.
- Flowti discovers your projects and presents them in a unified menu.
- Select a project and get its full lifecycle: scaffold, build, test, review, publish, reports, management.

#### What you get across projects

- Consistent commands regardless of project type — build, test, health, and reports work the same everywhere.
- Health scores you can compare across projects — same 0-100 scale, same A-F grading.
- Cross-project dependency detection with cycle analysis.
- Shared scaffold definitions so new projects start from proven templates.

#### Why it matters for your team

- No more "how do I run tests in that other project?" Every project follows the same patterns.
- New team members get productive faster because the workflow is the same everywhere.

#### Progressive

Start with one project. Add others as they grow. Flowti adapts to each project's tools without forcing them into one mold.

---

## 5. Feature One-Pager — The Markdown Advantage

### The Markdown Advantage — Your Data, Your Files, Your Terms

#### The philosophy

Everything Flowti produces and manages is a plain text file in your repository. Project data, event definitions, reports, management records, agent output — all stored as markdown with structured frontmatter. No database, no proprietary format, no vendor lock-in.

#### What this means in practice

- Every change is a git commit — who changed what, when, and why.
- Pull requests show management changes alongside code changes.
- Search anything with grep, your editor, or Obsidian's query engine.
- Event contracts are markdown files with structured frontmatter. Version them, diff them, validate them with the CLI.
- Works offline, works on a plane, works without an internet connection.
- Move to a different tool tomorrow — your data is already in a universal format.

#### The Obsidian connection

Flowti is designed to work beautifully inside an Obsidian vault. Events link to components, reports link to requirements, agents reference deliverables — all through standard wikilinks. But Obsidian is optional. The CLI works standalone with any markdown editor.

#### Why it matters for your team

- No SaaS subscription, no data migration, no "export as CSV" workarounds.
- Junior developers read project context in their editor before asking questions.
- Auditors and stakeholders review project records without needing access to a platform.

#### The trade-off, honestly

Markdown files won't give you real-time dashboards or drag-and-drop boards. Flowti is for teams who believe the source of truth should live where the source code lives.

---

## Content Guidelines

- **No technical jargon** — Avoid terms like DI, MVC, ECS, DDD, ISP unless explaining to engineers specifically.
- **No buzzwords** — No "synergy," "leverage," "paradigm shift." Say what it does plainly.
- **Concrete over abstract** — "A markdown file with frontmatter" beats "a structured data artifact."
- **Honest about trade-offs** — Acknowledge what Flowti doesn't do. Builds trust.
- **Progressive narrative** — Every feature doc should mention that it's opt-in, not mandatory.
- **Agent-centric framing** — AI agents are participants, not integrations. They use the same data humans do.
- **Event-centric framing** — The system reacts to what happens. Agents are triggered by events. State changes propagate.

## Output Location

All final content documents should be placed in:

```
01 - Projects/Flowti CLI/docs/product/
```

| File | Content |
|------|---------|
| `product-brief.md` | The product brief |
| `feature-agent-workers.md` | Agent Workers one-pager |
| `feature-project-management.md` | Project Management Suite one-pager |
| `feature-multi-project.md` | Multi-Project Orchestration one-pager |
| `feature-markdown-advantage.md` | The Markdown Advantage one-pager |

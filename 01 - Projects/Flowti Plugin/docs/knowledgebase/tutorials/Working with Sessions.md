---
type: KnowledgeBase
domain: Flowti
stage: done
description: How to create, run, pause, and complete focus sessions including session types, timers, and focus files.
tags:
  - tutorial
  - sessions
---

# Working with Sessions

> Sessions are timed blocks of focused work. They help you document your domain in short, productive bursts rather than trying to do everything at once.

---

## Why Sessions?

Documentation is most effective when you give it your full attention, even if only for a short time. A 25-minute session where you describe one business process is worth more than an hour of scattered, half-focused effort.

Flowti sessions provide structure: a timer, a type, guiding questions, goals, and a record of what you accomplished. They turn documentation into a habit rather than a chore.

---

## Session Types

When you create a session, you choose a type that matches the kind of work you want to do. Each type comes with a default duration and guiding questions to help you focus:

| Type | Duration | Purpose |
|------|----------|---------|
| **Documentation** | 25 min | Document systems, processes, and decisions |
| **Event Storming** | 50 min | Discover and map domain events |
| **Service Design** | 50 min | Design service boundaries and contracts |
| **Domain Design** | 50 min | Design bounded contexts and domain models |
| **Requirements Refinement** | 25 min | Refine and clarify requirements |
| **Backlog Structuring** | 25 min | Organize and prioritize backlog items |
| **Vault Hygiene** | 25 min | Clean up, reorganize, and maintain vault health |
| **Knowledge Cleanup** | 25 min | Consolidate and clean up existing documentation |
| **Train of Thought** | 25 min | Rapid serial thought capture with linked notes |

You are not locked into the default duration. Adjust the timer to fit your schedule.

---

## Creating a Session

1. Open the command palette and search for **Create new session**
2. Choose a **session type** from the list
3. Set a **duration** — the default is based on the type, but you can change it
4. Optionally add **goals** — short statements describing what you want to accomplish
5. Optionally set a **focus file** — a specific note you plan to work on during the session
6. Start the session

The session workspace opens, showing your timer, goals, guiding questions, and a log of your activity. The timer counts down in the background, so you can switch between notes freely while the session runs.

You can also open the session workspace from the sidebar. Search for **Open session workspace in sidebar** in the command palette to dock it on the right side of your screen.

---

## During a Session

While a session is running, Flowti quietly tracks your activity. It notices which files you open, create, and modify. This creates a record of what you worked on — useful when you look back later.

The guiding questions for your session type appear in the workspace. These are prompts to keep you on track:

- For an **Event Storming** session: "What events does this domain produce?" and "What triggers each event?"
- For a **Documentation** session: "What needs to be documented?" and "What is the current gap?"

You do not need to answer them formally. They are nudges, not requirements.

### Pausing and Resuming

Life happens. If you need to step away, you can pause your session. The timer stops, and you can resume later right where you left off.

- To pause, use the pause button in the session workspace
- To resume, open the command palette and search for **Resume paused session**

Your goals, activity log, and remaining time are all preserved.

---

## Completing a Session

When the timer runs out or you feel done, complete the session. Flowti will ask you to reflect briefly:

- What did you accomplish?
- Were the goals met?
- Any notes for next time?

This reflection is optional but valuable. Over time, your completed sessions build a history — a record of your documentation practice that shows progress and highlights patterns.

Completed sessions are saved as notes in your vault with structured frontmatter. You can browse them in the **User Hub** under the Sessions tab, or query them with [[Creating Analytics Queries|analytics queries]] to see trends.

---

## Session Templates

If you find yourself creating the same kind of session repeatedly — same type, same goals, same focus file — you can save it as a template. Templates let you start a pre-configured session with one click instead of filling in the same fields every time.

Templates are managed from the session workspace. Create a session the way you like it, then save it as a template for future use.

---

## The Session Lifecycle

Every session moves through a clear lifecycle:

1. **Created** — you set it up with a type, duration, and goals
2. **Running** — the timer is counting down and activity is being tracked
3. **Paused** — the timer is stopped, waiting for you to resume
4. **Completing** — you are reflecting on what you accomplished
5. **Completed** — the session is done and saved to your vault
6. **Abandoned** — if you close a session without completing it

This lifecycle is visible in the session workspace and in the session notes stored in your vault. Each state transition is recorded, giving you a complete timeline of your work.

---

## Tips for Effective Sessions

**Start small.** A 25-minute Documentation session is enough to describe one business process or create a handful of entity notes. Do not try to document everything in one sitting.

**Use the guiding questions.** They are there to prevent the blank-page problem. Even if you only address one question, that is progress.

**Review your history.** Check the User Hub periodically to see your session history. Patterns will emerge — you might notice you are most productive with morning Event Storming sessions, or that Vault Hygiene sessions every Friday keep things tidy.

**Combine with Train of Thought.** For rapid idea capture, start a Train of Thought session. See [[Using the Train of Thought]] for details.

---

## Next Steps

- [[Using the Train of Thought]] — A special session type for rapid idea capture
- [[Understanding Domains and Events]] — What to document during your sessions
- [[Using Quick Capture]] — Capture ideas quickly without starting a full session

# Onboarding Tour System

**Feature Owner:** Alice (Product Manager)
**Shipped:** 2026-03-15
**Audience:** Project managers using Flowti CLI for the first time

---

## What Is This?

The first time you launch Flowti CLI, you will not see an empty screen with a list of menu options you do not understand. Instead, Alice -- your PM agent -- meets you at the door and walks you through setting up your first project and planning your first iteration. The whole thing takes about five minutes.

When the tour is over, you have a real, working project with a planned iteration. You are not dropped into a sandbox or a demo. Everything you create during onboarding is your actual project, ready to manage.

---

## Quick Start

There is nothing to configure. Here is what happens:

1. **Install and launch Flowti CLI.** If you have never used it before (no projects exist), Alice takes over automatically.

2. **Alice introduces herself and Flowti.** She explains what the tool does and what you are about to accomplish together.

3. **You name your project.** Alice asks for a project name. Type it in and press Enter. She creates the project for you -- config files, directory structure, everything.

4. **You plan your first iteration.** Alice explains what iterations are, asks you to name your first one, and sets sensible defaults (14-day duration, start date of today). She shows you the defaults and asks you to confirm or change them.

5. **You use the real planning screen.** Alice sends you to the actual iteration planning page so you can add scope items. A small banner at the top reminds you to press `b` when you are done to return to the tour.

6. **Alice wraps up.** She tells you what features are now available and drops you on the normal start screen. You are oriented. You know where things are.

That is it. Five minutes, and you are productive.

---

## What If I Quit Halfway Through?

Your progress is saved to disk automatically after every step. Close the terminal, restart your machine, take a week off -- when you come back and launch Flowti CLI again, Alice picks up exactly where you left off.

---

## Controlling Onboarding from the Command Line

Every onboarding action is available as a non-interactive command. This is useful for scripting, CI environments, or if you simply prefer working that way.

| Command | What It Does |
|---------|--------------|
| `flowti onboarding:status` | Shows your onboarding state: not started, in progress (with current step), or complete |
| `flowti onboarding:start` | Starts a new tour or resumes one in progress |
| `flowti onboarding:skip` | Marks onboarding complete without running the tour. Use this if you already know Flowti and do not want the guided experience |
| `flowti onboarding:restart` | Resets everything -- clears your progress and the completion flag. The next time you launch, Alice will greet you again from the beginning |

---

## How Detection Works

Onboarding triggers automatically when **both** of these are true:

1. **No projects exist yet.** You have not created any project in Flowti.
2. **No completion flag exists.** The file `.flowti/onboarding-complete` has not been written.

Once you finish the tour (or skip it), the completion flag is written. Even if you later delete all your projects, Alice will not re-appear unless you explicitly run `flowti onboarding:restart`.

This means onboarding is a one-time experience by default. It stays out of your way after that first run.

---

## The Tour, Step by Step

Here is the complete sequence for the Project Manager tour:

| Step | What Happens |
|------|-------------|
| 1. Welcome | Alice introduces Flowti and sets expectations for the tour (~5 minutes) |
| 2. PM Tour Intro | Alice explains the goal: you will leave with a named project and a planned iteration |
| 3. Name Your Project | You type a project name. Alice validates it is not empty |
| 4. Scaffold Project | Alice creates the project -- config, directories, management folders. She tells you exactly what she created |
| 5. Checkpoint | "Project created" -- you see this on your progress checklist |
| 6. Iterations Intro | Alice explains what iterations are and why they matter for managing work |
| 7. Name Your Iteration | You type a name or goal for your first iteration |
| 8. Set Iteration Defaults | Alice proposes a 14-day duration with today as the start date. You confirm or override |
| 9. Iteration Planning | Alice sends you to the real iteration planning page. A hint banner guides you. Press `b` when done |
| 10. Checkpoint | "First iteration planned" |
| 11. What's Next | Alice summarizes what you built and points you to features you can explore: Management hub, RAID log, deliverables tracking |
| 12. Tour Complete | Onboarding is marked done. You land on the normal start menu, fully oriented |

---

## Alice's Role During the Tour

Alice is not a chatbot. She follows a scripted, curated flow designed to teach you the tool efficiently. Here is what to expect:

- **She explains before she acts.** When Alice is about to create something (like your project scaffold), she tells you what she is going to do and asks for confirmation first.

- **She suggests, never silently decides.** Auto-actions like setting iteration duration show you the proposed values and give you the option to override.

- **She sends you to real pages.** The delegation step (iteration planning) is not a simulation. You are using the actual planning interface. Alice just adds a small hint banner so you know you are still in the tour.

- **Her dialogue is consistent.** Alice speaks with a strategic, decisive tone. Her content comes from curated markdown files, not generated text, so the experience is reliable and polished.

---

## Adding Custom Tours (For Template Authors)

If you maintain a project template and want to provide a custom onboarding experience, the tour system is designed for extensibility.

**Tour content lives in `configs/onboarding/`:**

```
configs/onboarding/
  tours.json                         # Registry of available tours
  tours/
    project-manager/
      tour.json                      # Step definitions for this tour
      steps/
        01-welcome.md                # Markdown content for each step
        02-pm-intro.md
        ...
      hints/
        iteration-planning.md        # Contextual hints shown on delegated pages
```

**To add a new tour:**

1. Create a new folder under `configs/onboarding/tours/` (e.g., `developer/`)
2. Add a `tour.json` defining your steps
3. Add markdown files for each step in a `steps/` subfolder
4. Register the tour in `configs/onboarding/tours.json`

No code changes are required. When multiple tours exist, Alice presents a selection screen. When only one tour exists (the default), it auto-selects.

**Step types you can use:**

| Type | Purpose |
|------|---------|
| `narrate` | Alice presents information from a markdown file |
| `prompt` | Alice asks the user for input (supports `non-empty` and `slug` validation) |
| `auto` | Alice performs an action on the user's behalf (with confirmation) |
| `delegate` | Tour navigates to an existing Flowti page with contextual hints |
| `checkpoint` | Marks a milestone on the progress checklist |

**Template variables** in content files use `{{token}}` syntax (e.g., `{{projectName}}`). These are resolved at runtime from the accumulated context of the user's inputs during the tour.

---

## Frequently Asked Questions

**Q: I already know Flowti. How do I skip onboarding?**
Run `flowti onboarding:skip` before your first launch, or press the skip option when Alice greets you. Either way, the completion flag is written and onboarding will not trigger again.

**Q: Can I redo the onboarding tour?**
Yes. Run `flowti onboarding:restart`. This clears your progress and the completion flag. The next time you launch Flowti CLI, Alice will start the tour from the beginning.

**Q: Does onboarding create a real project or a demo project?**
A real project. Everything you set up during onboarding -- the project config, the iteration, the scope items -- is your actual working data. There is no "training mode."

**Q: What if I close the terminal during the tour?**
Your progress is saved after every step. When you relaunch, Alice resumes from where you left off. No work is lost.

**Q: Will onboarding trigger again if I delete all my projects?**
No. Once the completion flag (`.flowti/onboarding-complete`) is written, onboarding will not trigger again regardless of project state. Use `flowti onboarding:restart` if you want to re-enter the tour.

**Q: Can I have multiple onboarding tours for different roles?**
Yes. The tour system supports a registry of tours. Add new tour definitions to `configs/onboarding/tours.json` and create the corresponding content files. When multiple tours are available, Alice presents a selection screen.

**Q: Where is my onboarding progress stored?**
Progress is persisted at `.flowti/var/onboarding-progress.json`. The completion flag is at `.flowti/onboarding-complete`. Both are local to your machine and not committed to version control.

**Q: Does onboarding work in CI or non-interactive environments?**
Yes, via the CLI commands. `flowti onboarding:skip` marks onboarding complete without any interactive prompts. `flowti onboarding:status` reports the current state in a format suitable for scripting.

---

## Technical Reference

For contributors and those who want to understand the internals:

- **Domain module:** `src/domain/onboarding/` (types, detection, tour engine, progress store)
- **Controller:** `src/controller/onboarding.controller.ts`
- **UI handlers:** `src/ui/handlers/onboarding-handlers.ts`
- **Sitemap pages:** `onboarding`, `onboarding-tour`, `onboarding-checklist`
- **Design spec:** `docs/specs/2026-03-15-onboarding-tour-system-design.md`
- **Implementation plan:** `docs/plans/2026-03-15-onboarding-tour-system.md`

---
type: KnowledgeBase
domain: Flowti
stage: done
plugin: "[[Development/flowti/README|README]]"
description: Step-by-step guide for first-time users — from opening the User Hub to creating a living, connected documentation system.
tags:
  - guide
  - onboarding
  - user-hub
  - documentation
---

# User Guide — Getting Started with Flowti

> Your first steps toward a living documentation system. No technical background required — just curiosity and a willingness to describe how your world works.

---

## Welcome

You just installed Flowti. The setup wizard created your profile and a simple folder structure in your vault. Now what?

This guide walks you through your first hour with Flowti. By the end, you will have:

- Explored your personal workspace
- Described a piece of your domain in your own words
- Brought external data into your vault
- Seen how everything connects itself — without you wiring it up

No code. No configuration files. Just you, your knowledge, and a system that listens.

---

## 1. Open the User Hub

The **User Hub** is your personal home base. Think of it as your desk — the place where your work begins each day.

Open it from the sidebar or the command palette. The first time you visit, you will see a short welcome message and a handful of suggestions for what to do next. These tips will appear once and disappear when you dismiss them — they are here to orient you, not to nag.

### What you will find

The User Hub is organized into a few tabs:

- **Dashboard** — A snapshot of today: recent activity, things that need attention, quick actions
- **My Work** — Items assigned to you or that you have been working on
- **Sessions** — Your documentation sessions and their history
- **Insights** — A quiet view of your contributions over time

You do not need to fill all of these right away. They will populate as you work. For now, just notice that they are there — your workspace will grow with you.

---

## 2. Describe Your Domain

Here is the most important thing to understand about Flowti: **documentation is not a chore you do after the real work — it IS the work.**

Every note you write, every field you fill in, every connection you draw becomes part of a living system. Not a dusty wiki. Not a forgotten document. A living, breathing picture of how your world operates.

### Start with what you know

You do not need to write a technical specification. You do not need to use special terminology. Just answer simple questions about your area of responsibility:

- **What is your domain?** Give it a name. "Customer Onboarding." "Supplier Management." "Order Fulfillment." Whatever you call it in conversation with colleagues.

- **What do you do in this domain?** Write it like you are explaining it to a new team member on their first day. "We receive orders from the website, check inventory, and coordinate with the warehouse to ship on time."

- **What are the main things you work with?** These are your entities — the nouns of your domain. Orders. Suppliers. Invoices. Products. Customers. You do not need to define them formally. Just name them.

- **What happens in your domain?** Things get created, approved, shipped, rejected, archived. These are your events — the verbs. Again, plain language is perfect.

### How to create your first domain document

1. Open the **Event Catalog** from the sidebar
2. Navigate to the **Domains** tab
3. Click the **+** button to create a new domain
4. Give it a name — the name you actually use, not a formal title
5. Write a short description in your own words

That is it. You just planted the first seed of your living documentation. The system now knows this domain exists and will start connecting things to it as you add more.

### Keep going at your own pace

From your domain document, you can:
- List the services that operate within it
- Name the main things (entities) you work with
- Describe the events that happen — orders placed, approvals given, shipments dispatched

None of this needs to be perfect. Write what you know today. Come back tomorrow and add more. The system is patient.

---

## 3. Bring Your Data In — Import

You probably already have data sitting in spreadsheets, CSV exports from other tools, or tabular reports your team produces. Flowti can turn these into structured notes — each row becomes a note, each column becomes a property.

### Why this matters

When your data lives as notes with properties, it becomes part of the living system. It can be browsed, filtered, linked to domains, and connected to everything else. A CSV sitting in a shared drive is inert. The same data imported into your vault is alive.

### How to import

1. Drop a `.csv` file into your vault (or it may already be there)
2. **Right-click** on the CSV file
3. Choose **"Import as Notes"**
4. A wizard opens with four steps:

   **Source** — The file you selected is already loaded. Confirm it looks right.

   **Configure** — This is where the magic happens:
   - Pick a **target folder** — where should the new notes go?
   - Choose a **name column** — which column becomes the note title? (e.g., "Product Name" or "Order ID")
   - **Map columns to properties** — each CSV column becomes a frontmatter property on the note. You can rename them, skip columns you do not need, or adjust types.
   - Choose a **conflict strategy** — what happens if a note with that name already exists? Skip it, update it, or overwrite it.

   **Preview** — See exactly what will be created before anything is written. Check a few entries. Adjust if needed.

   **Result** — Done. The system tells you how many notes were created, updated, or skipped.

### What happens next

Your imported notes now live in the vault with structured frontmatter. Open any note and you will see the properties at the top. These properties make the notes searchable, filterable, and — most importantly — connectable.

You can also **save the import configuration** so you can repeat it later when you get an updated CSV. No need to reconfigure everything.

---

## 4. Explore and Enrich — The Data Exchange Hub

The **Data Exchange Hub** is where you manage everything flowing in and out of your vault. Open it from the sidebar.

### What you will find

- **Dashboard** — Overview of recent import and export activity
- **Reports** — All CSV files discovered in your vault, ready to preview or import
- **Types** — A registry where you can describe the kinds of data you work with
- **Properties** — Every property (frontmatter field) found across your vault, with the ability to document what each one means
- **Imports** — Your saved import configurations, ready to run again
- **Exports** — Your saved export configurations
- **Pipelines** — Multi-step sequences that chain imports together

### The Properties tab — your data dictionary in the making

This is one of the most quietly powerful features. As you import data and create notes, properties accumulate. The Properties tab shows you all of them in one place.

Take a few minutes to browse through. You will likely see properties like `type`, `domain`, `stage`, `name`, `description`. Some you created. Some came from imports. Some were there from the start.

For each property, you can add a short description — what does this field mean? What values are expected? This small act of documentation pays forward. The next person (or future you) who encounters a property called `status` will know whether it means "draft / done" or "open / closed / archived."

---

## 5. Share Your Data — Export

What goes in can also come out. Export lets you take structured vault data and produce clean CSV or tab-delimited files for sharing, reporting, or feeding into other tools.

### How to export

1. **Right-click** on a `.base` file (a database view) or a folder
2. Choose **"Export as CSV"** or **"Export as Tab-delimited"**
3. A wizard opens:

   **Configure** — Choose which columns to include, the output format, where to save, and what to do if the file already exists.

   **Preview** — See the tabular output before writing.

   **Result** — File created. Share it, email it, or feed it into another system.

Like imports, you can **save export configurations** for repeat use. A weekly report becomes a one-click operation.

---

## 6. Chain It Together — Pipelines

Once you have a few saved import configurations, you can combine them into a **Pipeline** — a sequence of import steps that run one after another.

### When pipelines help

- You receive multiple CSV files from different sources each week
- The files need to be imported in a specific order
- You want to press one button instead of running imports individually

### How to create a pipeline

1. Open the **Data Exchange Hub**
2. Go to the **Pipelines** tab
3. Click **+** to create a new pipeline
4. Add your saved import configurations as steps
5. Drag to reorder if needed
6. Choose whether to stop on errors or continue
7. Save and run

The pipeline shows you progress per step — how many rows were processed, which steps succeeded, and whether anything needs attention.

---

## 7. How Everything Connects

Here is the part that makes Flowti different from a collection of tools: **everything you do creates connections automatically.**

### The organic loop

When you imported that CSV of suppliers, you created notes with properties. When you created a domain called "Supplier Management," you gave those notes a home. When you described the events in your domain — "supplier approved," "contract renewed" — you gave the system vocabulary.

Now look at what happened without you doing anything extra:

- The **Event Catalog** shows your domain with its events and entities
- The **Data Exchange Hub** tracks the properties your import introduced
- Your **User Hub** reflects the work you have done — domains documented, data imported, sessions completed
- The **Health** checks know which entities are documented and which still need attention

You did not wire any of this together. You described your world, brought in your data, and the system connected the dots.

### The cycle continues

Tomorrow, you will come back and:
- Import an updated CSV — the system updates existing notes and creates new ones
- Add a new event to your domain — "shipment delayed" — and the catalog updates
- Start a documentation session — spend 25 focused minutes describing a business process
- Check the health score — see it climb as gaps fill in

Each action feeds the next. Documentation is not a one-time effort. It is a habit — a small daily investment that compounds into a comprehensive, living picture of how your organization works.

---

## 8. Your First Hour — A Suggested Path

If you want a concrete starting point, here is a path through your first hour:

| Time | Action | Where |
|------|--------|-------|
| 0:00 | Open the User Hub, read the welcome tips | User Hub |
| 0:05 | Browse the Event Catalog — look at the Dashboard and Events tab | Event Catalog |
| 0:10 | Create your first domain — name it, describe it in one paragraph | Event Catalog → Domains → + |
| 0:15 | List 3–5 entities in your domain (the things you work with) | Your domain document |
| 0:20 | List 3–5 events in your domain (the things that happen) | Your domain document |
| 0:25 | Import a CSV file — pick something small, 10–50 rows | Right-click CSV → Import |
| 0:35 | Browse the imported notes — check the frontmatter | Your vault |
| 0:40 | Open the Data Exchange Hub — explore the Properties tab | Data Exchange Hub |
| 0:45 | Document 2–3 properties — write what they mean | Properties tab |
| 0:50 | Check the Health tab — see your starting score | Event Catalog → Health |
| 0:55 | Note one gap the health check found — plan to address it tomorrow | Your notes |

By minute 55, you have a domain, entities, events, imported data, documented properties, and a health baseline. Not bad for an hour.

---

## 9. Principles to Keep in Mind

**Write like you talk.** The system does not need formal language. It needs your knowledge in whatever words feel natural.

**A little every day beats a lot once.** Five minutes of documentation today is worth more than an hour planned for "someday." The documentation sessions have a built-in timer for exactly this reason.

**Name things consistently.** If you call it "Supplier" in one place, do not call it "Vendor" in another. Consistent naming is the single most powerful thing you can do for a living documentation system.

**Trust the connections.** You do not need to manually link everything. Create notes with good frontmatter, and the system will find the relationships. Your job is to describe — the system's job is to connect.

**Check health regularly.** The health score is not a judgment — it is a compass. It shows you where the gaps are so you can fill them when you have time.

---

## What Comes Next

This guide got you started. As you grow more comfortable, you will discover:

- **Documentation Sessions** — Focused, timed sessions for specific types of work (event storming, service design, requirements refinement)
- **Flows** — Step-by-step descriptions of how business processes work, connected to domains and events
- **Subscriptions** — Watch for specific events and get notified when they happen
- **Event Definitions** — Map raw file events to meaningful domain events
- **Pipelines** — Automate recurring multi-step imports
- **Domain Hubs** — Dedicated workspaces for each domain you manage

You do not need to learn all of this now. The system reveals its depth as you need it. Start with your domain, your data, and your daily practice. The rest will follow.

---

*Welcome to Flowti. Your documentation is now alive.*

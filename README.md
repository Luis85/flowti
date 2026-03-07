# Flowti - The Business Development Environment

## Introducing the Flowti Business Framework

> Goal of this project is to provide a simple tool which documents itself and it's usage to iterate quickly and to codify what I learned.

This is a pre-configured Obsidian Vault, ready to go as documentation system called "Flowti - IBDE" an integrated business development environment and management system.
Goal of this framework is to provide all necessary utilities to describe and visualize digital twins of things.

This document describes how to get the current implementation up and running.
The Repository consists of multiple parts, the Flowti Framework, a combination of PKM, Design, and Play-testing, the Foreign Folder Mapper to connect to shared folders, and the OneSeater - Motorsport Manager, an example implementation of Flowti in a game environment. All provided as source in `Development`.

To start your journey you will need to have Obsidian installed which serves as a host for the application. Go get it, install it, and then come back. You will not regret it, trust me bro!

> This Repo also tests, validates, and simulates the Flowti Development Process.

---

## Why tho?

First: Curiosity! Demystifying Product-Development
Second: There is no guided structure to start in Obsidian, makes adopting hard.
Third: [[How can AI help to improve product-development quality]]?

## About me

- studying economy since 2010
- various roles as consultant in IT and Product
- my 3 biggest hobbies are gaming, design, and coding

---

## Prerequisites

> You want a **system that turns structured thinking into structured execution**.

Before we get started, make sure the following things are in place:

- Git is installed
- Node is installed
- [Obsidian](https://obsidian.md) is installed
- Obsidian Git Community Plugin is installed and  enabled
- Obsidian CLI is activated

---

## Tutorial - How to get in

### Step 1 - Clone and install

```bash
git clone <repo-url>
cd Development/flowti
npm install
```

Open the repository root as an **Obsidian vault**.

### Step 2 - Build and activate the plugin

From the vault root, use the **Flowti CLI**:

```bash
# Windows
flowti.cmd build

# Unix / Git Bash
./flowti.sh build
```

Then in Obsidian: **Settings → Community Plugins → Enable "Flowti - IBDE"**.
The Installer Wizard appears on first launch — follow the steps to scaffold your vault.

### Step 3 - Explore and start your journey

```bash
flowti.cmd              # Interactive menu — discover all capabilities
flowti.cmd help         # Full command reference
flowti.cmd info         # Project stats, version, config health
```

In Obsidian, hit `Ctrl+P` and try:
- **Open User Hub** — your personal dashboard (sessions, inbox, commands)
- **Open Event Catalog** — explore domains, services, events, and flows
- **Start Train of Thoughts** — begin a new documentation journey

For the full onboarding walkthrough, see [[03 - Resources/Documentation/Tutorials/Tutorial - How to get in|Tutorial - How to get in]].

---
## Current Ideas and Concepts to work on

- How to migrate Flowti IBDE Development into the Flowti structure
- How can Flowti support rapid-prototyping or extreme-programming
- How to manage a GitHub repo out of Flowti
- How to manage an Obsidian Plugin within Flowti
- How to come from Idea to Solution to Feedback to Improvement to Product Market Fit to Release and Publishing to Continuous Improvement
- How can we manage an Obsidian Plugin like a Product, guided by industries best-practices

---

## Testlab - The OneSeater Motorsport Manager

### The Office

![[OneSeater Main Dashboard View.png]]

### The Market

![[OneSeater Marketplace View.png]]

### The Compendium

![[OneSeater Compendium.png]]

### Product Catalog

![[OneSeater Product Configurator.png]]

### CFD Simulation PoC (Ideas for later gameplay)

![[OneSeater Windtunnel Ideas.png]]



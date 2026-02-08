# Flowti - The Business Development Environment

## Introducing the Flowti Business Framework

this is a preconfigured Obsidian Vault, ready to go as documentation system called „FLOWTI - IBDE“ an integrated business development environment and management system.
Goal of this framework is to provide all necessary utilities to describe and visualize digital twins of things.

This document describes how to get the current implementation up and running.
To get the most out of our documentation we use Obsidian and Git. The Repository consists of two parts, the Flowti Framework, a combination of PKM, Design, and Playtesting, and the OneSeater - Motorsport Manager, an example implementation of Flowti in a game environment.

To start your journey you will need to have Obsidian installed which serves as a host for the application. Go get it, install it, and then come back. You will not regret it, trust me bro!

## Why tho?

Curiosity

## About me

- studying economy since 2010
- various roles as consultant in IT and Product
- my 3 biggest hobbies are gaming, design, and coding

## Prerequisites

Before we get started, make sure the following things are in place:

- Git is installed
- Node is installed
- [Obsidian](https://obsidian.md) is installed
- Obsidian Git Community Plugin is installed

## Tutorial - How to get in

### Step 1 - Clone the repo

- Copy the repo url
- Open Obsidian
- Create a new Vault
- Enable the Git Community Plugin
- Open the Command Palette
- Git Clone into `/05 - Public Vault`

### Step 2 - Folderstructure

- `/00 - Connectivity`
- `/01 - Projects`
- `/02 - Areas`
- `/03 - Resources`
- `/04 - Archive`
- `/05 - Public Vault`
- `/var`

### Step 3 - Plugins

In order to use the plugins, you must build them from source. You'll find the available plugins in `/Development/` with build instructions in their `README`.

1. Build and install the `Flowti - IBDE` Plugin ->[[Development/flowti/README|README]]
2. Build and install the `Foreign Folder Watcher` to import from outside folders
3. Build and install the `OneSeater - Motorsport Manager` to play with a gamified implementation

To update, you need to `git pull` from remote and build the plugin again.


> [!NOTE] Heads up
> This is a temporary solution, in a future release Plugins will be installed trough BRAT


## Roadmap

- Flowti Installer
- Dedicated Plugin Repos
- GitHub Integration
- Release Workflow
- …
- Flowti v1.0.0

## OneSeater - Impressions

### The Office

![[Pasted image 20260101112430.png]]

### The Market

![[Pasted image 20260101112515.png]]

### The Compendium

![[Pasted image 20260101112811.png]]

### Product Catalog

![[Pasted image 20260101112549.png]]

### CFD Simulation PoC (Ideas for later gameplay)

![[Pasted image 20260101112142.png]]



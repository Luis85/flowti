---
type: Idea
stage: planned
origin: inbox
domain: installer
parent: "[[Installer PRD]]"
pbi: PBI-005
description: "Feed folder-structures from JSON config files to the installer for better isolation, tracking, and documentation."
tags:
  - release-blocker
  - RB-1
priority: "00 - critical"
rank:
related:
  - "[[I want the installer to use a versioned JSON folder config instead of hardcoded paths]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Elaborated into dedicated item. See [[I want the installer to use a versioned JSON folder config instead of hardcoded paths]] for full spec."
---

In order to be more flexible, the installer must be able to get fed folder-structures from json config files.

The user should not get in touch with that. This is to better isolate and track the structure. The folder-structure is an essential part of documentation, it should be useable as baseline for future documentation purposes within the app.

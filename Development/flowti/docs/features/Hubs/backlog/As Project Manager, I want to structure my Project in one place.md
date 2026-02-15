---
type: UserStory
feature: "[[Hubs PRD]]"
stage: draft
domain: Flowti
parent: "[[Project Manager]]"
persona: Project Manager
tags:
  - user-story
  - hubs
---

# As Project Manager, I want to structure my Project in one place

## Story

As a project manager, I want a dedicated Project Hub where I can see all work items, track progress, manage documentation sessions, and have a dashboard summarizing project health — so that I don't have to navigate across scattered notes and manually assemble the status of my project.

## Notes

- The Project Hub is one of the domain-specific Hubs defined in the Hubs PRD (PBI-004)
- It depends on the Hub shell and layout foundation (TD-49, TD-50)
- Key tabs: Dashboard (KPIs), Work Items (status filtering), Sessions (documentation sessions)
- v1 is read-only (views existing vault structure, doesn't create through custom forms)
- Similar to Product Hub — both may share a `DomainHubAdapter` base class

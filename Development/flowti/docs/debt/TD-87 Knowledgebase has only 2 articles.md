---
type: TechDebt
severity: low
category: documentation
layer: cross-cutting
status: resolved
effort: medium
updated: 2026-02-27
resolved_in: Cycle 50
description: The knowledgebase contains only 2 articles (a daily notes guide and one tutorial). Insufficient for onboarding, daily workflow guidance, or self-service problem solving.
---
# TD-87: Knowledgebase has only 2 articles

## Problem

The `/docs/knowledgebase/` directory contains:

1. `How to use daily notes for documentation.md` (26 lines) — guidance on daily notes pattern
2. `tutorials/Creating a Service.md` — scaffolding tutorial

For a documentation system with 400+ files, 16+ document types, 136 events, 11 domain services, and 28 features, a 2-article knowledgebase provides negligible self-service value.

Missing tutorial topics (inferred from system complexity):
- Creating a Domain document
- Creating a Feature PRD
- Configuring Event Definitions
- Setting up a Flow document
- Working with the Data Dictionary
- Running a Three Amigos session
- Scoring Feature Readiness (FRI)
- Scoring Domain Maturity (DMI)
- Navigating the Event Catalog
- Understanding the Development Lifecycle phases

## Impact

- Onboarding requires direct mentorship — documentation cannot self-serve
- Workflow patterns are locked inside templates rather than demonstrated through tutorials
- The Product Service Book and Domain Book templates reference processes that have no how-to guides
- Common tasks require reading 800+ line architecture docs instead of targeted tutorials

## Suggested Remediation

1. Identify the top 5 most common documentation tasks and create tutorials for each
2. Extract "how to" content from existing architecture docs into knowledgebase articles
3. Link tutorials from the templates they support (e.g., PRD Template → "How to write a PRD" tutorial)
4. Add `type: KnowledgeBase` frontmatter to all knowledgebase articles

## Resolution (Cycle 50)

10 tutorial articles added in `docs/knowledgebase/tutorials/` covering core workflows: Building Dashboards, Building Data Exchange Configs, Connecting to Azure DevOps, Creating Analytics Queries, Creating Your First Event Definition, Importing CSV Data, Understanding Domains and Events, Using Quick Capture, Using the Train of Thought, Working with Sessions. Knowledgebase now has 12 articles total (2 existing + 10 new).

## Affected Files

- `docs/knowledgebase/` (needs additional articles)

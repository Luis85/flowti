---
doc_type: Vault
Description:
aliases:
  - Flowti
tags:
  - concept
  - project
  - framework
---

> [!tip] The Progressive Documentation Framework
> Providing tools and methods to document progress in a federated knowledgegraph

The User Vault is the place to bring ideas to live. It acts as platform for designing, documentation, and fast iteration. With it‘s optional git integration the whole world of automation, traceability, and auditability get‘s opened.

By providing essential tools for fast integrations, prototyping, tests, operations, and documentation of results all in one place, time to market gets shorten while knowledge gets solidified and processes streamlined over time.

Using Obsidians strengths in editing and organizing content an end-to-end documentation and quality workflow is possible.

Those concepts are adaptable and usable down to a personal level to form a flexible framework for data integration, enrichment, publication, and automation.

> The perfect solution for the data obsessed.

The system treats it’s files like a codebase, by using git as versioning tool and Markdown as file format, the system can always tell about it‘s history and easily adopt industry best-practices. This requires every project to start as soon as possible as new note in Obsidian.

The Vault evolves and growths as the whole system it monitors, shapes and forms but the system only shines with its integrations and daily usage as a federated knowledge graph.

To get started, just follow the provided links or explore the Vault with the sidebar navigation.

For direct contribution, just open today‘s daily note.

```base
filters:
  and:
    - file.inFolder("03 - Resources/Daily Notes")
views:
  - type: cards
    name: Daily Notes
    order:
      - file.name
      - file.links
      - file.tags
    sort:
      - property: file.name
        direction: DESC
    limit: 4
    image: note.Image

```

[[05 - Public Vault/Design/flowti/Flowti IBDE/Knowledgebase/How to use daily notes for documentation]]

To give our data meaning we use the provided bases as much as possible, for easy house-keeping the [[DATAQUALITY]] base comes in handy.


---

## Proof of Concept

- [[HOMEPAGE]]
- [[Business Operations Service Design.canvas|Service Design Operations]]
- [[Operations Specialist System Design.canvas|Operations Specialist System Design]]
- [[Operations Workspace.canvas|Operations Workspace]]


---

## Domains Activity Log

```base
filters:
  and:
    - file.inFolder("02 - Areas/Obsidian - The Vault")
views:
  - type: table
    name: Table
    order:
      - file.name
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
    limit: 5

```

## System Components

For better maintainability the system is split into domains it provides value for. Those are the bricks laying out the systems foundation and defining the frameworks capabilities.

Main goal should be to stick to a minimum set of external plugins to reduce dependencies therefor documentation needs of each domain should first be evaluated with Obsidian Core Plugins. 

### 🏛️ Root System

- [[Flowti - Business System]]
- [[The Digital Twin]]

The current implementation touches on the following domains:

#### 🧩 Core Domains

- [[Operations Management]]
- [[Delivery Management]]
- [[Project Management]]
- [[Product Management]]
- [[Quality Management System (QMS Hub)]]
- [[Data & Analytics]]
- [[Knowledge Graph]]

---

#### ⚙️ Operations Domains

- [[Retail Operations]]
- [[Professional Services Operations]]
- [[SaaS Operations]]
- [[ERP Integration (Epicor P21)]]
- [[Automation & Workflow (Power Platform)]]

---

#### 🚀 Delivery & Product Domains

- [[Dual-Track Agile Framework]]
- [[Project Management]]
- [[Requirements Engineering]]
- [[Software Architecture]]
- [[UX & UI Design]]
- [[Service Design]]
- [[Gamification Framework]]
  - [[Onboarding & Training]]

---

#### 📘 Quality & Governance

- [[Governance & Compliance]]
- [[Continuous Improvement (PDCA/CAPA)]]

---

#### 🧱 Documentation & Templates

- [[Documentation Framework]]
- [[Templates & Artifacts Library]]

---

### Core Entities

- [[Note]]
- [[Base]]
- [[Canvas]]
- [[Domain]]
- [[Hub]]
- [[Entity]]
- [[System]]
- [[Actor]]
- [[03 - Resources/Entities/Item]]

---


### Folderstructure

The systems folderstructure follows the PARA method and extends for connectivity and data storage from the outside.

[[What is the PARA Method]]

#### 📁 00 - Connectivity

Is used for data exchange with other systems, mainly via csv imports and exports.

#### 📁 01 - Projects

Big and new topics you are contributing to.
Projects are usually used to improve or add domains to the system.

#### 📁 02 - Areas

Internalized domains you are responsible for.
Each domain ships it‘s own datamodel, building on top of the existing one. Defining and extending the core domain modell.

#### 📁 03 - Resources

Tools, Documentation, and Procedures needed for day-to-day business. This is also the place where the system documents it‘s domain model and configuration.

#### 📁 04 - Archives

Old and obsolete notes.

#### 📁 src

Used for custom development.

#### 📁 var

Storage for external data, like events, logs, or data records used for further processing.

## Open Questions

[[How to get started]]
[[How to publish out of Obsidian]]
[[How to import files into Obsidian]]
[[How to export out of Obsidian]]
[[How to integrate with Azure DevOps]]
[[How to integrate with HubSpot]]
[[How to integrate with Shopify]]
[[How to integrate with ERP systems]]
[[How to automate with Obsidian]]
[[How to install the Vault]]
[[How to use the system to its fullest]]
[[05 - Public Vault/Design/flowti/Flowti IBDE/Knowledgebase/How to use daily notes for documentation]]
[[How to document a project]]
[[How to document business operations ]]

## Information Architecture

### Domain Driven Design

### Hub and Spoke Architecture

To publish content the Vault follows a Hub and Spoke Architecture. The Vault is always treated as root hub for everything. Hubs are used whenever something needs to get published and maintained by a team. Every otherwise in the system defined hub needs to provide the following functionality:

- CSV Import
- CSV Export
- PDF Export
- Website Content
- Dashboard

Hubs get created in the 03 - Resource/Hubs folder and can have an owner, usually a domain.

For details, view: 

- [[Hub and Spoke Architecture Concept]]

A Hub should be treated as Information Platform for and between teams or bigger topics. In best-case scenarios everybody works out of Obsidian and has access to the same information. In cases where this setup is not possible, integrating with Websites would easy doable.

## Statistics of the Vault

- Count Files
- Count Typed Files
- Count Files by extension 
- Count Created by Day
- Count Modified (modified - created) by Day
- Count Tagged
- Count Words by Day

---

## Processes the Vault needs to support

- [[The Vault - Publishing Process]]
- [[The Vault - Contribution Process]]
- [[The Vault - Importing and Exporting]]
- [[The Vault - Reporting Process]]


---

## Obsidian Plugins

- [[Obsidian - Git Plugin]]
- [[Obsidian - CSV/JSON Importer Plugin]]
- [[Obsidian - Advanced Canvas Plugin]]
- [[Obsidian - Calendar Plugin]]

---

## Datamodel of the Vault

These are the building blocks of the Vault. By adding types and relations to the documents, the system can provide more and more context, giving valuable insides into the data sets. 

- Ideas
- Opportunity
- Hubs
- Files
- Entities
- Actors
- Use Cases
- Domains
- Systems
- Services
- Components 
- Events
- Requests
- Requirements
- Risks
- Decisions
- Reports
- Documents
- Imports
- Exports
- Templates
- Tasks
- Notes
- Bases
- Canvas
- Daily Note
- Markdown
- CSV
- Flows
- Processes
- Tests
- Epic
- Feature
- User Story
- Issue
- Bug
- Product
- Project
- Item
- Line Item
- Line of Business
- Workspace
- Workbench
- Workstream
- Objective
- Improvement
- Iteration
- Measurement
- KPI
- Categories
- Playbooks
- Audits
- User
- Role
- Permission
- Sitemap
- Consumer
- Roadmap
- Prosumer
- Resources
- Budgets 


---

## Glossary

```base
filters:
  and:
    - file.inFolder("02 - Areas/Obsidian - The Vault/Glossary")
views:
  - type: table
    name: Table
    order:
      - file.name
      - Description
      - type
      - domain
      - Category
      - tags

```



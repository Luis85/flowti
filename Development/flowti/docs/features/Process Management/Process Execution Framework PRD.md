---
type: ProductRequirementsDocument
domain: Flowti
stage: draft
priority:
tags:
---
# Feature: Process Execution Framework (PEF)

---

## 1. Overview

**Feature Name:** Process Execution Framework  
**Domain:** Core Platform / Governance / Execution  
**Stage:** Draft  
**Maturity Target:** L1 → L5  
**First Increment:** Flowti Onboarding Process

---

## 2. Vision

Flowti shall enable the modeling, execution, monitoring, and continuous improvement of structured processes directly inside an Obsidian Vault.

A process is:

- Designed visually (Canvas-based)
    
- Documented structurally (Markdown + Base)
    
- Stored formally (JSON)
    
- Executed interactively (Operator UI)
    
- Measured continuously (Dashboard)
    
- Event-driven
    
- Versionable
    
- Exportable / Importable
    

The first executable system using this framework will be:

> The Flowti Internal Onboarding Process  
> → leading to the Flowti Project Setup Process

---

## 3. Problem Statement

Currently:

- Processes exist as documentation
    
- Execution is manual
    
- No interaction between process and system
    
- No runtime metrics
    
- No formal event emission
    
- No executable governance
    

This limits:

- Repeatability
    
- Measurability
    
- Automation
    
- Continuous improvement
    
- ISO-readiness
    

---

## 4. Objectives

1. Provide a Process Modeling Standard aligned with Flow Design + BPMN
    
2. Provide a Process Execution Engine
    
3. Enable interactive operator actions
    
4. Emit structured events
    
5. Enable event subscribers
    
6. Provide metrics tracking (lead time, cycle time, throughput)
    
7. Provide Process Dashboard per Process
    
8. Maintain synchronized Documentation
    
9. Support Import / Export as JSON
    
10. Make Onboarding the first executable process
    

---

## 5. Core Concepts

---

## 5.1 Process

A Process:

- Has a Start Event
    
- Has an End Event
    
- Contains Steps
    
- Contains Flows (Transitions)
    
- Emits Events
    
- Tracks Metrics
    
- Has Dashboard
    
- Has Folder
    
- Has Markdown
    
- Has Canvas
    
- Has Base
    
- Has JSON Representation
    

---

## 5.2 Process Step (Minimum Definition)

Each Step must define:

|Attribute|Description|
|---|---|
|step_id|unique id|
|name|step name|
|description|short description|
|inputs|required artifacts|
|outputs|produced artifacts|
|goal|purpose of step|
|owner_role|optional|
|actions|operator buttons|
|attached_documents|supporting docs|
|events_emitted|event list|

---

## 6. Process Modeling Language

The Process Framework adopts simplified BPMN elements, aligned to Flowti Visual Language on Canvas.

### Supported Elements

| Element     | Meaning         | Visual Representation |
| ----------- | --------------- | --------------------- |
| Start Event | Process Trigger | Green circle          |
| End Event   | Completion      | Orange circle         |
| Activity    | Action step     | Rounded rectangle     |
| Decision    | Branch          | Green diamond         |
| Parallel    | Fork/Join       | Purple diamond        |
| Artifact    | Attached doc    | Document icon         |
| Event       | System event    | White circle          |

This must:

- Be standardized
    
- Follow Flowti Visual Language System
    
- Be governed
    

---

## 7. Functional Requirements

---

### FR-1: Process Creation

User can:

- Create new Process
    
- Assign name
    
- Assign category
    
- Mark as:
    
    - Draft
        
    - Flowti Process (Executable)
        
    - Archived
        

Only "Flowti Process" is executable.

---

### FR-2: Process Designer (Canvas-Based v2)

Process Designer v1: 
A multi-step wizard as own view, guiding through the creation.

Process Designer v2:

- Based on Obsidian Canvas
    
- Structured element types
    
- Governed shapes
    
- Drag and connect nodes
    
- Attach documents
    
- Define step metadata
    
- Add Action Buttons
    
- Define emitted events
    

Designer must validate:

- Exactly one Start
    
- At least one End
    
- No orphan nodes
    
- All transitions valid
    

---

### FR-3: Action Buttons

Process Designer can define:

For Process:

- Global Actions
    

For Step:

- Step-specific Actions
    

Each Action:

|Field|Description|
|---|---|
|label|button label|
|event_name|event to emit|
|confirmation_required|boolean|
|allowed_roles|optional|

Actions are:

- Operator Controls
    
- Must emit structured event
    
- Must be logged
    

---

### FR-4: Event Emission & Subscription

When action triggered:

- Event emitted
    
- Event can be subscribed to
    

Subscribers can:

- Open file
    
- Create file
    
- Edit file
    
- Change view
    
- Start another process
    
- Update Base
    
- Send notification
    

This integrates into your existing EventBus architecture.

---

### FR-5: Process Execution Mode

When Process marked executable:

User can:

- Start Process
    
- Resume Process
    
- View current Step
    
- Complete Step via Action Button
    
- See next step automatically activated
    

Process runtime tracks:

- Step start time
    
- Step end time
    
- State
    
- Responsible user (if available)
    

---

### FR-6: Process Metrics

Minimum metrics:

|Metric|Description|
|---|---|
|lead_time|start to end|
|cycle_time|per step|
|throughput|completed per period|

Dashboard must show:

- Time series
    
- Current runtime state
    
- Bottleneck steps
    
- Step frequency
    
- Process success rate
    

---

### FR-7: Process Dashboard

Each Process has:

- Overview panel
    
- KPI section
    
- Time Series chart
    
- Current active instances
    
- Historical runs
    
- Improvement suggestions (future)
    

Dashboard must support:

- Time filters
    
- Instance filters
    
- Role filters
    

---

### FR-8: Process Artifacts

Each Process generates:

```
03 - Resources/Processes/{process_id}/
  process.md
  process.canvas
  process.base
  process.json
  dashboard.md
```

Synchronization:

- JSON is source of truth
    
- Markdown auto-updated
    
- Base auto-updated
    
- Canvas synchronized
    

---

### FR-9: Import / Export

Process can be:

- Exported as JSON
    
- Imported from JSON
    
- Versioned
    

Import must validate:

- Schema
    
- Element consistency
    
- No circular transitions
    
- Unique IDs
    

---

## 8. Non-Functional Requirements

|Category|Requirement|
|---|---|
|Deterministic|Execution must be predictable|
|Observable|Every step logged|
|Auditable|Execution history preserved|
|Reversible|Execution pause/resume|
|Extensible|New element types possible|
|Performant|< 100ms step transition|
|Scalable|Multiple parallel instances|

---

## 9. First Increment: Flowti Onboarding Process

This Process:

Start Event:  
→ Flowti Plugin Activated

Steps:

1. Detect Vault Structure
    
2. Map or Create Structure
    
3. Select Tour
    
4. Setup Project Environment
    
5. Initialize Dashboard
    

End Event:  
→ Project Dashboard Opened

This process:

- Must use full framework
    
- Must emit events
    
- Must demonstrate metrics tracking
    
- Must update documentation automatically
    

This becomes:

> The reference implementation of PEF

---

## 10. Service Design Integration

Each Step supports:

- Frontstage
    
- Backstage
    
- Supporting systems
    
- Documents required
    

Attached Documents can include:

- Templates
    
- Checklists
    
- SOPs
    
- Forms
    
- Governance rules
    

This aligns with your Vendor-Team Blueprint thinking.

---

## 11. State Model (Conceptual)

Each Process Instance:

```
created
running
paused
completed
failed
cancelled
```

Each Step:

```
inactive
active
completed
skipped
blocked
```

---

## 12. Future Evolution

- AI-assisted process optimization
    
- Predictive bottleneck detection
    
- Simulation mode
    
- Process maturity scoring
    
- Cross-process orchestration
    
- SLA enforcement
    
- Risk prediction
    
- ISO 9001 audit export
    
- Signal-triggered process start
    

---

## 13. Strategic Importance

This feature transforms Flowti from:

Tooling → Operating System

It enables:

- Governance as Code
    
- Process-as-Executable-System
    
- Continuous Improvement Loop
    
- Measurable Delivery
    

And deeply aligns with:

- Event-driven architecture
    
- Canvas integration
    
- Knowledge graph model
    
- ISO/QMS ambition
    
- Simulation mindset
    

---

# Architectural Implication

This will require:

- Process Engine
    
- Execution State Store
    
- EventBus Integration
    
- Metrics Collector
    
- Canvas Validator
    
- JSON Schema Definition
    
- Documentation Synchronizer
    

---

## User Voice

- I want to have the lowest touch, easiest system to use to do my daily job
- I want to concentrate on my actual job instead of pushing files from a to b
- I want to have proper onboarding
- I want to have proper documentation at the tip of my finger to securely execute processes new to me

---

# 📘 Use Case Set – Flowti Onboarding Process

---

# 🎯 UC-ONB-00 — Execute Flowti Onboarding Process

## Goal

Guide a Project Manager from plugin activation to a fully initialized Project Dashboard.

## Primary Actor

Project Manager

## Supporting Systems

- Vault Scanner
    
- Process Execution Engine
    
- Folder Mapper
    
- Event Bus
    
- Document Generator
    
- Dashboard Generator
    

## Trigger

Flowti Plugin Activated

## Success Guarantee

User reaches Project Dashboard with project environment initialized.

---

# 🧩 UC-ONB-01 — Detect Vault Structure

---

## Scope

Flowti Onboarding Process

## Level

User Goal

## Primary Actor

Project Manager

## Preconditions

- Flowti Plugin activated
    
- Vault accessible
    

## Minimal Guarantee

No vault structure altered.

## Success Guarantee

Vault structure detected and presented to user.

---

## Main Success Scenario

1. Process starts.
    
2. System scans top-level folders.
    
3. System detects:
    
    - Existing project folders
        
    - Backlog folders
        
    - Documentation folders
        
4. System presents folder overview.
    
5. System emits event (pseudo):
    
    ```
    flowti.vault.structure.detected
    ```
    

---

## Extensions

### 3a – Vault empty

System suggests creating standard Flowti structure.

---

## Postconditions

Structure detection state stored.

---

# 🧩 UC-ONB-02 — Select Folder Strategy

---

## Goal

Define how Flowti integrates into existing vault.

## Preconditions

Vault structure detected.

---

## Main Success Scenario

1. System presents options:
    
    - Map Existing Structure
        
    - Create Standard Flowti Structure
        
2. User selects option.
    

---

### Branch A — Map Existing

3A. User maps Flowti domains to folders.  
4A. System validates mapping.  
5A. System emits:

```
flowti.structure.mapped
```

---

### Branch B — Create Standard

3B. System creates standard folder-structure
4B. System emits:

```
flowti.structure.created
```

---

## Success Guarantee

Flowti structure configured non-destructively.

---

# 🧩 UC-ONB-03 — Select Onboarding Mode

---

## Goal

Define onboarding path.

## Preconditions

Structure configured.

---

## Main Success Scenario

1. System presents:
    
    - User Tour
        
    - Project Management Setup
        
2. User selects “Project Management Setup”
    
3. System emits:
    
    ```
    flowti.onboarding.mode.selected
    ```
    

---

# 🧩 UC-ONB-04 — Create Project Environment

---

## Goal

Create new Flowti Project.

## Preconditions

Project Setup mode selected.

---

## Main Success Scenario

1. User enters:
    
    - Project Name
        
    - Client
        
    - Start Date
        
    - Target End Date
        
    - Project Type
        
2. System validates.
    
3. System creates:
    
    - Project folder
        
    - Project base entry
        
    - Project metadata JSON
        
4. System emits:
    
    ```
    flowti.project.created
    ```
    

---

## Extensions

### 1a — Project already exists

System proposes reuse or rename.

---

# 🧩 UC-ONB-05 — Initialize Governance Template

---

## Goal

Apply process & reporting template.

## Preconditions

Project created.

---

## Main Success Scenario

1. System presents templates:
    
    - Lightweight
        
    - Agile
        
    - Dual-Track
        
2. User selects.
    
3. System generates:
    
    - Milestone board
        
    - Risk register
        
    - KPI base
        
    - Status report template
        
4. System emits:
    
    ```
    flowti.project.template.applied
    ```
    

---

# 🧩 UC-ONB-06 — Connect Backlog

---

## Goal

Initialize or connect backlog.

## Preconditions

Project exists.

---

## Main Success Scenario

1. User selects:
    
    - Create new backlog
        
    - Connect existing folder
        
2. System configures linkage.
    
3. System emits:
    
    ```
    flowti.backlog.connected
    ```
    

---

# 🧩 UC-ONB-07 — Initialize Reporting Dashboard

---

## Goal

Generate Project Dashboard.

## Preconditions

Project environment ready.

---

## Main Success Scenario

1. System creates dashboard with:
    
    - Status overview
        
    - KPIs
        
    - Milestones
        
    - Risks
        
    - Backlog summary
        
2. System initializes metrics tracking.
    
3. System emits:
    
    ```
    flowti.dashboard.initialized
    ```
    

---

# 🧩 UC-ONB-08 — Complete Onboarding Process

---

## Goal

End process execution.

## Preconditions

Dashboard initialized.

---

## Main Success Scenario

1. System marks onboarding process instance as completed.
    
2. System records:
    
    - Lead time
        
    - Cycle times per step
        
3. System updates Process Documentation automatically.
    
4. System opens Project Dashboard.
    
5. System emits:
    
    ```
    flowti.onboarding.completed
    ```
    

---

# 🔄 Included Subflows

|Subflow|Used In|
|---|---|
|Validate Folder Mapping|UC-ONB-02|
|Generate Project Artifacts|UC-ONB-04|
|Generate Reporting Artifacts|UC-ONB-05|
|Initialize Metrics Collector|UC-ONB-07|

---

# 📊 Process Metrics Collected

For Onboarding Process:

- Total Lead Time
    
- Step Cycle Time:
    
    - Structure Detection
        
    - Folder Mapping
        
    - Project Creation
        
    - Template Application
        
    - Dashboard Initialization
        
- Drop-off Rate
    
- Restart Rate
    

---

# 📂 Artifacts Created

```plaintext
/processes/flowti-onboarding/
  flowti-onboarding.md
  flowti-onboarding.canvas
  flowti-onboarding.base
  flowti-onboarding.json
  flowti-onboarding-dashboard.md
```

Project-specific:

```plaintext
/projects/{project-name}/
  project.md
  dashboard.md
  milestones.base
  risks.base
```

---

# 🔔 Event Map (Pseudo)

|Event|Triggered By|
|---|---|
|flowti.vault.structure.detected|UC-ONB-01|
|flowti.structure.mapped|UC-ONB-02|
|flowti.structure.created|UC-ONB-02|
|flowti.onboarding.mode.selected|UC-ONB-03|
|flowti.project.created|UC-ONB-04|
|flowti.project.template.applied|UC-ONB-05|
|flowti.backlog.connected|UC-ONB-06|
|flowti.dashboard.initialized|UC-ONB-07|
|flowti.onboarding.completed|UC-ONB-08|

---

# 🏁 Final State

At completion:

- Process Instance → Completed
    
- Metrics stored
    
- Documentation synchronized
    
- Dashboard open
    
- User inside operational project
    

---

# Strategic Impact

This Use Case Set:

- Validates Process Execution Framework
    
- Validates Event Bus
    
- Validates Documentation Sync
    
- Validates Metrics Collector
    
- Validates Dashboard Infrastructure
    
- Validates Canvas Governance
    

This is our **reference executable process**.

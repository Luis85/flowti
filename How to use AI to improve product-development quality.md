---
type: Hypothesis
stage: refinement
---
# Hypothesis - AI Assisted Product Development

- How can best practices from Design, Quality, and Engineering help an AI Agent produce acceptable-output
- How can AI be used to enable and improve Product-Quality
- How can AI be used to rapidly prototype
- How can I simulate a human-centered workflow with AI Agents to test ideas
- How can Flowti help in researching and working on a Hypothesis
- What framework should be in place to guide AI to an acceptable output
- How will the Interface between knowledge and agentic support look like
- How to train AI on your domain
- In which format will we communicate in the future
- How does Markdown help with structuring and preparing content for AI
- How does AI work and how does Obsidian help with that
- How can the work with AI in a business and process-driven environment be approachable and supporting with focus on quality output
- What defines quality-output
- What defines acceptable-output
- How does AI fit into IT-Security Concepts
- What influences Product-Development
- How does AI match real-world outcomes in a constraint workspace
- How can we make changes to a system traceable
- What data-format works well as interface between Humans and Agents
- How can Obsidian help in structuring my research project
- How can we ingrain quality best-practices into our daily-work
- How can we steer Agents with a scenario like approach
- How can we describe Agent Environments as digital twin to share the same domain-language
- How can we provide documentation which is human-readable, machine-readable, digestable, enjoyable, approachable, living, useful,valuable, evolving, naturally improving
- What must be done or have to be in place to enable an AI Agent
- What defines an Information-System
- How can those systems scale

## Assumptions

[[Sketchpad.canvas]]

- As LLMs are language processors, generating natural language based on given content as input, in well documented content templates like the user-story or use-case format, generates well enough code for sustainable development, behaving like a compiler between humans and not so predictable machine-code, mimicking the real-world problem of explaining requirements and understanding requirements.
- Using real-world outside signals for the feedback-loop provides enough fresh data for each simulation step to not let quality degrade over time and preventing Agents eating too much of their own content.
- Following best-practices from agile and quality-management, we have all the tools needed to build a solid framework producing desired, AI-Assisted output which turn into a high-quality product increment by using the human-in-the-middle-approach for quality-assurance and needed alignments during development cycles.

## Experiment Setup

To strengthen the human-in-the-middle approach we will simulate Product-Development in an agile setting. Shipping increments fast, validate, get feedback, and improve. This process produces a good amount of documentation and communication based on a real-world example. This should combat the situation of stale content or AI re-cycled learnings with fresh genuine input.

Shipping a real Product opens the possibilities to simulate the communication-paths inside a development-team based on real feedback.

The experiment consists of multiple Agent Personas all with different focus alongside the Product-Development-Lifecycle.

To simulate parallel work, interactions, and dependencies, the experiment uses 3 different devices to direct the agents and all available touch-points with the Git Repo.

Mobile - for simulating external contributions to the Codebase
Tablet - for Product Design work and documentation
Laptop - for Design work, documentation and orchestration

Documentation and generated output will be saved in a public Vault hosted on GitHub. The created Product aims to document it's own development lifecycle.

The basic idea is to simulate the whole Product Lifecycle with all it's Artifacts and steer a simulated Product-Development Team guided by agile methodology and industry best-practices to generate real-world like documentation in a best-case setting.

Using Obsidian as Documentation and Development Platform to have a flexible tool for quick iterations and documented learnings, backed by a publicly available and a private Git repository to build a versioned history.

To quickly gather feedback, each generated Plugin Increment gets validated in a real work-environment, consisting of service-delivery, project-management, and business-development. This feedback get's observed and manually entered into the system. This is already a biased entry point which should be minimized in the future.

To further open up the input channels, publishing of the produced plugin is planned to use GitHub as first main touchpoint for feedback ingestion and further simulating interactions and processes within the lifecycle.

A desired outcome will be a fully documented, open-source product, serving as proof-of-concept and test-platform for further, community-driven, and agile improvements.

## Test-Environment

- Obsidian for Content Consumption and Creation
- Flowti IBDE Plugin as Dog-Food
- Public Obsidian Vault for Documentation
- Private Obsidian Vault for Documentation and Input
- GitHub Public Git Repository for external Contributions and Touchpoint
- Microsoft VS Code for Agent Orchestration
- Claude Code Mobile for external Contributor Simulation
- ChatGPT as Product Owner Assistent

- The Plugins (Product) Inbox gets filled from Refinement of public and private Vault
- The Product Team owns the Public GitHub Repository
- The Product Development Team owns the Plugins `src` folder
- The Private Vault is the main source for Agent Steering and can be synced via Cloud Services

## Simulated Entities

### The Product Team Agent

The Product-Team creates and maintains the Cycle Plan which displays a comprehensive execution plan, sliced into Product Increments. Each Increment trying to deliver value to the End-User. The Product-Team owns the Cycle Plan.

- Claude Code

### The Product Development Team Agent

The Product Development Team owns the Increment Plan inside a Cycle.
The Team supports the Product Owner slicing, refining and solving User Issues by providing needed insights and technical solutions.

- Claude Code

### The Product Owner Agent

The Product Owner refines and manages the Backlog and the Product Inbox. He owns refinement, backlog, and prioritization.
He is responsible to prepare the Cycle Planning and to check-out the Definition of Done. He also looks out for Signals from Market Research and let that influence his proposals.

- ChatGPT 5.2

### The Product Trio Agent

- Claude Code
- ChatGPT 5.2

### The Three Amigos Council Agent

- Claude Code

### The Quality Manager Agent

- Claude Code via GitHub

He simulates external Contributions and a Pull-Request Merge Process. He is used as Orchestrator for Architecture Reviews, Quality Reviews, and Compliance. 

## Simulated Workflow

Every Simulation Step should follow the [[Idea to Solution Workflow]] and produce the desired Output, with the Vault as Input. Created Increments must follow a Quality-Assurance Process before getting pushed to the remote repository. Every Simulation Run must be documented in a Cycle Plan. Every Cycle Plan must adhere to [[Definition of Ready (Cycle)]] and [[Definition of Done (Cycle)]], producing an Output in increments valuable to the user.

Following agile best-practices, the workflow should improve over time, making quality-assurance way easier and the outcome more predictable, enabling a self-organized AI-Assisted team.

Key challenge is, to be able to replace or substitute every needed role in the process by a simulated agent. The workflow must become so robust to be manageable by one person.

Key-Questions:

- How do we get accurate data out of the system
- How can we measure improvements over time
- How can we measure the impact of an idea to a system

## The Flowti IBDE Machine-Room

The Machine-Room is the main interface between the Vault and the Product-Development Team Agent. The Machine-Room is used to track and review the Agents output. Granting Claude Code access to both, the codebase as also the complete documentation of the projects history.

Interfacing with the Agent happens on two ways:

- Adding Markdown Files to one of the Inboxes and let the Agent execute the [[Idea to Solution Workflow]]
- Giving direct instructions in VS Code as prompt to keep the Agent aligned

Having dedicated review and refinement sessions in the workflow produces updated documentation, simulating real-world output for further steering.

It is planned to migrate the Machine-Room into the Flowti IBDE Obsidian Plugin.

![[Flowti IBDE Machine Room.png]]


## Props

- [[PRD Template]]
- [[Idea to Solution Workflow]]
- [[Cycle Planning Template]]
- [[Definition of Ready (Cycle)]]
- [[Definition of Done (Cycle)]]
- [[Three Amigos Session Template]]
- [[04 - Development.base|Product Development Cycles]]

## Learnings

- Preparing a Cycle Plan with clear defined Increments helps the agent having a well confined context
- The language of the Agent mimics what was agreed on, makes reviewing and tracking the output much easier, indicates well documented domain-model
- As no domain expert, AI gives a false sense of security and confidence, there is no-way I alone can review the amount of generated content, making the content traceable is crucial to keep organized
- The generated amount of content is comparable to real-life projects in similar settings
- A comprehensive test-suite gives a false sense of security, if the consumer is no domain expert, he just sees a tremendous amount of words
- System generated metrics need to have context, explanation, and how they impact the quality or kpis of the system in the grand scheme of things otherwise they are just numbers and add to cognitive overload
- A Testsuite must be the authoritative catalog about the functionality of a system of what it can, can't, should, or should not do to be used as foundation for an audit
- Context-Management is crucial, providing the Agent a map of needed context helps alignment. Obsidian Bases are a great tool to make those maps easily.
- Ideas are cheap - The sheer amount of documentation needed to keep track of decisions and solutions can be overwhelming, tracking the amount of connections over time helps making impact visible


## Conclusions

I think, AI is a great tool to simulate workflows and get a feeling about friction and issues to further improve. Exhaustive documentation helps to understand where AI is heading to but this also provides a false sense of security as I am not be able to validate assumptions and decisions the AI made outside of my domain. I need to trust the process fully and threat the Agent like an autonomous team, which mimics the real-world quite a bit.

To really enhance productivity and quality of a product, I think having the dedicated Agent be used as a Companion for the respective Team mitigates the risk of slop and opens enough room to control and manage the domains context by respective experts.

In conclusion, AI helps the single-developer producing a Product in acceptable quality. Using the Agents as dedicated Companions in a Team with all needed domain experts present, it helps following documented workflows with desired output, thus opens the possibility for quality-improvements on all levels by implementing regular well documented reviews and be like the scribe from natural language into machine-code.

The need for traceability and ISO compliance of AI generated Content could fit well together. As of now, AI is very limited regarding it's context window and needs to be aligned during longer sessions. 
Required documents and actions from compliance perspective help building a long-term memory in form of Markdown files. Those documents can be templated for the AI to use, helping strengthen compliance and make human reviews easier by transparent paths during state changes.

## Further thinking

- How can Markov-Chains help building a knowledge-graph and leverage good old statistics from that
- How can we track and manage experiments with Flowti

## Experiments

![[05 - Experiments.base]]


---
# Core Thesis

AI Agents can simulate and partially replace roles in a product-development lifecycle if guided by structured documentation, quality frameworks, and human-in-the-loop governance.

This could enable a single developer to orchestrate complex product development workflows with acceptable quality.

---

# 🟢 LEVEL 1 — Idea Clarification

## 1. Problem Statement

Modern AI produces large amounts of output, but:

- It creates false confidence
- It lacks domain validation
- It degrades without feedback
- It is difficult to govern in structured environments

There is no robust framework to align AI output with product-quality standards.

## 2. Hypothesis Statement

If AI Agents are guided through structured workflows,
with best practices from Design, Quality Management, and Engineering,
then they can produce acceptable product increments,
because structured context and governance reduce ambiguity and drift.

## 3. Expected Outcome

- A fully documented open-source product
- Simulated AI-driven development lifecycle
- Measurable improvements in traceability and output quality

---

# 🟡 LEVEL 2 — Structured Foundation

## 4. Assumptions

| ID  | Assumption                             | Risk   | Validation              |
| --- | -------------------------------------- | ------ | ----------------------- |
| A1  | Structured templates improve AI output | Medium | Compare outputs         |
| A2  | Human-in-the-loop reduces slop         | Low    | Review cycles           |
| A3  | External signals prevent drift         | Medium | Multi-cycle observation |
|     |                                        |        |                         |

## 5. Research Questions

- What defines acceptable-output?
- What defines quality-output?
- How does Markdown influence AI structure?
- What framework is needed for governance?
- How does AI fit into IT security?
- What is the ideal Human ↔ Agent interface?

## 6. Conceptual Model

System = AI-Driven Product Lifecycle Simulation

Inputs:
- Markdown documentation
- Git history
- Public signals

Transformation:
- Agent execution of workflows

Outputs:
- Code
- Documentation
- Product increments

Feedback:
- GitHub PR reviews
- Human evaluation
- Real-world usage validation

---

## 7. Constraints

- AI context window limits
- Domain knowledge gaps
- Security & compliance
- Biased manual feedback input

---

## 8. Quality Definition

Acceptable Output:
- Traceable
- Structured
- Reviewable
- Constrained by templates

High Quality Output:
- Aligns with domain language
- Follows DoR / DoD
- Measurable impact
- Improves over cycles

Failure:
- Drift
- Overproduction without validation
- Metrics without meaning

---

# 🔴 LEVEL 3 — Strategic Expansion

## 9. System Architecture Hypothesis

Roles simulated:
- Product Owner Agent
- Development Team Agent
- Quality Manager Agent
- Product Trio
- Three Amigos

Governance:
- Cycle Plans
- Definition of Ready
- Definition of Done
- Git Pull Request review

---

## 10. Experiment Design

Environment:
- Obsidian Vault (Public & Private)
- Flowti IBDE Plugin
- GitHub Repo
- VS Code orchestration

Devices simulate distributed collaboration:
- Mobile (external contributor)
- Tablet (design)
- Laptop (orchestration)

---

## 11. Traceability Model

- Markdown as long-term memory
- Git as state-history
- Structured templates as alignment anchors
- Simulation cycles documented

---

## 12. Evaluation Framework

Measure:
- Increment clarity
- Context alignment
- Output drift over cycles
- Documentation-to-code ratio
- Review friction

---

# 14. Risks

- AI false authority bias
- Over-documentation illusion
- Domain blind spots
- Metric without context overload

---

# 15. Learnings

- Cycle Plans confine context
- AI mimics documented language
- Traceability is critical
- Testsuite ≠ real understanding
- Context maps improve alignment

---

# 16. Conclusions

AI is effective as a companion agent.
Not as an autonomous authority.

Structured governance + documentation + human review enables sustainable AI-assisted development.

ISO-style traceability may be the key enabler for long-term AI integration.

---

# 17. Next Actions

- [ ] Synthesize past research documents
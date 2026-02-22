---
type: Hypothesis
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

## Assumptions

- As LLMs are language processors, generating natural language based on given content as input, in well documented content templates like the user-story or use-case format, generates well enough code for sustainable development, behaving like a compiler between humans and not so predictable machine-code, mimicking the real-world problem of explaining requirements and understanding requirements.

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

### The Product Team Agent

The Product-Team creates and maintains the Cycle Plan which displays a comprehensive execution plan, sliced into Product Increments. Each trying to deliver value to the End-User. The Product-Team owns the Cycle Plan.

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

Every Simulation Step should follow the [[Idea to Solution Workflow]] and produce the desired Output, with the Vault as Input. Created Increments must follow a Quality-Assurance Process before getting pushed to the remote repository.

Following agile best-practices, the workflow should improve over time, making quality-assurance way easier and the outcome more predictable, enabling a self-organized AI-Assisted team.

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

- [[Idea to Solution Workflow]]
- [[PRD Template]]
- [[Cycle Planning Template]]
- [[Definition of Ready (Cycle)]]
- [[Definition of Done (Cycle)]]
- [[Three Amigos Session Template]]

## Learnings

- Preparing a Cycle Plan with clear defined Increments helps the agent having a well confined context
- The language of the Agent mimics what was agreed on, makes reviewing and tracking the output much easier, indicates well documented domain-model
- As no domain expert, AI gives a false sense of security and confidence, there is no-way I alone can review the amount of generated content, making the content traceable is crucial to keep organized
- The generated amount of content is comparable to real-life projects in similar settings
- A comprehensive test-suite gives a false sense of security, if the consumer is no domain expert, he just sees a tremendous amount of words
- System generated metrics need to have context, explanation, and how they impact the quality or kpis of the system in the grand scheme of things otherwise they are just numbers and add to cognitive overload
- A Testsuite must be the authoritative catalog about the functionality of a system of what it can, can't, should, or should not do to be used as foundation for an audit
- Context-Management is crucial, providing the Agent a map of needed context helps alignment. Obsidian Bases are a great tool to make those maps easily.


## Conclusions

I think, AI is a great tool to simulate workflows and get a feeling about friction and issues to further improve. Exhaustive documentation helps to understand where AI is heading to but this also provides a false sense of security as I am not be able to validate assumptions and decisions the AI made outside of my domain. I need to trust the process fully and threat the Agent like an autonomous team, which mimics the real-world quite a bit.

To really enhance productivity and quality of a product, I think having the dedicated Agent be used as a Companion for the respective Team mitigates the risk of slop and opens enough room to control and manage the domains context by respective experts.

In conclusion, AI helps the single-developer producing a Product in acceptable quality. Using the Agents as dedicated Companions in a Team with all needed domain experts present, it helps following documented workflows with desired output, thus opens the possibility for quality-improvements on all levels by implementing regular well documented reviews and be like the scribe from natural language into machine-code.

The need for traceability and ISO compliance of AI generated Content could fit well together. As of now, AI is very limited regarding it's context window and needs to be aligned during longer sessions. 
Required documents and actions from compliance perspective help building a long-term memory in form of Markdown files. Those documents can be templated for the AI to use, helping strengthen compliance and make human reviews easier by transparent paths during state changes.



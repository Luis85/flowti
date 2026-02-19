---
type: DocumentType
name: DocumentType
abbreviation: ""
folder: knowledgebase/types/
icon: book-open
---

# DocumentType

A **DocumentType** is a glossary entry that defines a type used in the Flowti documentation system. Every `type:` value that appears in frontmatter across the vault has a corresponding DocumentType entry in `knowledgebase/types/`.

DocumentType is the **meta-type** — the type that describes all other types. This glossary serves Product Team Members, Project Team Members, and Stakeholders as the canonical reference for understanding what each document type means, what frontmatter it carries, and how it fits into the workflow.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"DocumentType"` | yes | Document type discriminator (self-referential) |
| `name` | string | yes | Type name as it appears in frontmatter `type:` values |
| `abbreviation` | string | no | Short form (e.g., `PRD`, `PBI`, `ADR`, `TD`) |
| `folder` | string | no | Default folder where documents of this type live |
| `icon` | string | no | Lucide icon identifier |

## Section Template

1. (Title and definition paragraph)
2. Frontmatter Schema (table of all fields)
3. Section Template (numbered list of document sections)
4. Lifecycle (state diagram if applicable)
5. Related Types (connections to other types)

## Type Categories

The glossary organizes types into four categories:

### Development Process Types

Types used during the Idea-to-Solution workflow by the project team.

| Type | Abbreviation | Purpose |
|------|-------------|---------|
| [[Idea]] | — | Raw or enriched inbox item |
| [[Bug]] | — | Defect report |
| [[ProductRequirementsDocument]] | PRD | Feature specification |
| [[ProductBacklogItem]] | PBI | Deliverable work package |
| [[UserStory]] | US | User voice capture |
| [[UseCase]] | UC | Structured interaction scenario |
| [[JobToBeDone]] | JTBD | Solution-independent user need |
| [[Persona]] | — | User archetype |
| [[Increment]] | Inc | Single shippable delivery step |
| [[DevelopmentCycle]] | Cycle | Multi-increment delivery unit |
| [[ReviewSession]] | Review | Three Amigos quality gate |
| [[TechnicalReview]] | TR | Architecture validation gate |
| [[DecisionNote]] | ADR | Architecture decision record |
| [[TechDebt]] | TD | Known quality gap |
| [[Learning]] | L | Reusable pattern or insight |
| [[Flow]] | — | User journey documentation |
| [[Process]] | — | Workflow or methodology |
| [[Domain]] | — | Business domain stub |
| [[Component]] | — | UI component documentation |
| [[View]] | — | Plugin view sitemap entry |
| [[TestPlan]] | — | Test strategy and plan |

### Plugin Entity Types (Event Catalog)

Types managed by the Flowti plugin's Event Catalog system.

| Type | Tab | Purpose |
|------|-----|---------|
| [[EventDoc]] | Events | Event documentation |
| [[DomainDoc]] | Domains | Domain overview |
| [[ArchitectureDoc]] | Domains | Arc42 + C4 architecture |
| [[ServiceDoc]] | Services | Service overview |
| [[ServiceBlueprintDoc]] | Services | Detailed service blueprint |
| [[CategoryDoc]] | Events | Event category grouping |
| [[FlowDoc]] | Flows | Business flow with event sequence |
| [[SystemDoc]] | Systems | External system documentation |
| [[ActorDoc]] | Actors | Actor/persona documentation |
| [[ProductDoc]] | Products | Product documentation |

### Plugin Entity Types (Data Exchange)

Types managed by the Data Exchange Hub.

| Type | Tab | Purpose |
|------|-----|---------|
| [[CsvDoc]] | Reports | CSV file documentation |
| [[PropertyDoc]] | Properties | Frontmatter property documentation |
| [[TypeDoc]] | Types | Note type definition |
| [[ImportConfigDoc]] | Imports | Import configuration |
| [[ExportConfigDoc]] | Exports | Export configuration |
| [[PipelineConfigDoc]] | Pipelines | Pipeline configuration |

### Special Types

| Type | Purpose |
|------|---------|
| [[Event]] | User-defined custom event file |
| [[DocumentType]] | This glossary's own meta-type |

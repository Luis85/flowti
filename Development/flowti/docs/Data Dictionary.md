---
type: DataDictionary
stage: development
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
description: Complete reference of all document types, frontmatter schemas, and property definitions used by the Flowti IBDE plugin
tags:
  - reference
  - data-dictionary
---

# Data Dictionary

This document defines every document type, frontmatter property, and file naming convention used by the Flowti IBDE plugin. It serves as the canonical reference for the plugin's self-documentation system.

> Last updated: 2026-02-14

---

## Document Types

The plugin uses typed Markdown files with YAML frontmatter as its primary data model. The `type` field in frontmatter determines how a file is interpreted by the catalog, hub, and other views.

### Entity Types (Event Catalog)

These types are managed through the Event Catalog view tabs. Each has a dedicated folder under the documentation root path.

| Type | Tab | Folder | Name Field | Description |
|------|-----|--------|------------|-------------|
| `EventDoc` | Events | `Events/` | `event` | Event documentation with payload shape, usage guidance, and operational notes |
| `DomainDoc` | Domains | `Domains/` | `domain` | Business domain overview with related services, categories, and events |
| `ArchitectureDoc` | Domains | `Domains/` | `domain` | Arc42 + C4 architecture document for a domain |
| `ServiceDoc` | Services | `Services/` | `service` | Service overview with related domains and events |
| `ServiceBlueprintDoc` | Services | `Services/` | `service` | Detailed service blueprint with user interactions, data flows, and operational concerns |
| `CategoryDoc` | Events | `Categories/` | `category` | Event category grouping with related domains and services |
| `FlowDoc` | Flows | `Flows/` | `flow` | Business flow with ordered event sequence, domains, and services |
| `SystemDoc` | Systems | `Systems/` | `system` | External system documentation with linked domains and services |
| `ActorDoc` | Actors | `Actors/` | `actor` | User persona documentation with goals, key events, and service interactions |
| `ProductDoc` | Products | `Products/` | `product` | Product documentation with linked events, domains, and services |

### Data Exchange Types (Data Exchange Hub)

These types are managed through the Data Exchange Hub view tabs.

| Type | Tab | Folder | Name Field | Description |
|------|-----|--------|------------|-------------|
| `CsvDoc` | Reports | `Reports/` | `name` | CSV file documentation with column headers, row count, and delimiter |
| `PropertyDoc` | Properties | `Properties/` | `property` | Frontmatter property documentation with CSV column mappings and config references |
| `TypeDoc` | Types | `Types/` | `name` | Note type definition with expected properties and lifecycle events |
| `ImportConfigDoc` | Imports | `Configs/` | `name` | Import configuration documentation with column mappings and settings |
| `ExportConfigDoc` | Exports | `Configs/` | `name` | Export configuration documentation with columns and output settings |
| `PipelineConfigDoc` | Pipelines | `Configs/` | `name` | Multi-import pipeline documentation with sources and export steps |

### Special Types

| Type | Location | Description |
|------|----------|-------------|
| `AreaDoc` | `02 - Areas/{name}/` | Created from "Mark as Area" on a domain; represents a PARA area |
| `Event` | Anywhere in vault | User-defined custom event file; discovered by EventBridge via `type: Event` frontmatter |

---

## Frontmatter Schemas

### EventDoc

```yaml
type: EventDoc
event: "string"           # Event type identifier (e.g., "user.created")
description: "string"     # Brief description of the event
category: "string"        # Event category (e.g., "Core", "User", "Data Exchange")
direction: "string"       # "inbound" | "outbound" | "internal"
domain: "string"          # Domain that owns this event
services: "string"        # Service(s) that emit or handle this event
stability: "string"       # "draft" | "alpha" | "beta" | "stable"
visibility: "string"      # "public" | "internal" | "private"
created: "ISO timestamp"  # Creation date
```

**File pattern**: `{docsRoot}/Events/{eventType}.md`

### DomainDoc

```yaml
type: DomainDoc
domain: "string"          # Domain name
eventCount: number        # Number of events in this domain
categories:               # Event categories covered by this domain
  - "string"
services:                 # Services that belong to this domain
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Domains/{domainName}.md`

### ArchitectureDoc

```yaml
type: ArchitectureDoc
domain: "string"          # Domain name (same as parent DomainDoc)
eventCount: number
categories:
  - "string"
services:
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Domains/{domainName}.architecture.md`

### ServiceDoc

```yaml
type: ServiceDoc
service: "string"         # Service name
eventCount: number        # Number of events handled by this service
domains:                  # Domains this service belongs to
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Services/{serviceName}.md`

### ServiceBlueprintDoc

```yaml
type: ServiceBlueprintDoc
service: "string"         # Service name (same as parent ServiceDoc)
eventCount: number
domains:
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Services/{serviceName}.blueprint.md`

### CategoryDoc

```yaml
type: CategoryDoc
category: "string"        # Category name
eventCount: number        # Number of events in this category
domains:
  - "string"
services:
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Categories/{categoryName}.md`

### FlowDoc

```yaml
type: FlowDoc
flow: "string"            # Flow name
description: "string"     # Brief flow description
events:                   # Ordered event types in this flow
  - "string"
domains:                  # Domains involved in this flow
  - "string"
services:                 # Services participating in this flow
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Flows/{flowName}.md`

### SystemDoc

```yaml
type: SystemDoc
system: "string"          # System name
description: "string"     # Brief system description
domains:                  # Domains this system encompasses
  - "string"
services:                 # Services that make up this system
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Systems/{systemName}.md`

### ActorDoc

```yaml
type: ActorDoc
actor: "string"           # Actor/persona name
description: "string"     # Brief actor description
events:                   # Key events for this actor
  - "string"
domains:                  # Domains this actor interacts with
  - "string"
services:                 # Services this actor relies on
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Actors/{actorName}.md`

### ProductDoc

```yaml
type: ProductDoc
product: "string"         # Product name
description: "string"     # Brief product description
events:                   # Key product events
  - "string"
domains:                  # Domains this product spans
  - "string"
services:                 # Services this product relies on
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Products/{productName}.md`

### CsvDoc

```yaml
type: CsvDoc
csvFile: "string"         # Wikilink to the CSV file (e.g., "[[data.csv]]")
filePath: "string"        # Full vault path to the CSV file
name: "string"            # Filename
description: "string"     # User-provided description
columns: number           # Number of columns
rows: number              # Number of data rows
delimiter: "string"       # Column delimiter ("," or "\t" or other)
headers:                  # Column header names
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Reports/CSV - {csvName}.md`

### PropertyDoc

```yaml
type: PropertyDoc
property: "string"        # Frontmatter property name (e.g., "status")
description: "string"     # User-provided description of this property
csvColumns:               # CSV columns that map to this property
  - "string"
configs:                  # Config names that reference this property
  - "string"
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Properties/Property - {propertyName}.md`

### TypeDoc

```yaml
type: TypeDoc
name: "string"            # Note type name (e.g., "Asset", "Contact")
description: "string"     # User-provided description
properties:               # Expected frontmatter properties for this type
  - "string"
pipelines: number         # Total configs referencing this type
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Types/Type - {typeName}.md`

### ImportConfigDoc

```yaml
type: ImportConfigDoc
configId: "string"        # UUID of the saved config
name: "string"            # Config display name
targetFolder: "string"    # Vault path where notes are created
nameColumn: "string"      # CSV column used for note filenames
namePrefix: "string"      # Optional filename prefix
nameSuffix: "string"      # Optional filename suffix
conflictStrategy: "string" # "skip" | "update" | "overwrite"
columns: number           # Total column mappings
includedColumns: number   # Enabled column mappings
noteType: "string"        # Optional note type (e.g., "Event")
sourcePath: "string"      # Optional path to source CSV file
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Configs/Import - {configName}.md`

### ExportConfigDoc

```yaml
type: ExportConfigDoc
configId: "string"        # UUID of the saved config
name: "string"            # Config display name
sourcePath: "string"      # Folder or .base file path
sourceType: "string"      # "folder" | "base"
format: "string"          # "csv" | "tab"
outputPath: "string"      # Output file path
columns: number           # Frontmatter columns exported
fileProperties: number    # File metadata properties exported
conflictStrategy: "string" # "skip" | "append" | "overwrite"
isExternal: boolean       # True if output is outside the vault
noteType: "string"        # Optional note type filter
created: "ISO timestamp"
```

**File pattern**: `{docsRoot}/Configs/Export - {configName}.md`

### PipelineConfigDoc

```yaml
type: PipelineConfigDoc
configId: "string"        # UUID of the pipeline
name: "string"            # Pipeline display name
description: "string"     # User-provided description
targetFolder: "string"    # Vault path for merged notes
mergeKey: "string"        # Canonical frontmatter key for merge
noteType: "string"        # Optional note type
namePrefix: "string"      # Optional filename prefix
nameSuffix: "string"      # Optional filename suffix
exportConfigIds:          # IDs of export configs to run after import
  - "string"
sources: number           # Number of CSV sources
created: "ISO timestamp"
lastExecuted: "ISO timestamp" # Last pipeline execution time
```

**File pattern**: `{docsRoot}/Configs/Pipeline - {pipelineName}.md`

### AreaDoc

```yaml
type: AreaDoc
area: "string"            # Area name
domain: "string"          # Parent domain name
description: "string"     # Brief area description
```

**File pattern**: `02 - Areas/{areaName}/{areaName}.md`

### User-Defined Event

```yaml
type: Event               # Must be exactly "Event" (case-sensitive)
name: "string"            # Optional explicit event name (defaults to derived-from-filename)
```

**File pattern**: Anywhere in the vault. Detected by EventBridge via `type: Event` frontmatter. If `name` is absent, the event name is derived from the filename (lowercase, spaces replaced with dots).

---

## Property Reference

All frontmatter properties used across document types, sorted alphabetically.

| Property | Type | Used By | Description |
|----------|------|---------|-------------|
| `actor` | string | ActorDoc | Actor/persona name |
| `area` | string | AreaDoc | Area name |
| `categories` | string[] | DomainDoc, ArchitectureDoc | Event categories in this domain |
| `category` | string | EventDoc, CategoryDoc | Event category name |
| `columns` | number | CsvDoc, ImportConfigDoc, ExportConfigDoc | Column count |
| `configId` | string | ImportConfigDoc, ExportConfigDoc, PipelineConfigDoc | UUID reference to saved config |
| `configs` | string[] | PropertyDoc | Config names using this property |
| `conflictStrategy` | string | ImportConfigDoc, ExportConfigDoc | How to handle existing files |
| `created` | ISO timestamp | All doc types | Document creation timestamp |
| `csvColumns` | string[] | PropertyDoc | CSV columns that map to this property |
| `csvFile` | string | CsvDoc | Wikilink to CSV file |
| `delimiter` | string | CsvDoc | Column delimiter character |
| `description` | string | Most types | Brief description |
| `direction` | string | EventDoc | Event direction: inbound/outbound/internal |
| `domain` | string | EventDoc, DomainDoc, ArchitectureDoc, AreaDoc | Domain name |
| `domains` | string[] | ServiceDoc, ServiceBlueprintDoc, CategoryDoc, FlowDoc, SystemDoc, ActorDoc, ProductDoc | Related domains |
| `event` | string | EventDoc | Event type identifier |
| `eventCount` | number | DomainDoc, ArchitectureDoc, ServiceDoc, ServiceBlueprintDoc, CategoryDoc | Count of events |
| `events` | string[] | FlowDoc, ActorDoc, ProductDoc | Ordered list of event types |
| `exportConfigIds` | string[] | PipelineConfigDoc | Export config UUIDs for post-import steps |
| `fileProperties` | number | ExportConfigDoc | Count of file metadata properties exported |
| `filePath` | string | CsvDoc | Full vault path to source file |
| `flow` | string | FlowDoc | Flow name |
| `format` | string | ExportConfigDoc | Output format: "csv" or "tab" |
| `headers` | string[] | CsvDoc | CSV column header names |
| `includedColumns` | number | ImportConfigDoc | Count of enabled column mappings |
| `isExternal` | boolean | ExportConfigDoc | Whether output is outside the vault |
| `lastExecuted` | ISO timestamp | PipelineConfigDoc | Last pipeline execution time |
| `mergeKey` | string | PipelineConfigDoc | Canonical frontmatter key for note merging |
| `name` | string | CsvDoc, TypeDoc, ImportConfigDoc, ExportConfigDoc, PipelineConfigDoc, Event | Display name or identifier |
| `nameColumn` | string | ImportConfigDoc | CSV column used for note filenames |
| `namePrefix` | string | ImportConfigDoc, PipelineConfigDoc | Filename prefix |
| `nameSuffix` | string | ImportConfigDoc, PipelineConfigDoc | Filename suffix |
| `noteType` | string | ImportConfigDoc, ExportConfigDoc, PipelineConfigDoc | Note type filter/assignment |
| `outputPath` | string | ExportConfigDoc | Output file path |
| `pipelines` | number | TypeDoc | Count of configs referencing this type |
| `product` | string | ProductDoc | Product name |
| `properties` | string[] | TypeDoc | Expected frontmatter properties for this note type |
| `property` | string | PropertyDoc | Frontmatter property name |
| `rows` | number | CsvDoc | Data row count |
| `service` | string | ServiceDoc, ServiceBlueprintDoc | Service name |
| `services` | string[] | DomainDoc, ArchitectureDoc, CategoryDoc, FlowDoc, SystemDoc, ActorDoc, ProductDoc | Related services |
| `sourcePath` | string | ImportConfigDoc, ExportConfigDoc | Path to source file |
| `sourceType` | string | ExportConfigDoc | Source type: "folder" or "base" |
| `sources` | number | PipelineConfigDoc | Number of CSV sources in pipeline |
| `stability` | string | EventDoc | Stability level: draft/alpha/beta/stable |
| `system` | string | SystemDoc | System name |
| `targetFolder` | string | ImportConfigDoc, PipelineConfigDoc | Vault path for created notes |
| `type` | string | All doc types | Document type discriminator (required) |
| `visibility` | string | EventDoc | Visibility: public/internal/private |

---

## Folder Structure

The documentation root path is configurable via the `docsRootPath` setting.

**Default**: `03 - Resources/Documentation/Reference`

```
{docsRootPath}/
├── Events/                          # EventDoc files
│   └── {eventType}.md
├── Domains/                         # DomainDoc + ArchitectureDoc files
│   ├── {domainName}.md
│   └── {domainName}.architecture.md
├── Services/                        # ServiceDoc + ServiceBlueprintDoc files
│   ├── {serviceName}.md
│   └── {serviceName}.blueprint.md
├── Categories/                      # CategoryDoc files
│   └── {categoryName}.md
├── Flows/                           # FlowDoc files
│   └── {flowName}.md
├── Systems/                         # SystemDoc files
│   └── {systemName}.md
├── Actors/                          # ActorDoc files
│   └── {actorName}.md
├── Products/                        # ProductDoc files
│   └── {productName}.md
├── Configs/                         # Config documentation (Import, Export, Pipeline)
│   ├── Import - {configName}.md
│   ├── Export - {configName}.md
│   └── Pipeline - {pipelineName}.md
├── Reports/                         # CSV file documentation
│   └── CSV - {csvName}.md
├── Properties/                      # Frontmatter property documentation
│   └── Property - {propertyName}.md
└── Types/                           # Note type definitions
    └── Type - {typeName}.md

02 - Areas/                          # Area documents (from "Mark as Area")
└── {areaName}/
    └── {areaName}.md
```

---

## File Naming Conventions

| Pattern | Example | Used For |
|---------|---------|----------|
| `{name}.md` | `User.md` | Entity docs (domains, services, flows, systems, actors, products) |
| `{name}.architecture.md` | `User.architecture.md` | Architecture docs (Arc42 + C4) |
| `{name}.blueprint.md` | `UserService.blueprint.md` | Service blueprint docs |
| `{eventType}.md` | `user.created.md` | Event documentation |
| `Import - {name}.md` | `Import - Contacts.md` | Import config docs |
| `Export - {name}.md` | `Export - Assets.md` | Export config docs |
| `Pipeline - {name}.md` | `Pipeline - Full Sync.md` | Pipeline config docs |
| `CSV - {name}.md` | `CSV - contacts.md` | CSV file documentation |
| `Property - {name}.md` | `Property - status.md` | Property documentation |
| `Type - {name}.md` | `Type - Contact.md` | Note type definitions |

Names are sanitized before use in file paths: characters `\ / : * ? " < > | # ^ [ ]` are removed, and multiple spaces are collapsed.

---

## Data Dictionary Builder

The `DataDictionaryBuilder` service aggregates frontmatter property usage across all saved import configs, export configs, and pipelines into a unified data dictionary.

### DataDictionaryEntry

Each entry represents a single frontmatter property discovered across configurations:

| Field | Type | Description |
|-------|------|-------------|
| `propertyName` | string | The frontmatter key (e.g., "status", "category") |
| `usedInConfigs` | DataDictionaryConfigRef[] | Configs that reference this property |
| `csvColumnNames` | string[] | CSV columns that map to this property |
| `sampleValues` | string[] | Up to 5 unique sample values from custom properties |
| `typeNames` | string[] | Note types that expect this property (from config `noteType`) |

### DataDictionaryConfigRef

| Field | Type | Description |
|-------|------|-------------|
| `configId` | string | UUID of the referencing config |
| `configName` | string | Display name of the config |
| `configType` | string | `"import"` or `"export"` |

### Aggregation Sources

The builder scans three data sources:

1. **Import Configs** — Column mappings (CSV column → frontmatter key) and custom properties (key=value pairs)
2. **Export Configs** — Selected columns (frontmatter keys to export)
3. **Pipelines** — Merge keys, per-source column mappings, and per-source custom properties

---

## Cross-References

### Scan Methods

The catalog uses scanning methods to discover documents at render time:

| Method | Folder | Type Filter | Events Field |
|--------|--------|-------------|-------------|
| `scanEntityFolder("Domains", ...)` | `{docsRoot}/Domains/` | `DomainDoc` | Derived from catalog |
| `scanEntityFolder("Services", ...)` | `{docsRoot}/Services/` | `ServiceDoc` | Derived from catalog |
| `scanEntityFolder("Flows", ...)` | `{docsRoot}/Flows/` | `FlowDoc` | Read from frontmatter |
| `scanEntityFolder("Systems", ...)` | `{docsRoot}/Systems/` | `SystemDoc` | Derived from domains/services |
| `scanEntityFolder("Actors", ...)` | `{docsRoot}/Actors/` | `ActorDoc` | Read from frontmatter |
| `scanEntityFolder("Products", ...)` | `{docsRoot}/Products/` | `ProductDoc` | Read from frontmatter |

### Forgiving Frontmatter

The `fmString()` helper reads frontmatter with fallback field names:
- Domain: tries `domain` → `name` → falls back to filename
- Service: tries `service` → `name` → falls back to filename
- Category: tries `category` → `name` → falls back to filename

### Auto-Normalization

`normalizeDocFrontmatter()` automatically updates non-conforming files to the standard schema when opened in the catalog. This ensures consistency even for hand-edited documents.

---

## Related

- [[Frontend Architecture]] — Component architecture, state management, and refactoring history
- [[Backend Architecture]] — Domain service composition and event system
- [[Testplan and Teststrategy]] — Test coverage mapped to use cases (UC-01 through UC-99)
- [[Manage Data Dictionary]] — User journey flow for building the data dictionary
- [[Build Data Dictionary]] — Use case for documenting properties in the Properties tab

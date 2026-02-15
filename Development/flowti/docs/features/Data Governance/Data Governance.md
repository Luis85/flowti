---
type: Feature
domain_id:
version: 1
status: draft
enforcement_mode: advisory
created_at:
last_updated_at:
---

# Domain Validation Ruleset – {{Domain Name}}

> This ruleset defines structural, semantic, and behavioral constraints for this domain.

---

# 1. Purpose

This ruleset ensures:

- Consistent entity modeling
- Valid relationships
- Event discipline
- Documentation completeness
- Boundary enforcement

---

# 2. Entity Type Definitions

Define all allowed entity types in this domain.

## 2.1 Allowed Types

| Type | Description | Required Fields | Optional Fields |
|------|------------|----------------|----------------|
| product | Represents a product owned by this domain | name, status | description |
| contract | Represents a service contract | start_date, end_date | renewal_terms |

---

## 2.2 Type Constraints

Example:

- `product.status` must be one of:
  - draft
  - active
  - retired

- `contract.end_date` must be > `start_date`

---

# 3. Relationship Rules

Define allowed relationships.

## 3.1 Allowed Entity Relationships

| From Type | Relation | To Type | Cardinality |
|-----------|----------|--------|------------|
| product | fulfills | contract | 1:n |
| contract | references | product | 1:1 |

---

## 3.2 Forbidden Relationships

- product → unrelated_domain_entity
- contract → marketing_asset

---

# 4. Event Rules

## 4.1 Allowed Events

| Event Name | Emits | Required Payload |
|------------|-------|----------------|
| product.created | product | product_id |
| contract.activated | contract | contract_id |

---

## 4.2 Naming Conventions

- Must follow: `entity.action`
- Must be lowercase
- Must not duplicate existing event types

---

# 5. Documentation Rules

## Required Documentation Per Entity

| Entity Type | Required Artifacts |
|------------|-------------------|
| product | PRD, Story Map |
| contract | Technical Review |

---

## Required Fields in Domain Note

- Purpose
- Responsibilities
- Boundaries
- Owner
- At least one event
- At least one entity

---

# 6. Boundary Enforcement Rules

- Domain must not emit events owned by other domains
- Domain must not create entities owned by other domains
- Cross-domain relationships require explicit declaration

---

# 7. Rule Severity Levels

Each rule can be:

- advisory → Suggestion only
- warning → Flag in UI
- strict → Block action

---

# 8. YAML Machine-Readable Rules

```yaml
domain_validation:
  version: 1.0
  enforcement_mode: advisory

  entity_types:
    - name: product
      required_fields:
        - name
        - status
      allowed_status:
        - draft
        - active
        - retired

    - name: contract
      required_fields:
        - start_date
        - end_date
      constraints:
        - rule: end_date > start_date

  relationships:
    allowed:
      - from: product
        relation: fulfills
        to: contract
        cardinality: 1:n

    forbidden:
      - from: product
        to: marketing_asset

  events:
    allowed:
      - name: product.created
        payload_required:
          - product_id
      - name: contract.activated
        payload_required:
          - contract_id

    naming_convention:
      pattern: "^[a-z]+\\.[a-z]+$"

  documentation:
    required_sections:
      - purpose
      - responsibilities
      - boundaries
    required_entity_artifacts:
      product:
        - prd
        - story_map
      contract:
        - technical_review
````

---

# 9. Validation Model (Conceptual)

You can implement a DomainValidationService that:

1. Loads ruleset YAML
    
2. Validates:
    
    - Entity creation
        
    - Event creation
        
    - Relationship creation
        
    - Documentation completeness
        
3. Emits:
    
    - `domain.validation.warning`
        
    - `domain.validation.error`
        
    - `domain.validation.passed`
        

---

# 🧠 What This Enables

This transforms Flowti into:

- A Domain Governance Engine
    
- A Modeling Discipline Tool
    
- A Boundary Protection System
    
- A Self-enforcing Documentation Framework
    

---

# 🔒 Levels of Domain Governance

You can support:

|Mode|Behavior|
|---|---|
|advisory|Show suggestions only|
|warning|Highlight violations|
|strict|Prevent save/creation|

---

# 🧩 Advanced Extensions (Future)

- Cross-domain contract validation
    
- Event payload schema validation
    
- Auto-generated type schemas
    
- Domain drift detection
    
- Domain Health Index integration
    
- Three Amigos automatic validation checks
    
- Integration into Feature Readiness Index
    

---

# 🚀 Strategic Impact

If implemented correctly:

- Every domain becomes self-consistent
    
- Architectural drift is prevented
    
- Event discipline is enforced
    
- Documentation completeness is measurable
    
- Cross-domain chaos is minimized
    

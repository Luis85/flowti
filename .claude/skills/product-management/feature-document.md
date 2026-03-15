---
name: feature-document
description: Curate a feature document with customer-facing content and internal engineering reference — single source of truth for both audiences
user-invocable: true
---

# Feature Document

Guide the creation of a feature document that serves both external (customer-facing) and internal (engineering) audiences. Product management curates the external narrative; internal sections are auto-populated from linked requirements, deliverables, and iteration data.

**Iteration status context:** Anytime — not tied to a specific iteration state.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/skills/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
2. Read `<project>/configs/flowti.config.json` → `management.features.dir` to determine output location (default: `docs/features`)
2. Ask the user: **"Which feature do you want to document?"**
   - Accept a feature name (free text)
   - Or a link to an existing requirement/deliverable
3. If linked to existing items:
   - Read requirement files from `<project>/docs/requirements/*.md` — Grep for the feature name
   - Read deliverable files from `<project>/docs/deliverables/*.md` — Grep for the feature name
   - Read iteration plans to find scope items related to this feature
   - Parse user stories, acceptance criteria, status from the linked items
4. Read existing feature docs from the features dir to check if this feature already has a document (update vs. create)

### Step 2: Document Scaffold (hybrid)

Generate the initial scaffold. The document has two audience zones clearly separated:

**Template:**

```markdown
---
name: [Feature Name]
status: draft
created: YYYY-MM-DD
iteration: [Iteration Name, if linked]
requirements: [linked requirement file paths]
deliverables: [linked deliverable file paths]
---

# [Feature Name]

> [One-line tagline — what this feature is in plain language]

---

## Value Proposition

[What problem does this feature solve? Who benefits? Why does it matter?]

## Key Capabilities

- [Capability 1 — what the feature does, in user terms]
- [Capability 2]
- [Capability 3]

## Usage Examples

### [Example 1: Scenario Name]

[Concrete scenario showing the feature in action. Include commands, inputs, expected outputs where relevant.]

### [Example 2: Scenario Name]

[Another scenario for a different use case.]

## Known Limitations

- [Limitation 1 — honest about what the feature doesn't do yet]
- [Limitation 2]

---

<!-- Internal Reference — Engineering Only -->

## User Stories

[Auto-populated from linked requirements. Format:]

- **As a** [role], **I want to** [goal], **so that** [benefit]
  - Status: [draft/proposed/approved/implemented/verified]
  - Acceptance Criteria:
    - [ ] Criterion 1
    - [ ] Criterion 2

## Technical Notes

- **Architecture**: [How this feature fits into the system]
- **Dependencies**: [What it depends on]
- **Constraints**: [Technical limitations or requirements]

## Implementation Status

| Deliverable | Status | Iteration | Completion |
|-------------|--------|-----------|------------|
| [linked deliverable] | [status] | [iteration] | [%] |

## Success Metrics

- [Metric 1: how we measure whether this feature achieves its goal]
- [Metric 2]
```

### Step 3: Content Curation Loop (human-driven)

Walk through each **external section** one at a time:

1. **Tagline**: Draft a one-liner based on available data. Ask: **"Does this capture the essence? How would you phrase it?"**
2. **Value Proposition**: Draft based on requirement descriptions and user stories. Ask the user to refine the voice, emphasis, and framing
3. **Key Capabilities**: List capabilities from acceptance criteria and deliverables. Ask: **"Are these the right capabilities to highlight? Anything to add or remove?"**
4. **Usage Examples**: Draft concrete scenarios. Ask: **"Do these examples resonate? What scenarios would be most useful for users?"**
5. **Known Limitations**: Flag any constraints from RAID items or technical notes. Ask: **"What limitations should we be upfront about?"**

For **internal sections**:
- Auto-populate from linked items where possible
- Present to user for verification: **"I've populated the internal sections from [N requirements, M deliverables]. Please verify this is accurate."**
- User can adjust any section

### Step 4: Produce Feature Document (automated)

1. Determine the output path:
   - Read `management.features.dir` from config (default: `docs/features`)
   - Slugify the feature name: lowercase, replace spaces/special chars with `-`
   - Full path: `<project>/<features-dir>/<feature-slug>.md`

2. Write the document with all curated content

3. Set frontmatter `status`:
   - `draft` — initial creation, not yet reviewed
   - `review` — content reviewed by product management
   - `published` — approved for external consumption
   - Ask the user: **"What status should this document have?"** (default: `draft`)

4. Commit:
   ```
   git add "01 - Projects/Flowti CLI/<features-dir>/<feature-slug>.md"
   git commit -m "chore: feature-document — created [feature-name] feature doc"
   ```

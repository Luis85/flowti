---
name: three-amigos-review
description: Run a Three Amigos review — align Product Owner, Architect, and Tester perspectives on a scope item before it moves forward
user-invocable: true
---

# Three Amigos Review

Guide a Three Amigos review for one or more scope items. Ensures alignment between the Product Owner (value & acceptance criteria), Software Architect (technical approach & risks), and Tester (verification & edge cases) before a scope item advances.

**Iteration status context:** Any phase gate — used when a scope item needs alignment before moving forward.

## Before You Start

Read the foundation file for shared patterns:
- Read `.claude/commands/product-management/_foundation.md`

## Workflow

### Step 1: Gather Context (automated)

1. Ask the user which scope item(s) to review. Accept either:
   - A scope item description (text match against current iteration plan)
   - An iteration number + item index
   - "all open items" for a batch review
2. Resolve the project root from `.flowti/config.json` → `source` (see foundation)
3. Read the current iteration plan from `<project>/iterations/iteration-*-plan.md`
4. For each selected scope item, read:
   - Related requirements from `<project>/docs/requirements/*.md` (Grep for the item text)
   - Related deliverables from `<project>/docs/deliverables/*.md`
   - Related RAID items from `<project>/docs/raid/*.md`
5. Read the three agent definitions from `03 - Resources/Agents/` (vault-root-relative). Glob for `*.md` and exclude `*.prompt.md` files. Find agents by matching `name` in frontmatter:
   - Product Owner (`product-owner.md`) — for value/acceptance perspective
   - Software Architect (`software-architect.md`) — for technical/decomposition perspective
   - Tester (`tester.md`) — for verification/edge-case perspective

### Step 2: Present the Scope Item (automated)

For each scope item under review, present:

**Scope Item:** [description from plan]

**Current State:**
- Status: [ ] open / [x] done
- Iteration: #N, phase: [current status]
- Estimate: [if available]
- Priority: [if available]

**Existing Acceptance Criteria:**
- [list any existing criteria, or "None defined yet"]

**Related Items:**
- Requirements: [linked requirement files, or "None"]
- Deliverables: [linked deliverable files, or "None"]
- RAID: [linked risks/issues, or "None"]

### Step 3: Three Perspectives Loop (human-driven)

Walk through each perspective one at a time. For each, the skill **suggests** answers based on available data, then asks the user to **confirm, adjust, or replace**.

#### Product Owner Lens

Based on the Product Owner agent's skills (Scope Definition, Acceptance Criteria Writing, Story Mapping):

1. **"Is the value of this item clear? What problem does it solve and for whom?"**
   - Suggest a value statement based on the item description and related requirements
2. **"Are the acceptance criteria complete?"**
   - Suggest acceptance criteria based on the description. Each criterion should be:
     - Specific and testable
     - Expressed as "Given [context], when [action], then [outcome]"
   - Ask user to confirm/adjust
3. **"Is the priority correct?"**
   - Present current priority (if set) and ask if it should change

#### Software Architect Lens

Based on the Software Architect agent's skills (System Architecture, API Design, Technical Risk Assessment):

1. **"Is the technical approach clear? What's the high-level design?"**
   - Suggest an approach based on the item description and codebase patterns
2. **"What are the technical risks?"**
   - Flag potential risks: dependencies, complexity, unknown areas, performance concerns
3. **"How should this be decomposed into tasks?"**
   - Suggest a task breakdown with file-level changes
   - Ask user to confirm/adjust

#### Tester Lens

Based on the Tester agent's skills (Test Planning, Exploratory Testing, Risk-Based Testing):

1. **"How will we verify this? What test scenarios are needed?"**
   - Suggest test scenarios covering:
     - Happy path
     - Edge cases
     - Error cases
     - Integration points
2. **"What edge cases matter most?"**
   - Flag boundary conditions, null/empty inputs, concurrent access, etc.
3. **"What's the test approach?"**
   - Suggest: unit tests, integration tests, manual verification, or combination

### Step 4: Alignment Checkpoint (human-driven)

Present a consolidated view of all three perspectives:

```
## Alignment Summary

### Value & Acceptance (Product Owner)
- Value: [statement]
- Acceptance Criteria:
  - [ ] Criterion 1
  - [ ] Criterion 2

### Technical Approach (Software Architect)
- Design: [high-level approach]
- Risks: [flagged risks]
- Tasks: [breakdown]

### Verification (Tester)
- Test scenarios: [list]
- Edge cases: [list]
- Approach: [unit/integration/manual]
```

Ask: **"Are all three perspectives aligned? Any unresolved disagreements?"**

- If **disagreements exist**: capture each disagreement, present them, and ask the user to resolve one at a time
- If **aligned**: proceed to produce the record

### Step 5: Produce Review Record (automated)

1. Update the scope item in the iteration plan with refined acceptance criteria (if they changed)
2. Write the Three Amigos record to `<project>/iterations/three-amigos-<item-slug>-YYYY-MM-DD.md`:
   - `<item-slug>`: slugify the first 5 words of the scope item description

```markdown
---
type: ThreeAmigosReview
iteration: N
scopeItem: "Item description"
date: YYYY-MM-DD
aligned: true/false
---

# Three Amigos Review — [Item Description]

## Scope Item

[Full description]

## Product Owner Perspective

- **Value**: [statement]
- **Acceptance Criteria**:
  - [ ] Criterion 1
  - [ ] Criterion 2

## Software Architect Perspective

- **Technical Approach**: [design]
- **Risks**: [list]
- **Task Breakdown**:
  - [ ] Task 1
  - [ ] Task 2

## Tester Perspective

- **Test Scenarios**:
  - [ ] Scenario 1
  - [ ] Scenario 2
- **Edge Cases**: [list]
- **Test Approach**: [approach]

## Alignment

- Status: Aligned / Disagreements resolved
- [Any notes on resolved disagreements]
```

3. If the item is ready to advance, suggest updating the iteration status in the plan frontmatter
4. Commit all artifacts:
   ```
   git add "01 - Projects/Flowti CLI/iterations/three-amigos-*.md" "01 - Projects/Flowti CLI/iterations/iteration-NNN-plan.md"
   git commit -m "chore(iteration-N): three-amigos — reviewed [item slug], aligned"
   ```

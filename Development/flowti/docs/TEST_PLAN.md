# Flowti Test Plan

## Aktueller Stand

### Vorhandene Tests (20 Dateien)

| Modul | Test-Datei | Coverage |
|-------|------------|----------|
| EventBus | `events/EventBus.test.ts` | Hoch |
| ServiceContainer | `services/ServiceContainer.test.ts` | Hoch |
| CommandRegistry | `commands/CommandRegistry.test.ts` | Hoch |
| ErrorService | `errors/ErrorService.test.ts` | Hoch |
| FlowtiError | `errors/FlowtiError.test.ts` | Hoch |
| LoggerService | `logger/LoggerService.test.ts` | Hoch |
| UserService | `user/UserService.test.ts` | Hoch |
| SettingsService | `settings/SettingsService.test.ts` | Hoch |
| Types (Solutions) | `solutions/types.test.ts` | Nur Schema |
| Types (Ideas) | `ideas/types.test.ts` | Nur Schema |
| Types (Requirements) | `requirements/types.test.ts` | Nur Schema |
| Types (JTBD) | `jtbd/types.test.ts` | Nur Schema |
| Types (Features) | `features/types.test.ts` | Nur Schema |
| Types (Tasks) | `tasks/types.test.ts` | Nur Schema |

### Fehlende Tests (Priorität: Hoch -> Niedrig)

---

## Phase 1: Entity Services (Priorität: Hoch)

Diese Services sind geschäftskritisch und haben keine Unit-Tests.

### 1.1 SolutionService Tests

**Datei:** `tests/solutions/SolutionService.test.ts`

```typescript
describe("SolutionService", () => {
  describe("create", () => {
    it("should create a solution with valid input");
    it("should generate UUID and timestamps");
    it("should create solution folder and file");
    it("should emit solution.created event");
    it("should throw ValidationError for empty name");
    it("should sanitize special characters in name");
  });

  describe("load", () => {
    it("should load solution by ID");
    it("should return null for non-existent ID");
    it("should emit solution.loaded event");
    it("should parse frontmatter correctly");
    it("should extract title from H1 heading");
  });

  describe("listAll", () => {
    it("should return all solutions sorted by createdAt");
    it("should handle both folder and flat structures");
    it("should return empty array when no solutions");
  });

  describe("update", () => {
    it("should update solution fields");
    it("should rename file when name changes");
    it("should update timestamps");
    it("should emit solution.updated event");
    it("should throw ValidationError for non-existent solution");
  });

  describe("delete", () => {
    it("should delete solution file and folder");
    it("should emit solution.deleted event");
    it("should throw ValidationError for non-existent solution");
  });
});
```

### 1.2 IdeaService Tests

**Datei:** `tests/ideas/IdeaService.test.ts`

```typescript
describe("IdeaService", () => {
  describe("create", () => {
    it("should create idea within existing solution");
    it("should throw when solution not found");
    it("should create Ideas subfolder if not exists");
    it("should emit idea.created event");
  });

  describe("listBySolution", () => {
    it("should return only ideas for specified solution");
    it("should return empty array for invalid solution");
  });

  describe("listAll", () => {
    it("should aggregate ideas from all solutions");
  });

  describe("update", () => {
    it("should update idea fields");
    it("should rename file when title changes");
    it("should emit idea.updated event");
  });

  describe("delete", () => {
    it("should delete idea file");
    it("should emit idea.deleted event");
  });
});
```

### 1.3 RequirementService Tests

**Datei:** `tests/requirements/RequirementService.test.ts`

```typescript
describe("RequirementService", () => {
  describe("create", () => {
    it("should create requirement with acceptance criteria");
    it("should link to ideas via linkedIdeas");
  });

  describe("getByLinkedIdea", () => {
    it("should return requirements linked to specific idea");
  });

  describe("frontmatter arrays", () => {
    it("should parse acceptanceCriteria array");
    it("should parse linkedIdeas array");
    it("should handle empty arrays");
  });
});
```

### 1.4 JTBDService Tests

**Datei:** `tests/jtbd/JTBDService.test.ts`

```typescript
describe("JTBDService", () => {
  describe("create", () => {
    it("should create JTBD with importance/satisfaction defaults");
    it("should sanitize long job statements for filename");
  });

  describe("sections", () => {
    it("should parse context section from markdown");
    it("should parse motivation section from markdown");
    it("should parse outcome section from markdown");
  });

  describe("getByLinkedIdea", () => {
    it("should return JTBDs linked to idea");
  });

  describe("getByLinkedRequirement", () => {
    it("should return JTBDs linked to requirement");
  });
});
```

### 1.5 FeatureService Tests

**Datei:** `tests/features/FeatureService.test.ts`

```typescript
describe("FeatureService", () => {
  describe("create", () => {
    it("should create feature with default status Draft");
  });

  describe("links", () => {
    it("should parse linkedIdeas array");
    it("should parse linkedRequirements array");
  });

  describe("getByLinkedIdea", () => {
    it("should return features linked to idea");
  });

  describe("getByLinkedRequirement", () => {
    it("should return features linked to requirement");
  });
});
```

### 1.6 TaskService Tests

**Datei:** `tests/tasks/TaskService.test.ts`

```typescript
describe("TaskService", () => {
  describe("create", () => {
    it("should create task with default status Todo");
    it("should handle dueDate field");
  });

  describe("markDone", () => {
    it("should set status to Done");
    it("should set completedAt timestamp");
  });

  describe("getOverdue", () => {
    it("should return tasks with passed dueDate");
    it("should exclude Done and Cancelled tasks");
  });

  describe("links", () => {
    it("should parse all linkedXxx arrays");
  });
});
```

---

## Phase 2: BaseEntityService (Priorität: Mittel)

**Datei:** `tests/utils/BaseEntityService.test.ts`

```typescript
describe("BaseEntityService", () => {
  describe("parseFrontmatter", () => {
    it("should parse simple key-value pairs");
    it("should handle quoted values");
    it("should skip array items");
  });

  describe("parseFrontmatterWithArrays", () => {
    it("should parse YAML arrays");
    it("should handle mixed content");
    it("should handle empty arrays");
  });

  describe("sanitizePath", () => {
    it("should replace invalid characters");
  });

  describe("extractTitle", () => {
    it("should extract from H1 heading");
    it("should fallback to provided value");
  });

  describe("extractDescription", () => {
    it("should extract text after H1");
    it("should stop at next heading");
    it("should skip placeholder text");
  });

  describe("error helpers", () => {
    it("throwNotFoundError should throw ValidationError");
    it("throwEmptyTitleError should throw ValidationError");
    it("throwSolutionNotFoundError should throw ValidationError");
  });
});
```

---

## Phase 3: Views (Priorität: Niedrig)

Views sind schwerer zu testen, da sie DOM-Manipulation erfordern.

### 3.1 SolutionExplorerView Tests

**Datei:** `tests/views/SolutionExplorerView.test.ts`

```typescript
describe("SolutionExplorerView", () => {
  describe("onOpen", () => {
    it("should render solution list");
    it("should subscribe to solution events");
  });

  describe("refreshSolutions", () => {
    it("should reload solution list");
    it("should preserve selection if possible");
  });

  describe("event handling", () => {
    it("should refresh on solution.created");
    it("should refresh on solution.deleted");
  });
});
```

### 3.2 SolutionDetailView Tests

**Datei:** `tests/views/SolutionDetailView.test.ts`

```typescript
describe("SolutionDetailView", () => {
  describe("loadSolution", () => {
    it("should load all solution artifacts");
    it("should count ideas, requirements, features, tasks");
  });

  describe("tabs", () => {
    it("should render Overview tab");
    it("should render Ideas tab");
    it("should render Requirements tab");
  });
});
```

---

## Phase 4: Integration Tests (Priorität: Mittel)

### 4.1 Command Execution Tests

**Datei:** `tests/integration/commands.test.ts`

```typescript
describe("Command Integration", () => {
  describe("flowti:create-solution", () => {
    it("should open CreateSolutionModal");
    it("should create solution when modal submitted");
  });

  describe("flowti:add-idea", () => {
    it("should show error if no solution selected");
    it("should open CreateIdeaModal with solution context");
  });

  describe("flowti:generate-canvas", () => {
    it("should generate traceability canvas");
    it("should generate solution overview canvas");
  });
});
```

### 4.2 Traceability Tests

**Datei:** `tests/integration/traceability.test.ts`

```typescript
describe("Traceability", () => {
  it("should link idea to requirement");
  it("should link requirement to feature");
  it("should link feature to task");
  it("should traverse full chain: Idea -> Req -> Feature -> Task");
});
```

---

## Test Setup Requirements

### Mock-Erweiterungen

Die bestehenden Mocks müssen erweitert werden:

**`tests/mocks/obsidian-stub.ts`**

```typescript
// Erweiterte Vault-Mock für Entity-Service-Tests
export const mockVault = {
  create: vi.fn(),
  read: vi.fn(),
  modify: vi.fn(),
  delete: vi.fn(),
  createFolder: vi.fn(),
  getAbstractFileByPath: vi.fn(),
  getMarkdownFiles: vi.fn(() => []),
  getAllLoadedFiles: vi.fn(() => []),
};

export const mockFileManager = {
  renameFile: vi.fn(),
};
```

### Test Fixtures

**`tests/fixtures/solutions.ts`**

```typescript
export const mockSolutionFrontmatter = {
  id: "test-uuid-1234",
  type: "Product",
  phase: "Ideate",
  status: "Active",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
};

export const mockSolutionContent = `---
id: "test-uuid-1234"
type: "Product"
phase: "Ideate"
status: "Active"
createdAt: "2024-01-01T00:00:00.000Z"
updatedAt: "2024-01-01T00:00:00.000Z"
---

# Test Solution

A test solution for unit tests.
`;
```

---

## Ausführung

```bash
# Alle Tests
npm test

# Spezifische Module
npm test -- --grep "SolutionService"
npm test -- --grep "BaseEntityService"

# Coverage Report
npm run test:coverage
```

---

## Priorisierung

| Phase | Tests | Aufwand | Priorität |
|-------|-------|---------|-----------|
| 1.1 | SolutionService | Mittel | Hoch |
| 1.2 | IdeaService | Mittel | Hoch |
| 1.3 | RequirementService | Mittel | Hoch |
| 1.4 | JTBDService | Mittel | Hoch |
| 1.5 | FeatureService | Mittel | Hoch |
| 1.6 | TaskService | Mittel | Hoch |
| 2 | BaseEntityService | Niedrig | Mittel |
| 3 | Views | Hoch | Niedrig |
| 4 | Integration | Hoch | Mittel |

---

## Empfohlene Reihenfolge

1. **BaseEntityService Tests** - Basis für alle Services
2. **SolutionService Tests** - Root Entity
3. **IdeaService Tests** - Abhängig von SolutionService
4. **RequirementService Tests** - Abhängig von Solution + Ideas
5. **JTBDService Tests**
6. **FeatureService Tests**
7. **TaskService Tests**
8. **Integration Tests**
9. **View Tests** (optional)

---

## Metriken-Ziel

| Metrik | Aktuell | Ziel |
|--------|---------|------|
| Statement Coverage | ~40% | 80% |
| Branch Coverage | ~30% | 70% |
| Function Coverage | ~35% | 75% |
| Entity Services | 0% | 80% |

# Data Validation Testing Strategy

## Ziel

Sicherstellen, dass alle Flowti Solution-Dateien korrekt vom Plugin geladen und verarbeitet werden können.

---

## 1. Unit Test Suite für Parser

### 1.1 Frontmatter Parsing Tests

```typescript
// tests/parsing/frontmatter.test.ts

import { parseFrontmatter } from "../../src/utils/frontmatter";

describe("Frontmatter Parser", () => {
  describe("Basic Parsing", () => {
    it("should parse simple key-value pairs", () => {
      const content = `---
id: "abc123"
status: "Active"
---
# Title`;
      const result = parseFrontmatter(content);
      expect(result.id).toBe("abc123");
      expect(result.status).toBe("Active");
    });

    it("should parse YAML arrays", () => {
      const content = `---
acceptanceCriteria:
  - "Criterion 1"
  - "Criterion 2"
---`;
      const result = parseFrontmatter(content);
      expect(result.acceptanceCriteria).toEqual(["Criterion 1", "Criterion 2"]);
    });

    it("should handle empty arrays", () => {
      const content = `---
linkedIdeas: []
---`;
      const result = parseFrontmatter(content);
      expect(result.linkedIdeas).toEqual([]);
    });
  });

  describe("Error Handling", () => {
    it("should return null for missing frontmatter", () => {
      const content = "# Just a title";
      const result = parseFrontmatter(content);
      expect(result).toBeNull();
    });

    it("should return null for malformed YAML", () => {
      const content = `---
invalid: yaml: here
---`;
      const result = parseFrontmatter(content);
      expect(result).toBeNull();
    });
  });
});
```

### 1.2 Schema Validation Tests

```typescript
// tests/requirements/RequirementSchema.test.ts

import { RequirementFrontmatterSchema, REQUIREMENT_STATUSES, PRIORITIES } from "../../src/requirements/types";

describe("RequirementFrontmatterSchema", () => {
  const validFrontmatter = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    priority: "High",
    status: "Proposed",
    solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3",
    createdAt: "2026-01-26T22:30:00.000Z",
    updatedAt: "2026-01-26T22:30:00.000Z",
  };

  describe("Valid Data", () => {
    it("should accept valid frontmatter", () => {
      const result = RequirementFrontmatterSchema.safeParse(validFrontmatter);
      expect(result.success).toBe(true);
    });

    it("should accept all valid status values", () => {
      REQUIREMENT_STATUSES.forEach(status => {
        const data = { ...validFrontmatter, status };
        const result = RequirementFrontmatterSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should accept all valid priority values", () => {
      PRIORITIES.forEach(priority => {
        const data = { ...validFrontmatter, priority };
        const result = RequirementFrontmatterSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should accept optional acceptanceCriteria", () => {
      const data = {
        ...validFrontmatter,
        acceptanceCriteria: ["Criterion 1", "Criterion 2"],
      };
      const result = RequirementFrontmatterSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Invalid Data", () => {
    it("should reject non-UUID id", () => {
      const data = { ...validFrontmatter, id: "req-001-invalid" };
      const result = RequirementFrontmatterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject invalid status", () => {
      const data = { ...validFrontmatter, status: "InvalidStatus" };
      const result = RequirementFrontmatterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject invalid priority", () => {
      const data = { ...validFrontmatter, priority: "Must Have" };
      const result = RequirementFrontmatterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject missing required fields", () => {
      const data = { id: validFrontmatter.id };
      const result = RequirementFrontmatterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should ignore unknown fields", () => {
      const data = { ...validFrontmatter, unknownField: "value" };
      const result = RequirementFrontmatterSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).unknownField).toBeUndefined();
      }
    });
  });
});
```

---

## 2. Service Integration Tests

### 2.1 RequirementService Tests

```typescript
// tests/requirements/RequirementService.integration.test.ts

import { RequirementService } from "../../src/requirements/RequirementService";
import { createMockApp, createMockEventBus } from "../mocks";

describe("RequirementService Integration", () => {
  let service: RequirementService;
  let mockApp: MockApp;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    mockApp = createMockApp();
    mockEventBus = createMockEventBus();
    service = new RequirementService({
      app: mockApp,
      eventBus: mockEventBus,
      solutionsFolder: "Solutions",
    });
  });

  describe("load", () => {
    it("should load valid requirement from file", async () => {
      // Setup mock file with valid content
      mockApp.vault.setFile("Solutions/Test/Requirements/Test.md", `---
id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
priority: "High"
status: "Proposed"
solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3"
createdAt: "2026-01-26T22:30:00.000Z"
updatedAt: "2026-01-26T22:30:00.000Z"
---
# Test Requirement`);

      const result = await service.load("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
      expect(result?.priority).toBe("High");
      expect(result?.status).toBe("Proposed");
    });

    it("should return null for invalid UUID in file", async () => {
      mockApp.vault.setFile("Solutions/Test/Requirements/Invalid.md", `---
id: "req-001-invalid"
priority: "High"
status: "Proposed"
solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3"
createdAt: "2026-01-26T22:30:00.000Z"
updatedAt: "2026-01-26T22:30:00.000Z"
---
# Invalid Requirement`);

      const result = await service.load("req-001-invalid");

      expect(result).toBeNull();
    });

    it("should return null for invalid priority value", async () => {
      mockApp.vault.setFile("Solutions/Test/Requirements/BadPriority.md", `---
id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e"
priority: "Must Have"
status: "Proposed"
solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3"
createdAt: "2026-01-26T22:30:00.000Z"
updatedAt: "2026-01-26T22:30:00.000Z"
---
# Bad Priority Requirement`);

      const result = await service.load("b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e");

      expect(result).toBeNull();
    });
  });

  describe("listBySolution", () => {
    it("should only return valid requirements", async () => {
      // Setup: 2 valid, 1 invalid requirement
      mockApp.vault.setFile("Solutions/Test/Requirements/Valid1.md", validRequirement("id1"));
      mockApp.vault.setFile("Solutions/Test/Requirements/Valid2.md", validRequirement("id2"));
      mockApp.vault.setFile("Solutions/Test/Requirements/Invalid.md", `---
id: "invalid-id"
---`);

      const results = await service.listBySolution("solution-id");

      expect(results.length).toBe(2);
    });

    it("should emit error event for invalid files", async () => {
      mockApp.vault.setFile("Solutions/Test/Requirements/Invalid.md", `---
id: "invalid-id"
---`);

      await service.listBySolution("solution-id");

      expect(mockEventBus.emitted("error.occurred")).toBe(true);
    });
  });
});
```

---

## 3. End-to-End Tests

### 3.1 Solution Loading E2E

```typescript
// tests/e2e/SolutionLoading.e2e.test.ts

describe("Solution Loading E2E", () => {
  it("should load complete solution with all entities", async () => {
    // This test uses a real test vault in tests/fixtures/test-vault
    const solution = await solutionService.load("test-solution-id");

    expect(solution).not.toBeNull();

    // Load related entities
    const ideas = await ideaService.listBySolution(solution!.id);
    const requirements = await requirementService.listBySolution(solution!.id);
    const features = await featureService.listBySolution(solution!.id);
    const tasks = await taskService.listBySolution(solution!.id);
    const jtbds = await jtbdService.listBySolution(solution!.id);

    // Verify traceability chain
    requirements.forEach(req => {
      if (req.linkedIdeas) {
        req.linkedIdeas.forEach(ideaId => {
          expect(ideas.some(i => i.id === ideaId)).toBe(true);
        });
      }
    });
  });
});
```

---

## 4. Validation Script (CLI)

### 4.1 validate-solution.ts

```typescript
// scripts/validate-solution.ts

import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import {
  RequirementFrontmatterSchema,
  FeatureFrontmatterSchema,
  TaskFrontmatterSchema,
  IdeaFrontmatterSchema,
  JTBDFrontmatterSchema,
} from "../src";

interface ValidationError {
  file: string;
  entityType: string;
  errors: string[];
}

async function parseFrontmatter(content: string): Promise<Record<string, any> | null> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  // Simple YAML parsing
  const yaml = match[1];
  const result: Record<string, any> = {};

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of yaml.split("\n")) {
    if (line.startsWith("  - ")) {
      if (currentArray) {
        currentArray.push(line.slice(4).replace(/^"|"$/g, ""));
      }
    } else if (line.includes(":")) {
      if (currentArray && currentKey) {
        result[currentKey] = currentArray;
        currentArray = null;
      }

      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();
      currentKey = key.trim();

      if (value === "" || value === "[]") {
        currentArray = [];
      } else {
        result[currentKey] = value.replace(/^"|"$/g, "");
        currentKey = null;
      }
    }
  }

  if (currentArray && currentKey) {
    result[currentKey] = currentArray;
  }

  return result;
}

function getSchema(entityType: string) {
  const schemas: Record<string, any> = {
    Requirement: RequirementFrontmatterSchema,
    Feature: FeatureFrontmatterSchema,
    Task: TaskFrontmatterSchema,
    Idea: IdeaFrontmatterSchema,
    JTBD: JTBDFrontmatterSchema,
  };
  return schemas[entityType];
}

function detectEntityType(filePath: string): string {
  if (filePath.includes("/Requirements/")) return "Requirement";
  if (filePath.includes("/Features/")) return "Feature";
  if (filePath.includes("/Tasks/")) return "Task";
  if (filePath.includes("/Ideas/")) return "Idea";
  if (filePath.includes("/JTBD/")) return "JTBD";
  return "Unknown";
}

async function validateSolution(solutionPath: string): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const files = await glob(`${solutionPath}/**/*.md`);

  for (const file of files) {
    const entityType = detectEntityType(file);
    if (entityType === "Unknown") continue;

    const schema = getSchema(entityType);
    if (!schema) continue;

    try {
      const content = await fs.readFile(file, "utf-8");
      const frontmatter = await parseFrontmatter(content);

      if (!frontmatter) {
        errors.push({
          file,
          entityType,
          errors: ["No frontmatter found"],
        });
        continue;
      }

      const result = schema.safeParse(frontmatter);
      if (!result.success) {
        errors.push({
          file,
          entityType,
          errors: result.error.issues.map(
            (i: any) => `${i.path.join(".")}: ${i.message}`
          ),
        });
      }
    } catch (e: any) {
      errors.push({
        file,
        entityType,
        errors: [e.message],
      });
    }
  }

  return errors;
}

async function main() {
  const solutionPath = process.argv[2] || "Solutions";

  console.log(`Validating solution at: ${solutionPath}\n`);

  const errors = await validateSolution(solutionPath);

  if (errors.length === 0) {
    console.log("✅ All files are valid!");
    process.exit(0);
  }

  console.log(`❌ Found ${errors.length} validation errors:\n`);

  for (const error of errors) {
    console.log(`📄 ${error.file}`);
    console.log(`   Type: ${error.entityType}`);
    for (const e of error.errors) {
      console.log(`   ❌ ${e}`);
    }
    console.log();
  }

  process.exit(1);
}

main();
```

### 4.2 Package.json Script

```json
{
  "scripts": {
    "validate": "ts-node scripts/validate-solution.ts",
    "validate:flowti": "ts-node scripts/validate-solution.ts 'Solutions/Flowti - Integrated Business Development Environment'"
  }
}
```

---

## 5. Test Fixtures

### 5.1 Valid Entity Fixtures

```typescript
// tests/fixtures/entities.ts

export const validRequirement = (id?: string) => ({
  id: id || "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  priority: "High" as const,
  status: "Proposed" as const,
  solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3",
  createdAt: "2026-01-26T22:30:00.000Z",
  updatedAt: "2026-01-26T22:30:00.000Z",
});

export const validFeature = (id?: string) => ({
  id: id || "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  status: "Draft" as const,
  solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3",
  createdAt: "2026-01-26T22:30:00.000Z",
  updatedAt: "2026-01-26T22:30:00.000Z",
});

export const validTask = (id?: string) => ({
  id: id || "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
  status: "Todo" as const,
  solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3",
  priority: "High" as const,
  createdAt: "2026-01-26T22:30:00.000Z",
  updatedAt: "2026-01-26T22:30:00.000Z",
});

export const validIdea = (id?: string) => ({
  id: id || "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8g",
  status: "Active" as const,
  solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3",
  createdAt: "2026-01-26T22:30:00.000Z",
  updatedAt: "2026-01-26T22:30:00.000Z",
});

export const validJTBD = (id?: string) => ({
  id: id || "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8g9h",
  status: "Active" as const,
  solutionId: "89043a4d-7a1d-4aef-ada5-9e0bddbfa9a3",
  importance: 4,
  satisfaction: 2,
  createdAt: "2026-01-26T22:30:00.000Z",
  updatedAt: "2026-01-26T22:30:00.000Z",
});
```

### 5.2 Invalid Entity Fixtures (for negative tests)

```typescript
// tests/fixtures/invalidEntities.ts

export const invalidIds = [
  "req-001-invalid",        // Not UUID format
  "12345",                  // Too short
  "",                       // Empty
  "not-a-uuid-at-all",      // Plain text
  "a1b2c3d4-e5f6-NOT-VALID-0e1f2a3b4c5d", // Contains non-hex
];

export const invalidPriorities = [
  "Must Have",              // MOSCOW notation
  "Should Have",            // MOSCOW notation
  "Could Have",             // MOSCOW notation
  "Critical",               // Wrong enum
  1,                        // Wrong type
  "",                       // Empty
];

export const invalidStatuses = {
  requirement: ["Draft", "Active", "Done", "InProgress"],
  feature: ["Proposed", "Approved", "Done"],
  task: ["Proposed", "Approved", "Active"],
  idea: ["Proposed", "Draft", "Done"],
  jtbd: ["Proposed", "Draft", "Done"],
};
```

---

## 6. Mocks

### 6.1 Obsidian Vault Mock

```typescript
// tests/mocks/VaultMock.ts

export class VaultMock {
  private files: Map<string, string> = new Map();

  setFile(path: string, content: string) {
    this.files.set(path, content);
  }

  async read(file: TFile): Promise<string> {
    const content = this.files.get(file.path);
    if (!content) throw new Error(`File not found: ${file.path}`);
    return content;
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  async create(path: string, content: string): Promise<TFile> {
    this.files.set(path, content);
    return { path } as TFile;
  }

  async delete(file: TFile): Promise<void> {
    this.files.delete(file.path);
  }

  getAbstractFileByPath(path: string): TFile | null {
    if (this.files.has(path)) {
      return { path } as TFile;
    }
    return null;
  }

  getMarkdownFiles(): TFile[] {
    return Array.from(this.files.keys())
      .filter(p => p.endsWith(".md"))
      .map(p => ({ path: p } as TFile));
  }
}
```

### 6.2 EventBus Mock

```typescript
// tests/mocks/EventBusMock.ts

export class EventBusMock implements IEventBus {
  private emittedEvents: Array<{ type: string; payload: any }> = [];

  emit<K extends keyof FlowtiEventMap>(
    type: K,
    payload: FlowtiEventMap[K]
  ): void {
    this.emittedEvents.push({ type, payload });
  }

  on<K extends keyof FlowtiEventMap>(
    type: K,
    handler: EventHandler<FlowtiEventMap[K]>
  ): () => void {
    return () => {};
  }

  // Test helpers
  emitted(type: string): boolean {
    return this.emittedEvents.some(e => e.type === type);
  }

  getEmittedPayload(type: string): any {
    return this.emittedEvents.find(e => e.type === type)?.payload;
  }

  clear(): void {
    this.emittedEvents = [];
  }
}
```

---

## 7. CI/CD Integration

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/validate.yml

name: Validate Solution Data

on:
  push:
    paths:
      - "Solutions/**/*.md"
  pull_request:
    paths:
      - "Solutions/**/*.md"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci
        working-directory: Development/flowti

      - name: Validate Solution Data
        run: npm run validate
        working-directory: Development/flowti
```

---

## 8. Zusammenfassung

| Test-Typ | Dateien | Abdeckung |
|----------|---------|-----------|
| Unit Tests (Schemas) | 5 | Alle Entity-Typen |
| Integration Tests | 5 | Alle Services |
| E2E Tests | 1 | Vollständige Solution |
| Validation Script | 1 | CLI Tool |
| Mocks | 2 | Vault, EventBus |
| Fixtures | 2 | Valid + Invalid |

**Empfohlene Reihenfolge:**
1. Schema Validation Tests implementieren
2. Validation Script erstellen und ausführen
3. Bestehende Dateien korrigieren
4. Service Integration Tests
5. E2E Tests

# Flowti Solution Validation Report

## Executive Summary

Bei der Prüfung der erstellten Flowti Solution-Dateien gegen die implementierten Zod-Schemas wurden **kritische Diskrepanzen** gefunden. Die Dateien werden vom Plugin **nicht korrekt geladen** werden.

| Entity-Typ | Dateien | Schema-Konform | Kritische Fehler |
|------------|---------|----------------|------------------|
| Requirements | 6 | ❌ NEIN | 4 Fehlertypen |
| Features | 6 | ❌ NEIN | 3 Fehlertypen |
| Tasks | 10 | ❌ NEIN | 4 Fehlertypen |
| Ideas | 1 | ✅ JA | 0 |
| JTBDs | 3 | ⚠️ TEILWEISE | 1 Fehlertyp (neue Datei) |

---

## 1. Requirement-Dateien - Kritische Fehler

### Erwartetes Schema (RequirementFrontmatterSchema)

```typescript
{
  id: UUIDSchema,                    // MUSS UUID v4 sein!
  priority: PrioritySchema,          // "High" | "Medium" | "Low"
  status: RequirementStatusSchema,   // "Proposed" | "Approved" | "Satisfied" | "Obsolete"
  solutionId: UUIDSchema,
  acceptanceCriteria: z.array(z.string()).optional(),
  linkedIdeas: z.array(UUIDSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}
```

### Ist-Zustand (REQ-001 Git Integration.md)

```yaml
id: "req-001-git-integration"    # ❌ FALSCH - kein UUID v4!
status: "Approved"               # ✅ OK
type: "Functional"               # ❌ UNBEKANNTES FELD
priority: "Must Have"            # ❌ FALSCH - muss "High"|"Medium"|"Low" sein
solutionId: "89043a4d-..."       # ✅ OK
sourceIdeaId: null               # ❌ UNBEKANNTES FELD
createdAt: "2026-01-26T..."      # ✅ OK
updatedAt: "2026-01-26T..."      # ✅ OK
```

### Fehler in allen 6 Requirement-Dateien

| Fehler | Beschreibung | Auswirkung |
|--------|--------------|------------|
| **ID nicht UUID** | `"req-001-git-integration"` statt UUID v4 | Zod-Validation schlägt fehl |
| **Falscher Priority-Wert** | `"Must Have"` statt `"High"` | Enum-Validation schlägt fehl |
| **Unbekanntes Feld `type`** | `"Functional"` nicht im Schema | Wird ignoriert (kein Fehler) |
| **Unbekanntes Feld `sourceIdeaId`** | Sollte `linkedIdeas` Array sein | Wird ignoriert |

---

## 2. Feature-Dateien - Kritische Fehler

### Erwartetes Schema (FeatureFrontmatterSchema)

```typescript
{
  id: UUIDSchema,
  status: FeatureStatusSchema,       // "Draft" | "Active" | "Implemented" | "Deprecated"
  solutionId: UUIDSchema,
  priority: PrioritySchema.optional(),
  linkedIdeas: z.array(UUIDSchema).optional(),
  linkedRequirements: z.array(UUIDSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}
```

### Ist-Zustand (FEAT-001 GitService.md)

```yaml
id: "feat-001-git-service"       # ❌ FALSCH - kein UUID v4!
status: "Draft"                  # ✅ OK
solutionId: "89043a4d-..."       # ✅ OK
requirementId: "req-001-..."     # ❌ FALSCHER FELDNAME + kein Array
createdAt: "2026-01-26T..."      # ✅ OK
updatedAt: "2026-01-26T..."      # ✅ OK
```

### Fehler in allen 6 Feature-Dateien

| Fehler | Beschreibung | Auswirkung |
|--------|--------------|------------|
| **ID nicht UUID** | `"feat-001-git-service"` statt UUID v4 | Zod-Validation schlägt fehl |
| **Falscher Feldname** | `requirementId` statt `linkedRequirements` | Verknüpfung geht verloren |
| **Kein Array** | Einzelwert statt Array | Falscher Typ |

---

## 3. Task-Dateien - Kritische Fehler

### Erwartetes Schema (TaskFrontmatterSchema)

```typescript
{
  id: UUIDSchema,
  status: TaskStatusSchema,          // "Todo" | "InProgress" | "Done" | "Blocked" | "Cancelled"
  solutionId: UUIDSchema,
  priority: PrioritySchema.optional(),
  linkedIdeas: z.array(UUIDSchema).optional(),
  linkedFeatures: z.array(UUIDSchema).optional(),
  linkedRequirements: z.array(UUIDSchema).optional(),
  linkedJTBDs: z.array(UUIDSchema).optional(),
  dueDate: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
}
```

### Ist-Zustand (TASK-001 Create GitService types.md)

```yaml
id: "task-001-git-types"         # ❌ FALSCH - kein UUID v4!
status: "Todo"                   # ✅ OK
type: "Development"              # ❌ UNBEKANNTES FELD
priority: "High"                 # ✅ OK
solutionId: "89043a4d-..."       # ✅ OK
featureId: "feat-001-..."        # ❌ FALSCHER FELDNAME + kein Array + kein UUID
estimatedHours: 2                # ❌ UNBEKANNTES FELD
createdAt: "2026-01-26T..."      # ✅ OK
updatedAt: "2026-01-26T..."      # ✅ OK
```

### Fehler in allen 10 Task-Dateien

| Fehler | Beschreibung | Auswirkung |
|--------|--------------|------------|
| **ID nicht UUID** | `"task-001-git-types"` statt UUID v4 | Zod-Validation schlägt fehl |
| **Unbekanntes Feld `type`** | `"Development"` nicht im Schema | Wird ignoriert |
| **Falscher Feldname** | `featureId` statt `linkedFeatures` | Verknüpfung geht verloren |
| **Unbekanntes Feld `estimatedHours`** | Nicht im Schema | Wird ignoriert |

---

## 4. Idea-Dateien - OK

### Ist-Zustand (Add dark mode support.md)

```yaml
id: "f80247f1-63d9-4882-89cf-79e02a8ebc48"  # ✅ Korrektes UUID
status: "Active"                             # ✅ OK
solutionId: "89043a4d-..."                   # ✅ OK
createdAt: "2026-01-25T..."                  # ✅ OK
updatedAt: "2026-01-26T..."                  # ✅ OK
```

**Status: ✅ SCHEMA-KONFORM**

---

## 5. JTBD-Dateien - Teilweise OK

### Bestehende Dateien (korrekt)

```yaml
# Track project progress at a glance.md
id: "e9693a05-7ca5-4a64-9241-38ce97fd3a1b"  # ✅ UUID
status: "Active"                             # ✅ OK
solutionId: "89043a4d-..."                   # ✅ OK
importance: 8                                # ⚠️ WARNUNG: Schema erlaubt nur 1-5!
satisfaction: 3                              # ✅ OK (1-5)
```

### Neu erstellte Datei (fehlerhaft)

```yaml
# Track changes and history.md
id: "jtbd-002-track-changes"                 # ❌ FALSCH - kein UUID!
importance: 9                                # ❌ AUSSERHALB 1-5 Skala
satisfaction: 1                              # ✅ OK
```

---

## 6. Korrekturplan

### Phase 1: IDs korrigieren (kritisch)

Alle Dateien benötigen echte UUID v4 IDs:

```bash
# Generiere neue UUIDs für jede Datei
# PowerShell: [guid]::NewGuid().ToString()
# Node.js: require('crypto').randomUUID()
```

| Datei | Alt | Neu (Beispiel) |
|-------|-----|----------------|
| REQ-001 | `req-001-git-integration` | `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d` |
| FEAT-001 | `feat-001-git-service` | `b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e` |
| TASK-001 | `task-001-git-types` | `c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f` |

### Phase 2: Enum-Werte korrigieren

| Datei | Feld | Alt | Neu |
|-------|------|-----|-----|
| REQ-* | priority | `"Must Have"` | `"High"` |
| REQ-* | priority | `"Should Have"` | `"Medium"` |
| REQ-* | priority | `"Could Have"` | `"Low"` |

### Phase 3: Feldnamen korrigieren

| Entity | Alt | Neu |
|--------|-----|-----|
| Feature | `requirementId: "..."` | `linkedRequirements: ["..."]` |
| Task | `featureId: "..."` | `linkedFeatures: ["..."]` |

### Phase 4: Unbekannte Felder entfernen oder Schema erweitern

**Option A: Felder entfernen**
- `type` (in Requirements, Tasks)
- `sourceIdeaId` (in Requirements)
- `estimatedHours` (in Tasks)

**Option B: Schema erweitern (empfohlen)**
Diese Felder sind nützlich und sollten zum Schema hinzugefügt werden:
- `type` für Requirements (Functional/Non-Functional)
- `estimatedHours` für Tasks
- `sourceIdeaId` für Requirements (Traceability)

### Phase 5: Skala-Werte korrigieren (JTBD)

| Datei | Feld | Alt | Neu |
|-------|------|-----|-----|
| Track progress | importance | 8 | 5 (Maximum) |
| Track changes | importance | 9 | 5 (Maximum) |

---

## 7. Empfohlene Schema-Erweiterungen

Basierend auf den erstellten Dateien sollten folgende Felder zum Schema hinzugefügt werden:

### RequirementSchema Erweiterungen

```typescript
// Vorschlag für types.ts
export const REQUIREMENT_TYPES = ["Functional", "Non-Functional", "Constraint"] as const;

export const RequirementFrontmatterSchema = z.object({
  // ... existing fields
  type: z.enum(REQUIREMENT_TYPES).optional(),
  sourceIdeaId: UUIDSchema.optional(),  // Alternative: linkedIdeas nutzen
});
```

### TaskSchema Erweiterungen

```typescript
export const TASK_TYPES = ["Development", "Testing", "Documentation", "Research"] as const;

export const TaskFrontmatterSchema = z.object({
  // ... existing fields
  type: z.enum(TASK_TYPES).optional(),
  estimatedHours: z.number().positive().optional(),
});
```

---

## 8. Test-Strategie für Datenvalidierung

### Unit Tests für Parser

```typescript
// tests/requirements/RequirementService.parse.test.ts
describe("RequirementService.parseFromMarkdown", () => {
  it("should reject non-UUID id", () => {
    const content = `---
id: "req-001-invalid"
status: "Proposed"
...
---`;
    expect(() => service.parseFromMarkdown(content)).toThrow();
  });

  it("should reject invalid priority enum", () => {
    const content = `---
priority: "Must Have"
...
---`;
    expect(() => service.parseFromMarkdown(content)).toThrow();
  });

  it("should ignore unknown fields", () => {
    const content = `---
id: "valid-uuid"
unknownField: "value"
...
---`;
    const result = service.parseFromMarkdown(content);
    expect(result.unknownField).toBeUndefined();
  });
});
```

### Integration Tests mit Obsidian Mock

```typescript
// tests/integration/EntityLoading.test.ts
describe("Entity Loading Integration", () => {
  it("should load all valid entities from Solutions folder", async () => {
    const requirements = await requirementService.listBySolution(solutionId);
    expect(requirements.length).toBeGreaterThan(0);
    requirements.forEach(req => {
      expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(REQUIREMENT_STATUSES).toContain(req.status);
      expect(PRIORITIES).toContain(req.priority);
    });
  });
});
```

### Validation Script (CLI)

```typescript
// scripts/validate-solution.ts
async function validateSolution(solutionPath: string) {
  const errors: ValidationError[] = [];

  // Validate all entity files
  for (const file of await glob(`${solutionPath}/**/*.md`)) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const entityType = detectEntityType(file);
      const schema = getSchemaForType(entityType);
      schema.parse(parseFrontmatter(content));
    } catch (e) {
      errors.push({ file, error: e.message });
    }
  }

  return errors;
}
```

---

## 9. Nächste Schritte

1. **Sofort**: Alle IDs auf UUID v4 ändern
2. **Sofort**: Priority-Werte korrigieren (Must Have → High)
3. **Sofort**: Feldnamen korrigieren (featureId → linkedFeatures)
4. **Kurzfristig**: Schema-Erweiterungen implementieren (type, estimatedHours)
5. **Kurzfristig**: Validation-Script erstellen
6. **Mittelfristig**: Integration Tests für Entity-Loading

---

## 10. Zusammenfassung

**Kritische Probleme:**
- 22 von 26 Dateien haben ungültige IDs (nicht UUID v4)
- 6 Requirements haben ungültige Priority-Werte
- 16 Dateien verwenden falsche Feldnamen für Verknüpfungen

**Geschätzte Korrekturzeit:** 1-2 Stunden für manuelle Korrekturen

**Empfehlung:** Vor manueller Korrektur die Schema-Erweiterungen implementieren, um die zusätzlichen Felder (type, estimatedHours) nicht zu verlieren.

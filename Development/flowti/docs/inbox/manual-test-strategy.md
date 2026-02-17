---
type: reference
stage: archived
description: "Manual test strategy and test plan for Flowti plugin (German). Covers all modules, error handling, traceability, performance."
tags:
  - reference
  - testing
---

# Flowti Manual Test Strategy & Test Plan

## Übersicht

Dieses Dokument beschreibt die Teststrategie und den detaillierten Testplan für manuelle Tests der Flowti Obsidian Plugin Applikation. Es fokussiert auf Aspekte, die nicht durch Unit Tests abgedeckt werden können:

- UI/UX Interaktionen
- Obsidian API Integration
- Dateisystem-Operationen
- End-to-End Workflows
- Event-Propagation
- Visuelle Darstellung

---

## 1. Teststrategie

### 1.1 Testebenen

```
┌─────────────────────────────────────────────────────┐
│                  End-to-End Tests                    │
│         (Komplette User Workflows)                   │
├─────────────────────────────────────────────────────┤
│               Integration Tests                      │
│    (Service + FileSystem + Events + Views)          │
├─────────────────────────────────────────────────────┤
│              Komponenten Tests                       │
│        (Modals, Views, Commands)                    │
├─────────────────────────────────────────────────────┤
│          Unit Tests (automatisiert)                  │
│     (Services, Schemas, Parser)                      │
└─────────────────────────────────────────────────────┘
```

### 1.2 Testumgebung

**Voraussetzungen:**
- Obsidian Desktop (neueste Version)
- Flowti Plugin installiert (Dev-Build)
- Leerer Test-Vault oder dedizierter Test-Ordner
- DevTools Console geöffnet (Strg+Shift+I)

**Setup vor jedem Testlauf:**
1. Test-Vault öffnen oder erstellen
2. Flowti Plugin deaktivieren und reaktivieren
3. Console auf Errors prüfen
4. Bestehende Testdaten löschen (optional)

### 1.3 Testdokumentation

Für jeden Testfall dokumentieren:
- [ ] Testfall-ID
- [ ] Ergebnis: ✅ Pass / ❌ Fail / ⚠️ Partial
- [ ] Gefundene Fehler (mit Screenshot/Console-Log)
- [ ] Tester & Datum

---

## 2. Testplan nach Modulen

### 2.1 Solution Management

#### SOL-001: Solution erstellen
**Vorbedingung:** Keine Solutions vorhanden
**Schritte:**
1. Command Palette öffnen (Strg+P)
2. "Flowti: Create Solution" ausführen
3. Modal ausfüllen:
   - Name: "Test Solution Alpha"
   - Description: "Eine Testlösung"
   - Lifecycle Phase: "Ideate"
4. "Create Solution" klicken

**Erwartetes Ergebnis:**
- [ ] Modal schließt sich
- [ ] Ordner `Solutions/Test Solution Alpha/` erstellt
- [ ] Datei `Solutions/Test Solution Alpha/Test Solution Alpha.md` existiert
- [ ] YAML Frontmatter enthält id, status, currentPhase, createdAt, updatedAt
- [ ] Unterordner erstellt: Ideas/, Requirements/, Features/, Tasks/, JTBD/, ServiceDesign/
- [ ] Console zeigt Event: `solution.created`

#### SOL-002: Solution öffnen
**Vorbedingung:** Mindestens eine Solution existiert
**Schritte:**
1. Command Palette öffnen
2. "Flowti: Open Solution" ausführen
3. Solution aus Dropdown auswählen

**Erwartetes Ergebnis:**
- [ ] SolutionDetailView öffnet sich im rechten Panel
- [ ] Header zeigt Solution Name und Status
- [ ] Guidance Card zeigt phase-spezifische Tipps
- [ ] Primäre Sections für aktuelle Phase werden angezeigt
- [ ] "Erweitert" Section ist collapsed

#### SOL-003: Solution aktualisieren
**Vorbedingung:** Solution ist geöffnet
**Schritte:**
1. Solution Markdown-Datei direkt in Obsidian bearbeiten
2. Description ändern
3. Datei speichern
4. SolutionDetailView refreshen (erneut öffnen)

**Erwartetes Ergebnis:**
- [ ] Änderungen werden in der View angezeigt
- [ ] `updatedAt` Timestamp wird aktualisiert

#### SOL-004: Solution löschen
**Vorbedingung:** Solution mit untergeordneten Entities existiert
**Schritte:**
1. Command Palette öffnen
2. "Flowti: Delete Solution" ausführen
3. Solution auswählen
4. Löschung bestätigen

**Erwartetes Ergebnis:**
- [ ] Bestätigungsdialog erscheint
- [ ] Nach Bestätigung: Gesamter Solution-Ordner wird gelöscht
- [ ] Alle untergeordneten Entities werden mitgelöscht
- [ ] Console zeigt Events: `solution.deleted`, ggf. cascade delete events
- [ ] SolutionDetailView schließt sich oder zeigt "Not Found"

#### SOL-005: Lifecycle Phase ändern
**Vorbedingung:** Solution existiert
**Schritte:**
1. Solution-Markdown öffnen
2. `currentPhase` im Frontmatter ändern (z.B. "Ideate" → "Design")
3. Speichern
4. SolutionDetailView öffnen

**Erwartetes Ergebnis:**
- [ ] Guidance Card zeigt neue Phase
- [ ] Primäre Sections wechseln entsprechend der Phase
- [ ] Quick Actions sind phase-spezifisch

---

### 2.2 Ideas Management

#### IDEA-001: Idea erstellen (aus Command)
**Vorbedingung:** Mindestens eine Solution existiert
**Schritte:**
1. Command: "Flowti: Create Idea"
2. Solution auswählen
3. Felder ausfüllen:
   - Title: "Automatische Synchronisation"
   - Description: "Cloud-Sync Feature"
   - Rationale: "Benutzer wollen überall Zugriff"
4. "Create Idea" klicken

**Erwartetes Ergebnis:**
- [ ] Datei erstellt: `Solutions/{Solution}/Ideas/Automatische Synchronisation.md`
- [ ] Frontmatter enthält id, status: "New", solutionId, createdAt
- [ ] Console zeigt: `idea.created`

#### IDEA-002: Idea erstellen (aus SolutionDetailView)
**Vorbedingung:** Solution geöffnet in SolutionDetailView
**Schritte:**
1. In Ideas Section auf "+" Button klicken
2. Modal ausfüllen und bestätigen

**Erwartetes Ergebnis:**
- [ ] Modal öffnet sich mit vorausgewählter Solution
- [ ] Nach Erstellung erscheint Idea in der Liste
- [ ] View aktualisiert sich automatisch

#### IDEA-003: Idea Status ändern
**Vorbedingung:** Idea existiert
**Schritte:**
1. Idea-Markdown öffnen
2. Status ändern: "New" → "UnderReview" → "Accepted" → "Implemented"
3. Speichern

**Erwartetes Ergebnis:**
- [ ] Status-Badge in SolutionDetailView aktualisiert sich
- [ ] Console zeigt: `idea.updated`

#### IDEA-004: Idea zu Requirement konvertieren
**Vorbedingung:** Idea mit Status "Accepted" existiert
**Schritte:**
1. Command: "Flowti: Convert Idea to Requirement"
2. Idea auswählen

**Erwartetes Ergebnis:**
- [ ] Neues Requirement wird erstellt
- [ ] Requirement enthält `sourceIdeaId` Referenz
- [ ] Idea Status wechselt zu "Implemented"

---

### 2.3 Requirements Management

#### REQ-001: Requirement erstellen
**Schritte:**
1. Command: "Flowti: Create Requirement"
2. Ausfüllen:
   - Title: "Benutzer-Authentifizierung"
   - Description: "System muss Benutzer authentifizieren können"
   - Type: "Functional"
   - Priority: "Must Have"

**Erwartetes Ergebnis:**
- [ ] Datei in `Solutions/{Solution}/Requirements/` erstellt
- [ ] Type und Priority korrekt gespeichert

#### REQ-002: Requirement mit Acceptance Criteria
**Schritte:**
1. Requirement-Markdown bearbeiten
2. Acceptance Criteria Section hinzufügen:
```markdown
## Acceptance Criteria
- [ ] Login mit Email/Password möglich
- [ ] Session-Timeout nach 30 Minuten
- [ ] Logout-Button sichtbar
```

**Erwartetes Ergebnis:**
- [ ] Criteria werden beim Laden geparst
- [ ] In SolutionDetailView als Checklist angezeigt

---

### 2.4 Features Management

#### FEAT-001: Feature erstellen
**Schritte:**
1. Command: "Flowti: Create Feature"
2. Ausfüllen und verknüpfen mit Requirement

**Erwartetes Ergebnis:**
- [ ] Feature-Datei erstellt
- [ ] `requirementId` Referenz gespeichert
- [ ] Traceability: Feature → Requirement nachvollziehbar

#### FEAT-002: Feature Tasks anzeigen
**Vorbedingung:** Feature mit zugeordneten Tasks existiert
**Schritte:**
1. Feature in SolutionDetailView öffnen

**Erwartetes Ergebnis:**
- [ ] Verknüpfte Tasks werden aufgelistet
- [ ] Task-Status wird angezeigt

---

### 2.5 Tasks Management

#### TASK-001: Task erstellen
**Schritte:**
1. Command: "Flowti: Create Task"
2. Ausfüllen:
   - Title: "Login UI implementieren"
   - Type: "Development"
   - Priority: "High"
   - Optional: Feature verknüpfen

**Erwartetes Ergebnis:**
- [ ] Task-Datei erstellt
- [ ] In SolutionDetailView unter Tasks sichtbar

#### TASK-002: Task Status Workflow
**Schritte:**
1. Task öffnen
2. Status durchlaufen: "Todo" → "InProgress" → "Done"

**Erwartetes Ergebnis:**
- [ ] Jeder Status-Wechsel wird gespeichert
- [ ] updatedAt aktualisiert sich
- [ ] Console zeigt: `task.updated`

#### TASK-003: Task mit Subtasks
**Schritte:**
1. Task erstellen
2. Im Markdown Subtasks hinzufügen:
```markdown
## Subtasks
- [ ] UI Mockup erstellen
- [ ] API Endpoint definieren
- [x] Datenbank-Schema entwerfen
```

**Erwartetes Ergebnis:**
- [ ] Subtasks werden geparst
- [ ] Progress wird berechnet (1/3 = 33%)

---

### 2.6 Jobs-to-be-Done (JTBD)

#### JTBD-001: Job erstellen
**Schritte:**
1. Command: "Flowti: Create Job"
2. Ausfüllen:
   - Statement: "Wenn ich unterwegs bin, möchte ich meine Notizen synchronisieren, damit ich immer Zugriff habe."
   - Outcome: "Notizen sind auf allen Geräten verfügbar"
   - Priority: "High"

**Erwartetes Ergebnis:**
- [ ] Job-Datei im JTBD/ Ordner erstellt
- [ ] Statement korrekt formatiert

#### JTBD-002: Job mit verknüpften Ideas
**Vorbedingung:** Job und Ideas existieren
**Schritte:**
1. Job öffnen
2. `linkedIdeaIds` im Frontmatter hinzufügen

**Erwartetes Ergebnis:**
- [ ] Verknüpfung wird beim Laden erkannt
- [ ] Traceability: Job → Ideas → Requirements → Features

---

### 2.7 Service Design Module

#### SD-BP-001: Service Blueprint erstellen
**Schritte:**
1. SolutionDetailView öffnen
2. "Erweitert" Section expandieren
3. Bei "Service Blueprints" auf "+" klicken
4. Ausfüllen:
   - Title: "Kundenonboarding"
   - Description: "Onboarding-Prozess für Neukunden"
   - Channels: "Web, Mobile, Email"
5. "Create Blueprint" klicken

**Erwartetes Ergebnis:**
- [ ] Datei erstellt: `ServiceDesign/Blueprints/Kundenonboarding.md`
- [ ] Channels als Array gespeichert
- [ ] Status: "Draft"
- [ ] In SolutionDetailView unter Service Design sichtbar

#### SD-BP-002: Blueprint ohne Solutions
**Vorbedingung:** Alle Solutions löschen
**Schritte:**
1. Versuche Blueprint zu erstellen

**Erwartetes Ergebnis:**
- [ ] Modal zeigt "No solutions found" Message
- [ ] Nur "Close" Button verfügbar
- [ ] Kein Crash

#### SD-BP-003: Blueprint mit Actors und Touchpoints
**Schritte:**
1. Blueprint-Markdown bearbeiten
2. Sections hinzufügen:
```markdown
## Actors
### Customer
- Type: Customer
- Description: Neuer Benutzer

### Support Agent
- Type: Employee
- Description: Kundensupport

## Touchpoints
### Website Registration
- Channel: Web
- Actor: Customer
```

**Erwartetes Ergebnis:**
- [ ] Actors werden geparst
- [ ] Touchpoints werden geparst
- [ ] Actor-Referenzen sind korrekt

#### SD-CJ-001: Customer Journey erstellen
**Schritte:**
1. "+" bei Customer Journeys klicken
2. Ausfüllen:
   - Title: "Erstkauf-Journey"
   - Persona: "Neukunde"
   - Optional: Linked Blueprint auswählen

**Erwartetes Ergebnis:**
- [ ] Journey-Datei erstellt
- [ ] Persona gespeichert
- [ ] Blueprint-Verknüpfung funktioniert

#### SD-CJ-002: Journey ohne Persona (Validation)
**Schritte:**
1. Journey-Modal öffnen
2. Title eingeben, Persona leer lassen
3. "Create Journey" klicken

**Erwartetes Ergebnis:**
- [ ] Inline-Fehlermeldung: "Please enter a persona"
- [ ] Modal bleibt offen
- [ ] Kein Crash

#### SD-ER-001: Entity-Relation Map erstellen
**Schritte:**
1. "+" bei Entity Relations klicken
2. Ausfüllen:
   - Title: "Domain Model"
   - "Use Template" aktivieren
3. Erstellen

**Erwartetes Ergebnis:**
- [ ] Datei mit Mermaid ER-Diagramm erstellt
- [ ] Template-Diagramm eingefügt
- [ ] Mermaid-Code wird in Obsidian gerendert

#### SD-ER-002: Entity-Relation Map mit Entities
**Schritte:**
1. ER Map erstellen
2. Entities Section hinzufügen:
```markdown
## Entities
### Customer
| Attribute | Type | Key |
|-----------|------|-----|
| id | string | PK |
| name | string | |
| email | string | |

### Order
| Attribute | Type | Key |
|-----------|------|-----|
| id | string | PK |
| customerId | string | FK |
```

**Erwartetes Ergebnis:**
- [ ] Entities werden korrekt geparst
- [ ] Attribute mit Types erkannt
- [ ] PK/FK Markierungen erkannt

#### SD-SL-001: System Landscape erstellen
**Schritte:**
1. "+" bei System Landscapes klicken
2. Mit Template erstellen

**Erwartetes Ergebnis:**
- [ ] Mermaid Flowchart-Diagramm erstellt
- [ ] Systeme und Interfaces im Template

#### SD-SL-002: System Landscape mit Systems
**Schritte:**
1. System Landscape bearbeiten:
```markdown
## Systems
### API Gateway
- Type: Internal
- Technology: Node.js
- Description: Zentrale API

### Auth0
- Type: ThirdParty
- Description: Authentication Provider

## Interfaces
| From | To | Protocol | Data Flow |
|------|-----|----------|-----------|
| API Gateway | Auth0 | OAuth 2.0 | Auth tokens |
```

**Erwartetes Ergebnis:**
- [ ] Systems werden geparst
- [ ] Type, Technology, Description erkannt
- [ ] Interfaces-Tabelle geparst

---

### 2.8 SolutionDetailView UX

#### VIEW-001: Guidance Card
**Schritte:**
1. Solution in verschiedenen Phasen öffnen (Ideate, Design, Develop, etc.)

**Erwartetes Ergebnis:**
- [ ] Guidance Card zeigt phase-spezifischen Icon
- [ ] Titel entspricht Phase
- [ ] Beschreibung gibt hilfreiche Tipps
- [ ] "Nächster Schritt" Button vorhanden

#### VIEW-002: Phase-spezifische Sections
**Schritte:**
1. Solution mit Phase "Ideate" öffnen
2. Phase zu "Design" ändern
3. View refreshen

**Erwartetes Ergebnis:**
- [ ] Ideate: Jobs + Ideas prominent
- [ ] Design: Requirements + Features prominent
- [ ] Develop: Tasks + Features prominent

#### VIEW-003: Empty States mit Tips
**Vorbedingung:** Solution ohne Entities
**Schritte:**
1. Leere Solution öffnen
2. Jede Section prüfen

**Erwartetes Ergebnis:**
- [ ] Jede leere Section zeigt hilfreichen Tipp
- [ ] "Ersten X erstellen" Button vorhanden
- [ ] Tip erklärt was die Entity ist

#### VIEW-004: Quick Actions
**Schritte:**
1. Solution öffnen
2. In jeder Section den "+" Button nutzen

**Erwartetes Ergebnis:**
- [ ] Button öffnet korrektes Modal
- [ ] Solution ist vorausgewählt
- [ ] Nach Erstellung: Liste aktualisiert sich

#### VIEW-005: Erweitert Section (Collapse/Expand)
**Schritte:**
1. Solution öffnen
2. "Erweitert" Header anklicken
3. Erneut anklicken

**Erwartetes Ergebnis:**
- [ ] Initial: Section ist collapsed (Pfeil nach rechts)
- [ ] Nach Klick: Section expandiert (Pfeil nach unten)
- [ ] Service Design Sections werden sichtbar
- [ ] Erneuter Klick: Section collapsed wieder

---

### 2.9 Event System

#### EVT-001: Event Propagation
**Vorbedingung:** DevTools Console offen
**Schritte:**
1. Verschiedene Entities erstellen, ändern, löschen

**Erwartetes Ergebnis:**
Folgende Events in Console sichtbar:
- [ ] `solution.created`, `solution.updated`, `solution.deleted`
- [ ] `idea.created`, `idea.updated`, `idea.deleted`
- [ ] `requirement.created`, `requirement.updated`, `requirement.deleted`
- [ ] `feature.created`, `feature.updated`, `feature.deleted`
- [ ] `task.created`, `task.updated`, `task.deleted`
- [ ] `job.created`, `job.updated`, `job.deleted`
- [ ] `serviceBlueprint.created`, `serviceBlueprint.updated`, `serviceBlueprint.deleted`
- [ ] `customerJourney.created`, `customerJourney.updated`, `customerJourney.deleted`
- [ ] `entityRelationMap.created`, `entityRelationMap.updated`, `entityRelationMap.deleted`
- [ ] `systemLandscape.created`, `systemLandscape.updated`, `systemLandscape.deleted`

#### EVT-002: Event Payload
**Schritte:**
1. Entity erstellen
2. Console-Log des Events inspizieren

**Erwartetes Ergebnis:**
- [ ] Payload enthält vollständiges Entity-Objekt
- [ ] Alle Felder korrekt befüllt

---

### 2.10 Fehlerbehandlung

#### ERR-001: Modal Validation Errors
**Schritte:**
1. Jedes Modal öffnen
2. Pflichtfelder leer lassen
3. Erstellen versuchen

**Erwartetes Ergebnis:**
- [ ] Inline-Fehlermeldung erscheint
- [ ] Fehlermeldung ist vor den Buttons positioniert
- [ ] Modal bleibt offen
- [ ] Kein Crash, keine Console-Errors

#### ERR-002: Service Errors
**Schritte:**
1. Datei manuell mit ungültigem YAML erstellen
2. Versuchen diese zu laden

**Erwartetes Ergebnis:**
- [ ] Fehler wird geloggt
- [ ] App crasht nicht
- [ ] Benutzer erhält Fehlermeldung

#### ERR-003: Datei nicht gefunden
**Schritte:**
1. Entity-Datei extern löschen (nicht über Flowti)
2. Versuchen diese Entity zu öffnen/laden

**Erwartetes Ergebnis:**
- [ ] Graceful handling
- [ ] "Not found" Meldung oder Entity wird aus Liste entfernt

---

### 2.11 Dateisystem-Konsistenz

#### FS-001: Ordnerstruktur
**Schritte:**
1. Neue Solution erstellen
2. Dateisystem im Explorer prüfen

**Erwartetes Ergebnis:**
Struktur:
```
Solutions/{SolutionName}/
├── {SolutionName}.md
├── Ideas/
├── Requirements/
├── Features/
├── Tasks/
├── JTBD/
└── ServiceDesign/
    ├── Blueprints/
    ├── Journeys/
    ├── EntityRelations/
    └── SystemLandscapes/
```

#### FS-002: Datei-Benennung
**Schritte:**
1. Entity mit Sonderzeichen im Namen erstellen
   - "Test: Feature #1"
   - "Idee für 50% Rabatt"

**Erwartetes Ergebnis:**
- [ ] Dateiname wird sanitized
- [ ] Ungültige Zeichen werden ersetzt
- [ ] Markdown-Datei ist valide

#### FS-003: Duplikate verhindern
**Schritte:**
1. Entity erstellen
2. Entity mit gleichem Namen erstellen

**Erwartetes Ergebnis:**
- [ ] Fehlermeldung oder automatische Umbenennung
- [ ] Keine Überschreibung ohne Warnung

---

### 2.12 Cross-Module Traceability

#### TRACE-001: Vollständige Kette
**Schritte:**
1. Job erstellen
2. Idea erstellen und mit Job verknüpfen
3. Idea zu Requirement konvertieren
4. Feature erstellen und mit Requirement verknüpfen
5. Task erstellen und mit Feature verknüpfen

**Erwartetes Ergebnis:**
Traceability-Kette:
```
Job → Idea → Requirement → Feature → Task
```
- [ ] Alle Referenzen sind korrekt gespeichert
- [ ] Rückverfolgung möglich

#### TRACE-002: Verknüpfungen in UI
**Vorbedingung:** Kette aus TRACE-001
**Schritte:**
1. Jede Entity in SolutionDetailView prüfen

**Erwartetes Ergebnis:**
- [ ] Verknüpfte Entities werden angezeigt
- [ ] Links/Referenzen sind klickbar (falls implementiert)

---

## 3. Regressionstests

Nach jeder Code-Änderung folgende Quick-Tests durchführen:

### 3.1 Smoke Test Checklist
- [ ] Plugin lädt ohne Console-Errors
- [ ] Alle Commands sind verfügbar
- [ ] Solution erstellen funktioniert
- [ ] Entity erstellen funktioniert (je ein Typ)
- [ ] SolutionDetailView öffnet sich
- [ ] Events werden gefeuert

### 3.2 Critical Path Tests
1. [ ] SOL-001: Solution erstellen
2. [ ] SOL-002: Solution öffnen
3. [ ] IDEA-001: Idea erstellen
4. [ ] REQ-001: Requirement erstellen
5. [ ] TASK-001: Task erstellen
6. [ ] SD-BP-001: Service Blueprint erstellen

---

## 4. Performance Tests

#### PERF-001: Viele Entities
**Schritte:**
1. Solution mit 50+ Ideas erstellen
2. Solution mit 100+ Tasks erstellen
3. SolutionDetailView öffnen

**Erwartetes Ergebnis:**
- [ ] View öffnet sich in < 2 Sekunden
- [ ] Kein Freezing beim Scrollen
- [ ] Memory-Verbrauch stabil

#### PERF-002: Große Markdown-Dateien
**Schritte:**
1. Entity mit sehr langem Content erstellen (10.000+ Zeichen)
2. Entity laden und speichern

**Erwartetes Ergebnis:**
- [ ] Laden funktioniert
- [ ] Speichern funktioniert
- [ ] Keine Truncation

---

## 5. Accessibility Tests

#### A11Y-001: Keyboard Navigation
**Schritte:**
1. Modals nur mit Tastatur bedienen (Tab, Enter, Escape)

**Erwartetes Ergebnis:**
- [ ] Alle Felder erreichbar per Tab
- [ ] Enter auf Primary Button funktioniert
- [ ] Escape schließt Modal

#### A11Y-002: Focus Management
**Schritte:**
1. Modal öffnen
2. Focus-Position prüfen

**Erwartetes Ergebnis:**
- [ ] Erstes Eingabefeld hat initialen Focus
- [ ] Nach Schließen: Focus zurück auf Trigger-Element

---

## 6. Testprotokoll-Template

```markdown
# Testprotokoll

**Datum:** YYYY-MM-DD
**Tester:** Name
**Version:** v1.x.x
**Obsidian Version:** x.x.x

## Durchgeführte Tests

| Test-ID | Ergebnis | Bemerkungen |
|---------|----------|-------------|
| SOL-001 | ✅ Pass | |
| SOL-002 | ❌ Fail | Button nicht sichtbar |
| ... | | |

## Gefundene Fehler

### BUG-001: [Titel]
- **Schwere:** Critical / Major / Minor
- **Test-ID:** SOL-002
- **Beschreibung:** ...
- **Reproduktion:** ...
- **Screenshot:** ...

## Zusammenfassung
- Getestet: X Tests
- Bestanden: Y Tests
- Fehlgeschlagen: Z Tests
- Blockiert: N Tests
```

---

## 7. Testdaten

### Beispieldaten für Tests

**Solution:**
```yaml
name: "E-Commerce Platform"
description: "Online-Shop für Handwerksprodukte"
currentPhase: "Design"
```

**Idea:**
```yaml
title: "Produktvergleich"
description: "Kunden sollen Produkte vergleichen können"
rationale: "Erhöht Conversion Rate"
status: "New"
```

**Requirement:**
```yaml
title: "Produktvergleich-Funktion"
type: "Functional"
priority: "Should Have"
acceptanceCriteria:
  - "Maximal 4 Produkte gleichzeitig"
  - "Vergleich nach Preis, Eigenschaften"
```

**Task:**
```yaml
title: "Vergleichs-UI implementieren"
type: "Development"
priority: "Medium"
status: "Todo"
```

---

## 8. Anhang

### A. Command-Liste zum Testen

| Command | Beschreibung |
|---------|--------------|
| `flowti:create-solution` | Solution erstellen |
| `flowti:open-solution` | Solution öffnen |
| `flowti:delete-solution` | Solution löschen |
| `flowti:add-idea` | Idea erstellen |
| `flowti:add-requirement` | Requirement erstellen |
| `flowti:add-feature` | Feature erstellen |
| `flowti:add-task` | Task erstellen |
| `flowti:add-job` | Job erstellen |
| `flowti:add-service-blueprint` | Service Blueprint erstellen |
| `flowti:add-customer-journey` | Customer Journey erstellen |
| `flowti:add-entity-relation` | Entity-Relation Map erstellen |
| `flowti:add-system-landscape` | System Landscape erstellen |

### B. Bekannte Limitierungen

1. Mermaid-Diagramme werden nur in der Obsidian-Vorschau gerendert, nicht in der SolutionDetailView
2. Keine Echtzeit-Synchronisation zwischen Markdown-Bearbeitung und SolutionDetailView
3. Drag & Drop für Entities nicht implementiert

### C. Test-Environment Setup Script

```bash
# Erstellt einen frischen Test-Vault
mkdir -p TestVault/.obsidian/plugins/flowti
cp -r dist/* TestVault/.obsidian/plugins/flowti/
```

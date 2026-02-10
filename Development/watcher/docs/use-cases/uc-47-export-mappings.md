# UC-47: Export Mappings to JSON

**Feature:** [Export / Import Mappings](../features/feature-11-export-import.md)

> As a user, I want to export my folder mappings to a JSON file so I can share them with others.

## Scenario 47.1: Serialize mappings to portable JSON ✅

```gherkin
Given the user has one or more folder mappings configured
When the export is triggered
Then a JSON string is produced with version, exportedAt, pluginVersion, and mappings
  And each mapping has sourceFolder cleared to ""
  And each mapping has enabled set to false
  And all other properties (targetFolder, description, fileExtensions, etc.) are preserved
```

## Scenario 47.2: Handle multiple mappings ✅

```gherkin
Given the user has 3 folder mappings
When the export is triggered
Then the JSON contains all 3 mappings
```

## Scenario 47.3: Handle empty mappings ✅

```gherkin
Given the user has no folder mappings
When the export is triggered
Then the result contains an empty mappings array
```

## Scenario 47.4: Save via native dialog ✅

```gherkin
Given the user clicks "Export" in settings or runs the command
When the native save dialog opens
  And the user picks a location and filename
Then the JSON file is written to that path
  And a success notice shows the file path and mapping count
```

## Test Coverage

| # | Scenario | Test | Status |
|---|----------|------|--------|
| 47.1a | Produces valid JSON with version, date, mappings | `serializeMappings` > should produce valid JSON | ✅ |
| 47.1b | Clears sourceFolder | `serializeMappings` > should clear sourceFolder | ✅ |
| 47.1c | Sets enabled=false | `serializeMappings` > should set enabled=false | ✅ |
| 47.1d | Preserves other properties | `serializeMappings` > should preserve other mapping properties | ✅ |
| 47.2 | Multiple mappings | `serializeMappings` > should handle multiple mappings | ✅ |
| 47.3 | Empty mappings | `serializeMappings` > should handle empty mappings array | ✅ |
| 47.4 | Save dialog + write | Manual / Electron integration | ✅ |
| RT.1 | Round-trip preserves data | `round-trip` > should preserve mapping data | ✅ |
| RT.2 | Round-trip produces importable mappings | `round-trip` > should produce importable mappings | ✅ |
| INT.1 | Full export flow | `Export flow` > serialize and deserialize producing equivalent | ✅ |
| INT.2 | Full vault-to-vault scenario | `Full round-trip scenario` | ✅ |

**14 tests total** (9 unit in `MappingExportService.test.ts` + 2 round-trip + 3 integration in `MappingExportImport.test.ts`)

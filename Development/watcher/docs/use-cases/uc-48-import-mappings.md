# UC-48: Import Mappings from JSON

**Feature:** [Export / Import Mappings](../features/feature-11-export-import.md)

> As a user, I want to import folder mappings from a shared JSON file so I can set up my vault without manual configuration.

## Scenario 48.1: Deserialize valid export data ✅

```gherkin
Given a valid JSON export file with version 1 and a mappings array
When the file is parsed
Then all mappings are returned with no errors
  And missing optional fields are filled with defaults from DEFAULT_MAPPING_VALUES
```

## Scenario 48.2: Reject invalid input ✅

```gherkin
Given the import file contains invalid JSON, a non-object, or unsupported version
When parsing is attempted
Then an error array is returned describing the problem
  And the mappings array is empty
```

## Scenario 48.3: Validate individual mappings ✅

```gherkin
Given a valid JSON file with some mappings missing targetFolder or containing non-object entries
When the file is parsed
Then valid mappings are returned
  And per-mapping errors are reported for invalid entries
```

## Scenario 48.4: Fill defaults for missing optional fields ✅

```gherkin
Given a mapping with only targetFolder specified
When it is deserialized
Then all optional fields are filled from DEFAULT_MAPPING_VALUES
  And enabled defaults to false
  And sourceFolder defaults to ""
```

## Scenario 48.5: Preserve valid field values ✅

```gherkin
Given a mapping with custom values for conflictResolution, syncDirection, fileExtensions, etc.
When it is deserialized
Then all custom values are preserved exactly as specified
```

## Scenario 48.6: Handle invalid enum values ✅

```gherkin
Given a mapping with an invalid conflictResolution or syncDirection value
When it is deserialized
Then the invalid values are replaced with defaults (keepNewer, source-only)
```

## Scenario 48.7: Filter non-string array entries ✅

```gherkin
Given a mapping with mixed-type fileExtensions or excludePatterns arrays
When it is deserialized
Then only string entries are kept, non-strings are filtered out
```

## Scenario 48.8: Assign fresh UUIDs on import ✅

```gherkin
Given imported mappings with existing IDs
When prepareMappingsForImport runs
Then each mapping receives a new UUID different from the original
```

## Scenario 48.9: Disable imported mappings ✅

```gherkin
Given imported mappings with enabled=true
When prepareMappingsForImport runs
Then all imported mappings have enabled=false
```

## Scenario 48.10: Skip overlapping target folders ✅

```gherkin
Given existing mappings with targetFolder "imported/docs"
When importing a mapping with the same targetFolder
Then the imported mapping is skipped
  And a warning mentions the overlap
```

## Scenario 48.11: Skip nested/parent target folder overlaps ✅

```gherkin
Given existing mappings with targetFolder "imported"
When importing a mapping with targetFolder "imported/sub"
Then the imported mapping is skipped (nested overlap)

Given existing mappings with targetFolder "imported/docs/sub"
When importing a mapping with targetFolder "imported/docs"
Then the imported mapping is skipped (parent overlap)
```

## Scenario 48.12: Allow non-overlapping targets ✅

```gherkin
Given existing mappings with targetFolder "imported/docs"
When importing a mapping with targetFolder "imported/photos"
Then the mapping is imported successfully with no warnings
```

## Scenario 48.13: Detect duplicates within import batch ✅

```gherkin
Given an import file with two mappings sharing the same targetFolder
When prepareMappingsForImport runs
Then only the first is imported
  And the duplicate receives a warning
```

## Scenario 48.14: Handle empty import gracefully ✅

```gherkin
Given an export file with an empty mappings array
When the file is imported
Then no mappings are added and no errors are shown
```

## Scenario 48.15: Import via native file picker ✅

```gherkin
Given the user clicks "Import" in settings or runs the command
When the native file picker opens and the user selects a .json file
Then the file is read, parsed, and validated
  And valid mappings are appended to settings
  And the settings UI refreshes to show the new mappings
  And a success notice shows the import count
```

## Test Coverage

| # | Scenario | Test | Status |
|---|----------|------|--------|
| 48.1 | Parse valid export | `deserializeMappings` > should parse valid export data | ✅ |
| 48.2a | Reject invalid JSON | `deserializeMappings` > should reject invalid JSON | ✅ |
| 48.2b | Reject non-object | `deserializeMappings` > should reject non-object JSON | ✅ |
| 48.2c | Reject missing version | `deserializeMappings` > should reject missing version | ✅ |
| 48.2d | Reject unsupported version | `deserializeMappings` > should reject unsupported version | ✅ |
| 48.2e | Reject missing mappings array | `deserializeMappings` > should reject missing mappings | ✅ |
| 48.3 | Skip non-object entries | `deserializeMappings` > should skip non-object entries | ✅ |
| 48.3b | Report missing targetFolder | `deserializeMappings` > should report error for missing targetFolder | ✅ |
| 48.4 | Fill defaults | `deserializeMappings` > should fill missing optional fields | ✅ |
| 48.5 | Preserve values | `deserializeMappings` > should preserve valid field values | ✅ |
| 48.6 | Handle invalid enums | `deserializeMappings` > should handle invalid enum values | ✅ |
| 48.7 | Filter array entries | `deserializeMappings` > should filter non-string entries | ✅ |
| 48.8 | Fresh UUIDs | `prepareMappingsForImport` > should assign new UUIDs | ✅ |
| 48.9 | Disable on import | `prepareMappingsForImport` > should set to disabled | ✅ |
| 48.10 | Skip exact overlap | `prepareMappingsForImport` > should skip overlapping targets | ✅ |
| 48.11a | Skip nested overlap | `prepareMappingsForImport` > should skip nested overlaps | ✅ |
| 48.11b | Skip parent overlap | `prepareMappingsForImport` > should skip parent overlaps | ✅ |
| 48.12 | Allow non-overlapping | `prepareMappingsForImport` > should allow non-overlapping | ✅ |
| 48.13 | Batch duplicates | `prepareMappingsForImport` > should detect batch duplicates | ✅ |
| 48.14 | Empty import | `prepareMappingsForImport` > should handle empty imports | ✅ |
| INT.1 | Import adds with new IDs | `Import flow` > should add with new IDs | ✅ |
| INT.2 | Skip overlapping on import | `Import flow` > should skip overlapping targets | ✅ |

**22 tests total** (20 unit in `MappingExportService.test.ts` + 2 integration in `MappingExportImport.test.ts`)

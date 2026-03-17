# UC-17: Temp File / System File Filtering

**Feature:** [File Filtering](../features/feature-04-file-filtering.md)

> As a user, I do not want temporary or system files to be synced.

## Scenario 17.1: Office lock files are ignored ✅

```gherkin
Given ignoreOneDriveTemp is enabled
When "~$document.docx" is created in the source folder
Then it should NOT be synced
```

## Scenario 17.2: Temporary file extensions are ignored ✅

```gherkin
Given ignoreOneDriveTemp is enabled
When "data.tmp" is created in the source folder
Then it should NOT be synced
  And files with .temp, .swp, .partial, .crdownload extensions should also be ignored
```

## Scenario 17.3: System files are ignored ✅

```gherkin
Given ignoreOneDriveTemp is enabled
When "thumbs.db" or ".DS_Store" or "desktop.ini" appears
Then it should NOT be synced
```

## Scenario 17.4: Partial downloads are ignored ✅

```gherkin
Given ignoreOneDriveTemp is enabled
When "installer.crdownload" or "archive.partial" appears
Then it should NOT be synced
```

## Scenario 17.5: Regular files starting with ~ are NOT filtered if they have an extension ✅

```gherkin
Given ignoreOneDriveTemp is enabled
When "~notes.txt" is created
Then it SHOULD be synced (has an extension, not a bare tilde prefix)
  And only "~filename" without any "." is treated as a generic temp file
```

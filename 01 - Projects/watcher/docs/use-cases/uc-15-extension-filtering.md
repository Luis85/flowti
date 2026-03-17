# UC-15: File Extension Filtering

**Feature:** [File Filtering](../features/feature-04-file-filtering.md)

> As a user, I only want specific file types to be synced.

## Scenario 15.1: Allowed extensions are synced ✅

```gherkin
Given a mapping with fileExtensions [".md", ".txt"]
When "notes.md" is created in the source folder
Then "vault/imported/notes.md" should be synced
```

## Scenario 15.2: Non-matching extensions are ignored ✅

```gherkin
Given a mapping with fileExtensions [".md"]
When "image.png" is created in the source folder
Then "vault/imported/image.png" should NOT be created
```

## Scenario 15.3: Empty extension list means all files allowed ✅

```gherkin
Given a mapping with fileExtensions []
When "anything.xyz" is created in the source folder
Then the file should be synced regardless of extension
```

## Scenario 15.4: Files without extension are rejected when filter is active ✅

```gherkin
Given a mapping with fileExtensions [".md"]
When a file "Makefile" (no extension) is created in the source folder
Then it should NOT be synced
```

## Scenario 15.5: Extension matching is case-insensitive ✅

```gherkin
Given a mapping with fileExtensions [".md"]
When "README.MD" is created in the source folder
Then the file should be synced (case-insensitive match)
```

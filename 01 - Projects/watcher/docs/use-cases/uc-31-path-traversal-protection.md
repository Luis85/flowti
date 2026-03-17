# UC-31: Path Traversal Protection

**Feature:** [Safety & Validation](../features/feature-07-safety.md)

> As a user, I expect the plugin to prevent files from being written outside the designated folders.

## Scenario 31.1: Source path escaping base folder is blocked ✅

*(also tests valid source path does not throw)*

```gherkin
Given a mapping with sourceFolder "/safe/folder"
When a path "/safe/folder/../../etc/passwd" is computed
Then a PathTraversalError should be thrown
  And the file should NOT be written
```

## Scenario 31.2: Target path escaping vault folder is blocked ✅

*(also tests valid target path does not throw + PathTraversalError properties)*

```gherkin
Given a mapping with targetFolder "vault/imported"
When a computed target path resolves to "vault/other/file.md"
Then a PathTraversalError should be thrown
```

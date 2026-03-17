# UC-32: Windows Path Length Validation

**Feature:** [Safety & Validation](../features/feature-07-safety.md)

> As a user on Windows, I want the plugin to warn me when file paths exceed the 260-character MAX_PATH limit.

## Scenario 32.1: Source path exceeding 260 chars is rejected ✅

*(Windows-only, conditional test)*

```gherkin
Given the platform is Windows
  And a source file has a full path of 270 characters
When the path is validated
Then an error should be thrown indicating the path is too long
```

## Scenario 32.2: Target path exceeding 260 chars is rejected ✅

*(Windows-only, conditional test)*

```gherkin
Given the platform is Windows
  And a computed vault target path is 265 characters
When the path is validated
Then an error should be thrown
```

## Scenario 32.3: Paths under 260 chars pass validation ✅

```gherkin
Given a file path of 200 characters
When the path is validated
Then no error should be thrown
```

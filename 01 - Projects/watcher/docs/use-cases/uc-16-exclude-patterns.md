# UC-16: Exclude Patterns

**Feature:** [File Filtering](../features/feature-04-file-filtering.md)

> As a user, I want to exclude specific files or folders from syncing.

## Scenario 16.1: Exact name pattern match ✅

```gherkin
Given a mapping with excludePatterns ["node_modules"]
When a file "node_modules/pkg/index.js" appears in the source
Then it should NOT be synced
```

## Scenario 16.2: Wildcard extension match ✅

```gherkin
Given a mapping with excludePatterns ["*.log"]
When "debug.log" is created in the source folder
Then it should NOT be synced
```

## Scenario 16.3: Double-star glob match ✅

```gherkin
Given a mapping with excludePatterns ["build/**"]
When "build/output/bundle.js" is created
Then it should NOT be synced
```

## Scenario 16.4: Single-char wildcard match ✅

```gherkin
Given a mapping with excludePatterns ["file?.txt"]
When "file1.txt" is created
Then it should NOT be synced
But when "file12.txt" is created
Then it SHOULD be synced (? only matches one character)
```

## Scenario 16.5: Empty or whitespace patterns are ignored ✅

```gherkin
Given a mapping with excludePatterns ["", "  "]
When any file is created in the source
Then it should be synced normally (empty patterns have no effect)
```

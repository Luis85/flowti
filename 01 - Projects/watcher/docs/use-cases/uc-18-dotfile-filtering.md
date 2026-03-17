# UC-18: Dotfile Filtering

**Feature:** [File Filtering](../features/feature-04-file-filtering.md)

> As a user, I do not want hidden files and directories (starting with ".") to be synced, since they are typically configuration or metadata that should stay local.

## Scenario 18.1: Dotfiles in source root are ignored ✅

```gherkin
Given a mapping with any syncDirection
When ".gitignore" or ".env" is created in the source folder
Then it should NOT be synced
```

## Scenario 18.2: Dot-directories and their contents are ignored ✅

```gherkin
Given a mapping with watchSubfolders: true
When files are created inside ".git/", ".obsidian/", or ".vscode/"
Then no files from those directories should be synced
```

## Scenario 18.3: Regular files in regular folders are unaffected ✅

```gherkin
Given a mapping with any syncDirection
When "readme.md" is created in a folder "docs/"
Then it should be synced normally (dotfile filter only applies to names starting with ".")
```

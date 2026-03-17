# UC-35: Overlapping Mapping Validation

**Feature:** [Safety & Validation](../features/feature-07-safety.md)

> As a user, I want to be warned when two mappings target the same vault folder to prevent data conflicts.

## Scenario 35.1: Identical target folders are rejected ⏭️

*Requires FolderMappingModal UI*

```gherkin
Given mapping A targets "vault/imported"
When creating mapping B that also targets "vault/imported"
Then validation should fail with "Target folder overlaps with mapping A"
```

## Scenario 35.2: Nested target folders are rejected ⏭️

*Requires FolderMappingModal UI*

```gherkin
Given mapping A targets "vault/imported"
When creating mapping B that targets "vault/imported/sub"
Then validation should fail (nested target folders conflict)
```

## Scenario 35.3: Non-overlapping target folders are accepted ⏭️

*Requires FolderMappingModal UI*

```gherkin
Given mapping A targets "vault/notes"
When creating mapping B that targets "vault/docs"
Then validation should pass
```

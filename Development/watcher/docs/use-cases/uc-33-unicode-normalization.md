# UC-33: Unicode Path Normalization

**Feature:** [Safety & Validation](../features/feature-07-safety.md)

> As a user working across macOS and Windows, I want paths with accented characters to match correctly regardless of Unicode encoding form.

## Scenario 33.1: NFD path from macOS is normalized to NFC ✅

*(also tests backslash conversion + combined NFD+backslash)*

```gherkin
Given a macOS file system returns "cafe\u0301" (NFD: e + combining accent)
When the path is processed through toVaultPath
Then it should become "café" (NFC: precomposed e-acute)
  And vault path comparisons should match correctly
```

## Scenario 33.2: NFC paths are unchanged ✅

```gherkin
Given a Windows file system returns "café" (already NFC)
When the path is processed through toVaultPath
Then it should remain "café" unchanged
```

---
severity: medium
category: configuration
layer: infrastructure
status: open
effort: small
description: tsconfig.json enables noImplicitAny and strictNullChecks individually instead of using "strict":true. This misses several checks that strict mode enables (strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, noImplicitThis, alwaysStrict, useUnknownInCatchVariables).
---
# TD-19: tsconfig.json not using strict: true

## Problem

Current `tsconfig.json`:
```json
{
    "noImplicitAny": true,
    "strictNullChecks": true
}
```

The `AGENTS.md` states "TypeScript with strict: true" but the actual config only enables two of the strict-family checks.

Missing checks:
- `strictFunctionTypes` — contravariant function parameter checks
- `strictBindCallApply` — correct types for bind/call/apply
- `strictPropertyInitialization` — class properties must be initialized
- `noImplicitThis` — errors on implicit `this` usage
- `alwaysStrict` — emit "use strict" in output
- `useUnknownInCatchVariables` — catch variables typed as `unknown` instead of `any`

## Impact

- Class properties may be used before initialization without error
- Function parameter types are not checked for contravariance
- Catch variables are `any` instead of `unknown`, bypassing type checks

## Suggested Remediation

1. Replace individual flags with `"strict": true`
2. Fix any resulting type errors (likely a few dozen)
3. This is a safe, incremental improvement

## Affected Files

- `tsconfig.json`

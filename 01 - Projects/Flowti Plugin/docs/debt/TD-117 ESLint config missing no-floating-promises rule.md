---
type: TechDebt
severity: medium
category: tooling
layer: cross-cutting
status: resolved
created: 2026-02-20
updated: 2026-02-21
effort: small
resolved_in: "Cycle 10 Inc 3"
description: "ESLint configuration now includes @typescript-eslint/no-floating-promises at warn level with parserOptions.project for type-aware linting. Existing void usages pass; 19 unhandled promises flagged for triage."
---

# TD-117: ESLint config missing `no-floating-promises` rule

## Problem

The ESLint configuration in `eslint.config.mjs` (lines 39-49) has a minimal set of rules:

```javascript
rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
    "@typescript-eslint/ban-ts-comment": "off",
    "no-prototype-builtins": "off",
    "@typescript-eslint/no-empty-function": "off",
},
```

Missing rules that would catch known debt patterns:

| Rule | What it catches | Related TDs |
|------|----------------|-------------|
| `@typescript-eslint/no-floating-promises` | Unhandled promises (void emit, .then without .catch) | TD-105, TD-35 |
| `@typescript-eslint/no-unsafe-argument` | Passing `any` to typed parameters | TD-109 |
| `@typescript-eslint/no-unsafe-member-access` | Accessing properties on `any` values | - |
| `@typescript-eslint/strict-boolean-expressions` | Implicit truthiness checks on nullable types | - |

The `no-floating-promises` rule is the most impactful. Enabling it (even as a warning) would flag the 60+ `void this.eventBus.emit()` call sites and force explicit handling decisions.

## Impact

- New code can introduce unhandled promises without lint feedback.
- The `void` keyword is used as a deliberate opt-out, but without the lint rule, accidental floating promises are indistinguishable from intentional fire-and-forget.
- Combined with [[TD-19 tsconfig not using strict true]], the project misses TypeScript's strongest safety nets.

## Suggested Fix

1. Enable `no-floating-promises` as a warning initially:

```javascript
rules: {
    "@typescript-eslint/no-floating-promises": "warn",
}
```

2. Existing intentional `void` usages will pass (the rule allows `void` as an explicit opt-out).
3. Unintentional floating promises (missing `await` or `void`) will be flagged.
4. Requires `parserOptions.project` to be set for type-aware linting.

## Related

- [[TD-19 tsconfig not using strict true]]
- [[TD-105 void emit fire-and-forget masks handler failures]]

## Affected Files

- `eslint.config.mjs` (lines 39-49)

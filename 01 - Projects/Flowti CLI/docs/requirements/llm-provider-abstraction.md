---
type: Requirement
title: LLM Provider Abstraction — Plug-and-Play CLI Providers
priority: high
source: increment-review
iteration: 5
date: 2026-03-20
status: new
---

# LLM Provider Abstraction

## Summary

The agent shell must support multiple LLM CLI providers (Claude CLI, Cursor CLI) as interchangeable backends with zero service degradation when switching between them.

## Context

Cursor CLI integration is confirmed. The Cursor CLI will be used exactly like the Claude CLI — same invocation pattern, same streaming output expectations. The agent shell must abstract provider-specific details so that:

1. Switching providers is a config change, not a code change
2. No service degradation when using any supported provider
3. Both providers can coexist (different agents may use different providers)

## Acceptance Criteria

- [ ] `AgentAIConfig.provider` supports `"claude"` and `"cursor"` values
- [ ] Agent shell dispatches to the correct CLI based on provider config
- [ ] Streaming output parsing works identically for both providers
- [ ] All existing agent workflows (talk, launch, run-brief) work with either provider
- [ ] Provider switch requires only a config change — no code modifications needed
- [ ] Tests cover both provider paths
- [ ] Graceful error when a configured provider CLI is not installed

## Dependencies

- Agent shell abstraction (`agent-shell.ts` infrastructure module)
- Provider detection (check CLI availability at startup or first use)

## Notes

- Cursor CLI follows the same invocation pattern as Claude CLI
- This aligns with the existing `agent-shell` design (see project memory)
- Must be designed before implementation — needs a Three Amigos or design spec

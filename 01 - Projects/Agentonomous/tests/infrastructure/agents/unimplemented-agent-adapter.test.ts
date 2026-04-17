import { describe, expect, it } from 'vitest';
import {
	UnimplementedAgentAdapter,
	UnimplementedTaskAdapter,
} from '../../../src/infrastructure/agents/unimplemented-agent-adapter.js';
import { isErr } from '../../../src/domain/shared/result.js';

describe('UnimplementedAgentAdapter', () => {
	it('every AgentPort method returns AppError with NOT_IMPLEMENTED code', async () => {
		const a = new UnimplementedAgentAdapter();
		const results = await Promise.all([
			a.list(),
			a.getStatus('id'),
			a.openSession('id'),
			a.getSession('s'),
			a.closeSession('s'),
			a.sendMessage('s', 'hi'),
		]);
		for (const r of results) {
			expect(isErr(r)).toBe(true);
			if (isErr(r)) expect(r.error.code).toBe('AGENT_RUNTIME_NOT_IMPLEMENTED');
		}
	});

	it('subscribeStatus returns a no-op unsubscribe', () => {
		const a = new UnimplementedAgentAdapter();
		const unsub = a.subscribeStatus();
		expect(() => { unsub(); }).not.toThrow();
	});
});

describe('UnimplementedTaskAdapter', () => {
	it('every TaskPort method returns AppError', async () => {
		const t = new UnimplementedTaskAdapter();
		const results = await Promise.all([
			t.enqueue({ agentId: 'a', sessionId: 's', prompt: 'p' }),
			t.getTask('id'),
			t.cancel('id'),
			t.listBySession('s'),
		]);
		for (const r of results) {
			expect(isErr(r)).toBe(true);
		}
	});
});

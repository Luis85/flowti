import type { AgentPort, TaskPort } from '../../domain/agents/agent-port.js';
import { err, type Result } from '../../domain/shared/result.js';
import { appError, type AppError } from '../../domain/shared/app-error.js';

const NOT_IMPLEMENTED = (surface: string): Result<never, AppError> =>
	err(appError({
		code: 'AGENT_RUNTIME_NOT_IMPLEMENTED',
		message: `AgentPort.${surface} is not implemented yet`,
		source: 'agents',
		severity: 'system',
	}));

/**
 * Stub AgentPort that returns `err(NOT_IMPLEMENTED)` for every call.  Lets
 * the plugin boot with the port slot filled while the real runtime is
 * being built — feature modules that reach for `ctx.agents` discover the
 * gap immediately via the error, not via a missing property.
 */
export class UnimplementedAgentAdapter implements AgentPort {
	list(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('list')); }
	getStatus(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('getStatus')); }
	openSession(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('openSession')); }
	getSession(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('getSession')); }
	closeSession(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('closeSession')); }
	sendMessage(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('sendMessage')); }
	subscribeStatus(): () => void { return () => {}; }
}

/** Stub TaskPort mirroring UnimplementedAgentAdapter's behavior. */
export class UnimplementedTaskAdapter implements TaskPort {
	enqueue(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('enqueue')); }
	getTask(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('getTask')); }
	cancel(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('cancel')); }
	subscribe(): () => void { return () => {}; }
	listBySession(): Promise<Result<never, AppError>> { return Promise.resolve(NOT_IMPLEMENTED('listBySession')); }
}

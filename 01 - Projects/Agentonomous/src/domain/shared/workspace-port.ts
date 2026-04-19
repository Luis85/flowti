import type { Result } from './result.js';

export type OpenFileMode = 'current' | 'tab' | 'split';

export interface WorkspacePort {
	openFile(path: string, mode: OpenFileMode): Promise<Result<void, string>>;
}

import type { FileTypeHandler } from './types.js';
import { csvHandler } from './csv-handler.js';
import { jsonHandler } from './json-handler.js';

const handlers = new Map<string, FileTypeHandler>([
	['csv', csvHandler],
	['json', jsonHandler],
]);

export function getHandler(extension: string): FileTypeHandler | undefined {
	return handlers.get(extension);
}

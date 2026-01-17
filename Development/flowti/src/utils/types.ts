/**
 * A UUID v4 string identifier.
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export type UUID = string & { readonly __brand: "UUID" };

/**
 * Interface for data persistence operations.
 * Abstracts storage mechanism for easier testing and flexibility.
 */
export interface IStorageProvider {
	load(): Promise<unknown>;
	save(data: unknown): Promise<void>;
}

import type { Field, TypeSchema } from './type-schema.js';
import type { CorruptTypeRef as _CorruptTypeRef } from './errors.js';

export type TypeName = string;
export type TypeId = string;

export type ReadonlyRecord<K extends string, V> = { readonly [P in K]: V };
export type NonEmptyArray<T> = readonly [T, ...T[]];

export type InstanceRef = {
	readonly typeId: TypeId;
	readonly path: string;
	readonly title: string;     // always the filename stem
	readonly createdAt: string; // ISO
	readonly updatedAt: string; // ISO
};

export type KpiSnapshot = {
	readonly typesCount: number;
	readonly instancesCount: number;
	readonly createdThisWeek: number;
	readonly perType: ReadonlyRecord<TypeId, number>;
	readonly recentlyCreated: readonly InstanceRef[];
};

export type DeleteTypeOptions = {
	readonly alsoDeleteInstances: boolean;
	readonly alsoDeleteBaseFile: boolean;
};

export type FailedDelete = {
	readonly path: string;
	readonly cause: string;
};

export type DeleteTypeReport = {
	readonly instancesDeleted: number;
	readonly instanceFailures: readonly FailedDelete[];
	readonly baseFileDeleted: boolean;
};

export type NewTypeDraft = {
	readonly name: string;
	readonly description?: string;
	readonly instancesFolder: string;
	readonly titleFieldName: string | null;
	readonly fields: readonly Field[];
};

export type TypeSchemaPatch = Partial<Pick<TypeSchema,
	'name' | 'description' | 'instancesFolder' | 'titleFieldName' | 'fields'
>>;

// ===== Chunk 4 additions =====

export type { CorruptTypeRef } from './errors.js';

export type FailedMove = {
	readonly path: string;
	readonly cause: string;
};

export type MoveReport = {
	readonly oldFolder: string;
	readonly newFolder: string;
	readonly movedCount: number;
	readonly failedMoves: readonly FailedMove[];
};

export type BulkDeleteFailure = {
	readonly path:  string;
	readonly error: string;
};

export type BulkDeleteReport = {
	readonly deletedPaths: readonly string[];
	readonly failures:     readonly BulkDeleteFailure[];
};

export type ListTypesResult = {
	readonly types: readonly TypeSchema[];
	readonly issues: readonly _CorruptTypeRef[];
};

export type UpdateTypeResult = {
	readonly schema: TypeSchema;
	readonly moveReport?: MoveReport;
};

export type UpdateTypeOptions = {
	readonly acknowledgeRenames?: boolean;
	readonly moveInstances?: boolean;
};

export type CreateInstanceOptions = {
	readonly overwrite?: boolean;
};

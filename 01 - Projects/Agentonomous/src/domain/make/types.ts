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

export type DeleteTypeReport = {
	readonly instancesDeleted: number;
	readonly baseFileDeleted: boolean;
};

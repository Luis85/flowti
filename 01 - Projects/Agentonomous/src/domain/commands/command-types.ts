export type CommandEntry = {
	readonly id: string;
	readonly name: string;
	readonly callback?: () => void | Promise<void>;
	readonly ribbon?: {
		readonly icon: string;
		readonly title: string;
		readonly visibleByDefault: boolean;
	};
	readonly opensView?: string;
};

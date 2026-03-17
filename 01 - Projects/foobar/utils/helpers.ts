export function safeDispose(...disposables: Array<{ dispose?: () => void } | undefined>) {
	for (const d of disposables) {
		try { d?.dispose?.(); } catch { /* ignore */ }
	}
}

export interface PresetCamera {
	alpha?: number;
	beta?: number;
	radius?: number;
	target?: { x: number; y: number; z: number };
}

export async function runWithConcurrency(
	tasks: readonly (() => void | Promise<void>)[],
	limit: number,
): Promise<void> {
	if (!Number.isFinite(limit)) {
		await Promise.all(tasks.map((t) => Promise.resolve(t())));
		return;
	}
	let index = 0;
	async function next(): Promise<void> {
		while (index < tasks.length) {
			const i = index++;
			await Promise.resolve(tasks[i]?.());
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, tasks.length) }, () => next()),
	);
}

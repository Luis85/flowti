export function slugifyTypeName(name: string): string {
	const normalized = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return normalized === '' ? 'type' : normalized;
}

export function uniqueTypeId(name: string, taken: ReadonlySet<string>): string {
	const base = slugifyTypeName(name);
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}-${i}`)) i += 1;
	return `${base}-${i}`;
}

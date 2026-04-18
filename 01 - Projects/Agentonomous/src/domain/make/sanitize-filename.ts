const HOSTILE_CHARS = /[\/\\:*?"<>|\x00-\x1f]/g;
const WHITESPACE = /\s+/g;

export function sanitizeFilenameStem(raw: string): string {
	let s = raw.replace(HOSTILE_CHARS, '');
	s = s.replace(WHITESPACE, ' ');
	s = s.trim();
	s = s.replace(/\.+$/, '');
	if (s.length > 120) s = s.slice(0, 120).trimEnd();
	return s;
}

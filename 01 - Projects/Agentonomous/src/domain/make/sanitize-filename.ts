const HOSTILE_CHARS = /[\/\\:*?"<>|\x00-\x1f]/g;
const WHITESPACE = /\s+/g;
// Obsidian on Windows rejects files named after reserved DOS device names (with or without an
// extension). We strip the stem here so callers fall back to the empty-name path.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeFilenameStem(raw: string): string {
	let s = raw.replace(HOSTILE_CHARS, '');
	s = s.replace(WHITESPACE, ' ');
	s = s.trim();
	s = s.replace(/\.+$/, '');
	if (s.length > 120) s = s.slice(0, 120).trimEnd();
	if (WINDOWS_RESERVED.test(s)) return '';
	return s;
}

/**
 * Project role profiles as markdown: `type: ProjectRole`, YAML frontmatter + body (description).
 * Lives under `<project>/team/roles/*.md` (vault-relative: `01 - Projects/<name>/team/roles/`).
 */

export const PROJECT_ROLE_NOTE_TYPE = "ProjectRole";

export interface ParsedProjectRole {
	readonly id: string;
	readonly role: string;
	readonly need: string;
	readonly skills: readonly string[];
	/** Short line from frontmatter `description` if set. */
	readonly summary: string;
	/** Markdown body below frontmatter. */
	readonly body: string;
}

/** Split user skills line: "Requirements Engineering 5; Team Player; IREB Certified" */
export function parseSkillsLine(line: string): string[] {
	return line
		.split(/[;\n]+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) => {
			const m = s.match(/^(.+?)\s+(\d+)\s*$/);
			if (m) return `${m[1].trim()}|${m[2]}`;
			return s;
		});
}

/** Format skills for Agent blueprint (pipe level optional). */
export function skillsToAgentBlueprintSkills(skills: readonly string[]): string[] {
	return [...skills];
}

/**
 * Parse ProjectRole markdown. Returns null if not a ProjectRole note.
 */
export function parseProjectRoleMarkdown(md: string): ParsedProjectRole | null {
	const normalized = md.replace(/\r\n/g, "\n");
	const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
	if (!match) return null;
	const block = match[1];
	const body = normalized.slice(match[0].length).trim();

	const typeLine = block.match(/^type:\s*(.+)$/m);
	if (!typeLine || typeLine[1].trim() !== PROJECT_ROLE_NOTE_TYPE) return null;

	const idM = block.match(/^id:\s*(.+)$/m);
	const roleM = block.match(/^role:\s*(.+)$/m);
	const id = idM ? stripQuotes(idM[1].trim()) : "";
	const role = roleM ? stripQuotes(roleM[1].trim()) : "";
	if (!id || !role) return null;

	const needM = block.match(/^need:\s*(.*)$/m);
	const need = needM ? stripQuotes(needM[1].trim()) : "";

	const descM = block.match(/^description:\s*(.*)$/m);
	const summary = descM ? stripQuotes(descM[1].trim()) : "";

	let skills = parseSkillsFromFrontmatterBlock(block);
	if (skills.length === 0) {
		const inline = block.match(/^skills:\s*(.+)$/m);
		const raw = inline?.[1]?.trim() ?? "";
		if (raw && raw !== "[]") skills = parseSkillsLine(raw);
	}

	return { id, role, need, skills, summary, body };
}

function stripQuotes(s: string): string {
	return s.replace(/^["']|["']$/g, "");
}

/** Extract skills: as YAML list (- items) from frontmatter block. */
function parseSkillsFromFrontmatterBlock(block: string): string[] {
	const lines = block.split("\n");
	const skills: string[] = [];
	let inSkills = false;
	for (const line of lines) {
		if (/^skills:\s*$/.test(line)) {
			inSkills = true;
			continue;
		}
		if (inSkills) {
			const item = line.match(/^\s+-\s+(.+)$/);
			if (item) {
				skills.push(stripQuotes(item[1].trim()));
				continue;
			}
			if (/^\w[\w-]*:/.test(line)) break;
		}
	}
	return skills;
}

export interface BuildProjectRoleInput {
	readonly id: string;
	readonly role: string;
	readonly need: string;
	readonly skills: readonly string[];
	/** Short one-line summary (frontmatter `description`). */
	readonly summary: string;
	/** Markdown body (longer description). */
	readonly body: string;
}

function yamlScalar(s: string): string {
	if (s.includes("\n") || /[#:[\]{}&*!|>'"%@`]/.test(s)) return JSON.stringify(s);
	return s.length === 0 ? '""' : s;
}

/** Build full ProjectRole markdown file content. */
export function buildProjectRoleMarkdown(input: BuildProjectRoleInput): string {
	const skillsLines =
		input.skills.length > 0
			? ["skills:", ...input.skills.map((sk) => `  - ${yamlScalar(sk)}`)]
			: ["skills: []"];

	const fm = [
		"---",
		`type: ${PROJECT_ROLE_NOTE_TYPE}`,
		`id: ${yamlScalar(input.id)}`,
		`role: ${yamlScalar(input.role)}`,
		`need: ${yamlScalar(input.need)}`,
		...(input.summary ? [`description: ${yamlScalar(input.summary)}`] : []),
		...skillsLines,
		"---",
		"",
		input.body.trim(),
		"",
	].join("\n");
	return fm;
}

/** Vault-relative path to a role note for a project. */
export function projectRoleNoteRelativePath(projectFolderName: string, roleId: string): string {
	const safeId = roleId.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-").toLowerCase() || "role";
	return `01 - Projects/${projectFolderName}/team/roles/${safeId}.md`;
}

/** Display / edit line: `Skill Name 5; Other skill` from stored `Skill Name|5` entries. */
export function formatSkillsLineForEditor(skills: readonly string[]): string {
	return skills
		.map((s) => {
			const m = s.match(/^(.+)\|(\d+)$/);
			return m ? `${m[1].trim()} ${m[2]}` : s;
		})
		.join("; ");
}

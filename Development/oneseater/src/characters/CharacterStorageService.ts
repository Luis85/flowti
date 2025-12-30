import { App, TFile, Notice } from "obsidian";
import { CharacterData } from "src/models/Character";
import { OneSeaterSettings } from "src/settings/types";

export class CharacterStorageService {
	private app: App;
	private characterFolder: string = "Characters";

	constructor(app: App, settings: OneSeaterSettings) {
		this.app = app;
		this.characterFolder = settings.dataFolderPath + "/Characters";
	}

	/**
	 * Save character as markdown file with frontmatter
	 * Returns existing file if character with same name already exists
	 */
	async saveCharacter(character: CharacterData): Promise<TFile | null> {
		try {
			// Ensure folder exists
			await this.ensureCharacterFolder();

			// Generate filename
			const filename = this.generateFilename(character.name);
			const filepath = `${this.characterFolder}/${filename}`;

			// Check if file already exists with same name
			const existingFile = this.findCharacterByName(character.name);

			if (existingFile) {
				console.log(
					`Character "${character.name}" already exists at ${existingFile.path}`
				);

				// Ask user if they want to overwrite or create new
				// For now, we just return the existing file
				// The main.ts logic will handle the update
				return existingFile;
			}

			// Create file content
			const content = this.generateCharacterMarkdown(character);

			// Create file
			const file = await this.app.vault.create(filepath, content);

			console.log(`Character saved at ${file.path}`);
			return file;
		} catch (error) {
			console.error("Error saving character:", error);
			new Notice("Failed to save character!");
			return null;
		}
	}

	/**
	 * Find character file by name (searches in character folder)
	 */
	findCharacterByName(name: string): TFile | null {
		const files = this.app.vault.getMarkdownFiles();
		const characterFiles = files.filter((file) =>
			file.path.startsWith(this.characterFolder)
		);

		for (const file of characterFiles) {
			// Check if filename contains the character name
			const safeName = name
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "");

			if (file.basename.toLowerCase().includes(safeName)) {
				return file;
			}
		}

		return null;
	}

	/**
	 * Load character from markdown file
	 */
	async loadCharacter(filepath: string): Promise<CharacterData | null> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filepath);
			if (!(file instanceof TFile)) {
				return null;
			}

			const content = await this.app.vault.read(file);
			const character = this.parseCharacterMarkdown(content);

			return character;
		} catch (error) {
			console.error("Error loading character:", error);
			return null;
		}
	}

	/**
	 * Update existing character file
	 */
	async updateCharacter(
		filepath: string,
		character: CharacterData
	): Promise<boolean> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filepath);
			if (!(file instanceof TFile)) {
				return false;
			}

			const content = this.generateCharacterMarkdown(character);
			await this.app.vault.modify(file, content);

			new Notice(`Character "${character.name}" updated!`);
			return true;
		} catch (error) {
			console.error("Error updating character:", error);
			return false;
		}
	}

	/**
	 * Generate markdown content with frontmatter
	 */
	private generateCharacterMarkdown(character: CharacterData): string {
		const frontmatter = this.generateFrontmatter(character);
		const body = this.generateCharacterBody(character);

		return `---\n${frontmatter}---\n\n${body}`;
	}

	/**
	 * Generate YAML frontmatter
	 */
	private generateFrontmatter(character: CharacterData): string {
		const yaml: string[] = [];

		yaml.push(`name: "${character.name}"`);
		yaml.push(`type: character`);
		yaml.push(`created: ${new Date().toISOString()}`);
		yaml.push(`totalPoints: ${character.totalPoints}`);
		yaml.push(`spentPoints: ${character.spentPoints}`);
		yaml.push("");

		// Attributes
		yaml.push("attributes:");
		yaml.push(`  strength: ${character.attributes.strength}`);
		yaml.push(`  dexterity: ${character.attributes.dexterity}`);
		yaml.push(`  intelligence: ${character.attributes.intelligence}`);
		yaml.push(`  health: ${character.attributes.health}`);
		yaml.push("");

		// Skills
		yaml.push("skills:");
		character.skills.forEach((skill) => {
			yaml.push(`  - id: ${skill.id}`);
			yaml.push(`    name: "${skill.name}"`);
			yaml.push(`    pointsInvested: ${skill.pointsInvested}`);
			yaml.push(`    cost: ${skill.cost}`);
			yaml.push(`    governingAttribute: ${skill.governingAttribute}`);
			yaml.push(`    difficulty: ${skill.difficulty}`);
		});
		yaml.push("");

		// Traits (if any)
		if (character.traits.length > 0) {
			yaml.push("traits:");
			character.traits.forEach((trait) => {
				yaml.push(`  - name: "${trait.name}"`);
				yaml.push(`    description: "${trait.description}"`);
				yaml.push(`    cost: ${trait.cost}`);
				yaml.push(`    type: ${trait.type}`);
			});
			yaml.push("");
		}

		return yaml.join("\n");
	}

	/**
	 * Generate markdown body
	 */
	private generateCharacterBody(character: CharacterData): string {
		const body: string[] = [];

		body.push(`# ${character.name}`);
		body.push("");
		body.push("## Character Sheet");
		body.push("");

		// Overview
		body.push("### Overview");
		body.push(`- **Total Points**: ${character.totalPoints}`);
		body.push(`- **Spent Points**: ${character.spentPoints}`);
		body.push(
			`- **Remaining Points**: ${
				character.totalPoints - character.spentPoints
			}`
		);
		body.push("");

		// Attributes
		body.push("### Attributes");
		body.push("");
		body.push("| Attribute | Value | Description |");
		body.push("|-----------|-------|-------------|");
		body.push(
			`| Strength (ST) | ${character.attributes.strength} | Physical power and stamina |`
		);
		body.push(
			`| Dexterity (DX) | ${character.attributes.dexterity} | Coordination and precision |`
		);
		body.push(
			`| Intelligence (IQ) | ${character.attributes.intelligence} | Mental capacity and learning |`
		);
		body.push(
			`| Health (HT) | ${character.attributes.health} | Endurance and resilience |`
		);
		body.push("");

		// Skills
		body.push("### Skills");
		body.push("");
		if (character.skills.length > 0) {
			body.push(
				"| Skill | Level | Points | Difficulty | Governing Attr |"
			);
			body.push(
				"|-------|-------|--------|------------|----------------|"
			);
			character.skills.forEach((skill) => {
				const attrValue =
					character.attributes[skill.governingAttribute];
				const effectiveLevel = attrValue + skill.pointsInvested - 1;
				body.push(
					`| ${skill.name} | ${effectiveLevel} | ${
						skill.pointsInvested
					} | ${
						skill.difficulty
					} | ${skill.governingAttribute.toUpperCase()} |`
				);
			});
		} else {
			body.push("*No skills learned yet.*");
		}
		body.push("");

		// Traits
		if (character.traits.length > 0) {
			body.push("### Traits");
			body.push("");
			character.traits.forEach((trait) => {
				const prefix = trait.type === "advantage" ? "✓" : "✗";
				body.push(
					`**${prefix} ${trait.name}** (${trait.cost > 0 ? "+" : ""}${
						trait.cost
					} points)`
				);
				body.push(`> ${trait.description}`);
				body.push("");
			});
		}

		// Footer
		body.push("---");
		body.push("");
		body.push("*Character created with OneSeater*");

		return body.join("\n");
	}

	/**
	 * Parse character from markdown frontmatter
	 */
	private parseCharacterMarkdown(content: string): CharacterData | null {
		try {
			// Extract frontmatter
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatterMatch) {
				return null;
			}

			// Simple YAML parsing (for our structured data)
			const frontmatter = frontmatterMatch[1];
			const character: CharacterData = {
				name: this.extractYamlValue(frontmatter, "name"),
				totalPoints: parseInt(
					this.extractYamlValue(frontmatter, "totalPoints")
				),
				spentPoints: parseInt(
					this.extractYamlValue(frontmatter, "spentPoints")
				),
				attributes: {
					strength: parseInt(
						this.extractYamlNestedValue(
							frontmatter,
							"attributes",
							"strength"
						)
					),
					dexterity: parseInt(
						this.extractYamlNestedValue(
							frontmatter,
							"attributes",
							"dexterity"
						)
					),
					intelligence: parseInt(
						this.extractYamlNestedValue(
							frontmatter,
							"attributes",
							"intelligence"
						)
					),
					health: parseInt(
						this.extractYamlNestedValue(
							frontmatter,
							"attributes",
							"health"
						)
					),
				},
				skills: [], // Parse skills array
				traits: [], // Parse traits array
			};

			return character;
		} catch (error) {
			console.error("Error parsing character:", error);
			return null;
		}
	}

	/**
	 * Extract value from YAML string
	 */
	private extractYamlValue(yaml: string, key: string): string {
		const match = yaml.match(new RegExp(`${key}: ["']?(.*?)["']?$`, "m"));
		return match ? match[1] : "";
	}

	/**
	 * Extract nested value from YAML string
	 */
	private extractYamlNestedValue(
		yaml: string,
		parent: string,
		key: string
	): string {
		const parentMatch = yaml.match(
			new RegExp(`${parent}:\\n([\\s\\S]*?)(?:\\n[^\\s]|$)`)
		);
		if (!parentMatch) return "";

		const parentBlock = parentMatch[1];
		const match = parentBlock.match(new RegExp(`\\s+${key}: (.*?)$`, "m"));
		return match ? match[1] : "";
	}

	/**
	 * Ensure character folder exists
	 */
	private async ensureCharacterFolder(): Promise<void> {
		const folders = this.characterFolder.split("/");
		let currentPath = "";

		for (const folder of folders) {
			currentPath = currentPath ? `${currentPath}/${folder}` : folder;

			if (!this.app.vault.getAbstractFileByPath(currentPath)) {
				await this.app.vault.createFolder(currentPath);
			}
		}
	}

	/**
	 * Generate safe filename
	 */
	private generateFilename(name: string): string {
		return `${name}.md`;
	}

	/**
	 * List all character files
	 */
	async listCharacters(): Promise<TFile[]> {
		const folder = this.app.vault.getAbstractFileByPath(
			this.characterFolder
		);
		if (!folder) {
			return [];
		}

		const files = this.app.vault.getMarkdownFiles();
		return files.filter((file) =>
			file.path.startsWith(this.characterFolder)
		);
	}
}

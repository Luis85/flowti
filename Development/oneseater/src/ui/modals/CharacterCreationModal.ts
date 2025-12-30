import { Modal, App, Setting, Notice } from "obsidian";
import { IEventBus } from "src/eventsystem";
import { CharacterCreatedEvent } from "src/eventsystem/characters/CharacterCreatedEvent";
import { CharacterAttributes, CharacterData } from "src/models/Character";

export class CharacterCreationModal extends Modal {
	private eventBus: IEventBus;
	private character: CharacterData;
	private readonly TOTAL_POINTS = 40;
	private readonly ATTRIBUTE_BASE_COST = 10; // Cost per attribute point

	private attributeSliders: Map<string, HTMLInputElement> = new Map();
	private attributeValues: Map<string, HTMLElement> = new Map();
	private pointsDisplay: HTMLElement;

	constructor(app: App, eventBus: IEventBus) {
		super(app);
		this.eventBus = eventBus;
		this.initializeCharacter();
	}

	private initializeCharacter(): void {
		this.character = {
			name: "",
			attributes: {
				strength: 10,
				dexterity: 10,
				intelligence: 10,
				health: 10,
			},
			skills: [{ name: "mechanic", level: 1, cost: 0 }],
			traits: [],
			totalPoints: this.TOTAL_POINTS,
			spentPoints: 0,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("character-creation-modal");

		// Header
		contentEl.createEl("h2", { text: "Create Your Character" });

		// Character Name
		new Setting(contentEl).setName("Player Name").addText((text) =>
			text.setValue(this.character.name).onChange((value) => {
				this.character.name = value;
			})
		);

		// Points Display
		const pointsContainer = contentEl.createDiv("points-container");
		this.pointsDisplay = pointsContainer.createEl("div", {
			cls: "points-display",
			text: this.getPointsText(),
		});

		// Attributes Section
		this.createAttributesSection(contentEl);

		// Skills Section (placeholder for now)
		//this.createSkillsSection(contentEl);

		// Traits Section (placeholder for now)
		//this.createTraitsSection(contentEl);

		// Action Buttons
		this.createActionButtons(contentEl);
	}

	private createAttributesSection(container: HTMLElement): void {
		const section = container.createDiv("character-section");
		section.createEl("h3", { text: "Primary Attributes" });

		const desc = section.createEl("p", {
			cls: "section-description",
			text: `Increasing costs ${this.ATTRIBUTE_BASE_COST} points per level.`,
		});

		const attributes = [
			{
				key: "strength",
				label: "Strength (ST)",
				desc: "Physical power and stamina - affects energy capacity",
			},
			{
				key: "dexterity",
				label: "Dexterity (DX)",
				desc: "Coordination and precision - affects task completion speed",
			},
			{
				key: "intelligence",
				label: "Intelligence (IQ)",
				desc: "Mental capacity - affects XP gain and skill learning",
			},
			{
				key: "health",
				label: "Health (HT)",
				desc: "Endurance and resilience - affects energy recovery",
			},
		];

		attributes.forEach((attr) => {
			const attrContainer = section.createDiv("attribute-control");

			// Header with label and value
			const header = attrContainer.createDiv("attribute-header");
			header.createEl("span", {
				cls: "attribute-label",
				text: attr.label,
			});

			const valueDisplay = header.createEl("span", {
				cls: "attribute-value",
				text: "10",
			});
			this.attributeValues.set(attr.key, valueDisplay);

			// Description
			attrContainer.createEl("div", {
				cls: "attribute-description",
				text: attr.desc,
			});

			// Slider
			const sliderContainer = attrContainer.createDiv("slider-container");
			const slider = sliderContainer.createEl("input", {
				type: "range",
				cls: "attribute-slider",
			});
			slider.min = "8";
			slider.max = "14";
			slider.value = "10";
			slider.step = "1";

			this.attributeSliders.set(attr.key, slider);

			// Min/Max labels
			const labels = sliderContainer.createDiv("slider-labels");
			labels.createEl("span", { text: "8" });
			labels.createEl("span", { text: "14" });

			slider.addEventListener("input", () => {
				const value = parseInt(slider.value);
				this.character.attributes[
					attr.key as keyof CharacterAttributes
				] = value;
				valueDisplay.setText(value.toString());
				this.updatePointsDisplay();
			});
		});
	}

	private createSkillsSection(container: HTMLElement): void {
		const section = container.createDiv("character-section");
		section.createEl("h3", { text: "Skills" });
		section.createEl("p", {
			cls: "section-description coming-soon",
			text: "Skills selection coming in next iteration...",
		});
	}

	private createTraitsSection(container: HTMLElement): void {
		const section = container.createDiv("character-section");
		section.createEl("h3", { text: "Advantages & Disadvantages" });
		section.createEl("p", {
			cls: "section-description coming-soon",
			text: "Traits selection coming in next iteration...",
		});
	}

	private createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv("modal-button-container");

		// Cancel Button
		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "mod-cancel",
		});
		cancelBtn.addEventListener("click", () => this.close());

		// Create Character Button
		const createBtn = buttonContainer.createEl("button", {
			text: "Create Character",
			cls: "mod-cta",
		});
		createBtn.addEventListener("click", () => this.createCharacter());
	}

	private calculateSpentPoints(): number {
		let spent = 0;

		// Calculate attribute costs
		Object.values(this.character.attributes).forEach((value) => {
			const diff = value - 10; // Base is 10
			spent += diff * this.ATTRIBUTE_BASE_COST;
		});

		// Add skill costs (when implemented)
		this.character.skills.forEach((skill) => {
			spent += skill.cost;
		});

		// Add trait costs (when implemented)
		this.character.traits.forEach((trait) => {
			spent += trait.cost;
		});

		return spent;
	}

	private updatePointsDisplay(): void {
		const spent = this.calculateSpentPoints();
		const remaining = this.TOTAL_POINTS - spent;

		this.character.spentPoints = spent;
		this.pointsDisplay.setText(this.getPointsText());

		// Visual feedback for point status
		this.pointsDisplay.removeClass("points-warning", "points-error");
		if (remaining < 0) {
			this.pointsDisplay.addClass("points-error");
		} else if (remaining < 20) {
			this.pointsDisplay.addClass("points-warning");
		}
	}

	private getPointsText(): string {
		const spent = this.calculateSpentPoints();
		const remaining = this.TOTAL_POINTS - spent;
		return `Points: ${spent} / ${this.TOTAL_POINTS} (${remaining} remaining)`;
	}

	private createCharacter(): void {
		// Validation
		if (!this.character.name.trim()) {
			// Use Obsidian's notice system
			new Notice("Please enter a name");
			return;
		}

		const spent = this.calculateSpentPoints();
		if (spent > this.TOTAL_POINTS) {
			new Notice(
				`You've spent too many points! (${
					spent - this.TOTAL_POINTS
				} over)`
			);
			return;
		}

		// Emit event with character data
		this.eventBus.publish(new CharacterCreatedEvent(this.character));

		new Notice("Character created successfully!");
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

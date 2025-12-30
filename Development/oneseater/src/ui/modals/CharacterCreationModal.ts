import { Modal, App, Setting, Notice } from "obsidian";
import { AVAILABLE_SKILLS, CHARACTER_CONSTANTS, AttributeType, SkillCategory } from "src/characters/types";
import { IEventBus } from "src/eventsystem";
import { CharacterCreatedEvent } from "src/eventsystem/characters/CharacterCreatedEvent";
import { CharacterAttributes, CharacterData, CharacterSkill, calculateSkillCost, calculateEffectiveSkillLevel } from "src/models/Character";
import { OneSeaterSettings } from "src/settings/types";

export class CharacterCreationModal extends Modal {
    private eventBus: IEventBus;
    private character: CharacterData;
    private settings: OneSeaterSettings;

    private attributeSliders: Map<string, HTMLInputElement> = new Map();
    private attributeValues: Map<string, HTMLElement> = new Map();
    private skillControls: Map<string, {
        container: HTMLElement;
        valueDisplay: HTMLElement;
        investButton: HTMLButtonElement;
        removeButton: HTMLButtonElement;
        effectiveLevel: HTMLElement;
    }> = new Map();
    private pointsDisplay: HTMLElement;
    private skillsSectionContainer: HTMLElement; // NEW: Direct reference to skills container

    constructor(app: App, eventBus: IEventBus, settings: OneSeaterSettings) {
        super(app);
        this.eventBus = eventBus;
        this.settings = settings;
        this.initializeCharacter();
    }

    private initializeCharacter(): void {
        const startingSkill = AVAILABLE_SKILLS.mechanic;
        
        this.character = {
            name: this.settings.player.name ?? "",
            attributes: {
                strength: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
                dexterity: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
                intelligence: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
                health: CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL,
            },
            skills: [{
                id: startingSkill.id,
                name: startingSkill.name,
                pointsInvested: 1,
                cost: 0,
                governingAttribute: startingSkill.governingAttribute,
                difficulty: startingSkill.difficulty
            }],
            traits: [],
            totalPoints: CHARACTER_CONSTANTS.TOTAL_CHARACTER_POINTS,
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
        new Setting(contentEl)
            .setName("Your Name")
            .addText((text) =>
                text
                    .setValue(this.character.name)
                    .onChange((value) => {
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

        // Skills Section - CHANGED: Store reference
        this.skillsSectionContainer = contentEl.createDiv("skills-section-wrapper");
        this.createSkillsSection(this.skillsSectionContainer);

        // Action Buttons
        this.createActionButtons(contentEl);
    }

    private createAttributesSection(container: HTMLElement): void {
        const section = container.createDiv("character-section");
        section.createEl("h3", { text: "Primary Attributes" });

        const desc = section.createEl("p", {
            cls: "section-description",
            text: `Starting at ${CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL}. Increasing costs ${CHARACTER_CONSTANTS.ATTRIBUTE_BASE_COST} points per level.`,
        });

        const attributes = [
            {
                key: AttributeType.STRENGTH,
                label: "Strength (ST)",
                desc: "Physical power - affects energy capacity",
            },
            {
                key: AttributeType.DEXTERITY,
                label: "Dexterity (DX)",
                desc: "Coordination - affects technical skills",
            },
            {
                key: AttributeType.INTELLIGENCE,
                label: "Intelligence (IQ)",
                desc: "Mental capacity - affects learning",
            },
            {
                key: AttributeType.HEALTH,
                label: "Health (HT)",
                desc: "Endurance - affects energy recovery",
            },
        ];

        attributes.forEach((attr) => {
            const attrContainer = section.createDiv("attribute-control");

            const header = attrContainer.createDiv("attribute-header");
            header.createEl("span", {
                cls: "attribute-label",
                text: attr.label,
            });

            const valueDisplay = header.createEl("span", {
                cls: "attribute-value",
                text: `${CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL}`,
            });
            this.attributeValues.set(attr.key, valueDisplay);

            attrContainer.createEl("div", {
                cls: "attribute-description",
                text: attr.desc,
            });

            const sliderContainer = attrContainer.createDiv("slider-container");
            const slider = sliderContainer.createEl("input", {
                type: "range",
                cls: "attribute-slider",
            });
            slider.min = CHARACTER_CONSTANTS.MIN_ATTRIBUTE.toString();
            slider.max = CHARACTER_CONSTANTS.MAX_ATTRIBUTE.toString();
            slider.value = CHARACTER_CONSTANTS.STARTING_ATTRIBUTE_LEVEL.toString();
            slider.step = "1";

            this.attributeSliders.set(attr.key, slider);

            const labels = sliderContainer.createDiv("slider-labels");
            labels.createEl("span", { text: CHARACTER_CONSTANTS.MIN_ATTRIBUTE.toString() });
            labels.createEl("span", { text: CHARACTER_CONSTANTS.MAX_ATTRIBUTE.toString() });

            slider.addEventListener("input", () => {
                const value = parseInt(slider.value);
                this.character.attributes[attr.key as keyof CharacterAttributes] = value;
                valueDisplay.setText(value.toString());
                this.updatePointsDisplay();
                this.updateSkillDisplays();
            });
        });
    }

    private createSkillsSection(container: HTMLElement): void {
        const section = container.createDiv("character-section");
        section.createEl("h3", { text: "Skills & Training" });
        
        const desc = section.createEl("p", {
            cls: "section-description",
            text: "Mechanic skill is free. Additional skills cost points based on difficulty.",
        });

        this.createStartingSkillDisplay(section);
        this.createAvailableSkillsList(section);
    }

    private rebuildSkillsSection(): void {
        // FIXED: Clear and rebuild only the skills section
        this.skillsSectionContainer.empty();
        this.skillControls.clear();
        this.createSkillsSection(this.skillsSectionContainer);
    }

    private createStartingSkillDisplay(container: HTMLElement): void {
        const startingSkillContainer = container.createDiv("starting-skill-container");
        startingSkillContainer.createEl("h4", { 
            text: "Starting Skill",
            cls: "subsection-title" 
        });

        const mechanicSkill = this.character.skills[0];
        const skillDef = AVAILABLE_SKILLS[mechanicSkill.id];
        
        this.createSkillControl(
            startingSkillContainer, 
            mechanicSkill, 
            skillDef,
            true
        );
    }

    private createAvailableSkillsList(container: HTMLElement): void {
        const availableContainer = container.createDiv("available-skills-container");
        availableContainer.createEl("h4", { 
            text: "Available Skills",
            cls: "subsection-title" 
        });

        const categories = Object.values(SkillCategory);
        
        categories.forEach(category => {
            const categorySkills = Object.values(AVAILABLE_SKILLS)
                .filter(skill => skill.category === category && !skill.isStartingSkill);
            
            if (categorySkills.length === 0) return;

            const categoryContainer = availableContainer.createDiv("skill-category");
            categoryContainer.createEl("h5", { 
                text: category,
                cls: "category-title"
            });

            categorySkills.forEach(skillDef => {
                const existingSkill = this.character.skills.find(s => s.id === skillDef.id);
                
                if (existingSkill) {
                    this.createSkillControl(categoryContainer, existingSkill, skillDef, false);
                } else {
                    this.createUnlearnedSkillControl(categoryContainer, skillDef);
                }
            });
        });
    }

    private createSkillControl(
        container: HTMLElement,
        skill: CharacterSkill,
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS],
        isStartingSkill: boolean
    ): void {
        const skillControl = container.createDiv("skill-control learned");
        
        const header = skillControl.createDiv("skill-header");
        const titleContainer = header.createDiv("skill-title-container");
        
        titleContainer.createEl("span", {
            cls: "skill-name",
            text: skillDef.name
        });
        
        titleContainer.createEl("span", {
            cls: `difficulty-badge difficulty-${skillDef.difficulty.toLowerCase().replace(' ', '_')}`,
            text: skillDef.difficulty
        });

        const valuesContainer = header.createDiv("skill-values");
        
        const pointsDisplay = valuesContainer.createEl("span", {
            cls: "skill-points",
            text: `${skill.pointsInvested}p`
        });

        const effectiveLevel = valuesContainer.createEl("span", {
            cls: "skill-level",
            text: this.getEffectiveSkillText(skill)
        });

        skillControl.createEl("div", {
            cls: "skill-description",
            text: skillDef.description
        });

        const controls = skillControl.createDiv("skill-controls");
        
        const investButton = controls.createEl("button", {
            text: "+",
            cls: "skill-button invest-button"
        });
        
        const removeButton = controls.createEl("button", {
            text: "−",
            cls: "skill-button remove-button"
        });

        if (isStartingSkill && skill.pointsInvested <= 1) {
            removeButton.disabled = true;
            removeButton.addClass("disabled");
        }

        investButton.addEventListener("click", () => {
            this.investSkillPoint(skill, skillDef, pointsDisplay, effectiveLevel, removeButton, isStartingSkill);
        });

        removeButton.addEventListener("click", () => {
            this.removeSkillPoint(skill, skillDef, pointsDisplay, effectiveLevel, removeButton, isStartingSkill);
        });

        this.skillControls.set(skill.id, {
            container: skillControl,
            valueDisplay: pointsDisplay,
            investButton,
            removeButton,
            effectiveLevel
        });
    }

    private createUnlearnedSkillControl(
        container: HTMLElement,
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS]
    ): void {
        const skillControl = container.createDiv("skill-control unlearned");
        
        const header = skillControl.createDiv("skill-header");
        const titleContainer = header.createDiv("skill-title-container");
        
        titleContainer.createEl("span", {
            cls: "skill-name",
            text: skillDef.name
        });
        
        titleContainer.createEl("span", {
            cls: `difficulty-badge difficulty-${skillDef.difficulty.toLowerCase().replace(' ', '_')}`,
            text: skillDef.difficulty
        });

        skillControl.createEl("div", {
            cls: "skill-description",
            text: skillDef.description
        });

        const controls = skillControl.createDiv("skill-controls");
        const cost = calculateSkillCost(1, skillDef.difficulty);
        const learnButton = controls.createEl("button", {
            text: `Learn (${cost}p)`,
            cls: "skill-button learn-button"
        });

        learnButton.addEventListener("click", () => {
            this.learnNewSkill(skillDef);
        });
    }

    private learnNewSkill(skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS]): void {
        const cost = calculateSkillCost(1, skillDef.difficulty);
        const remaining = this.getRemainingPoints();

        if (remaining < cost) {
            new Notice(`Not enough points! Need ${cost}, have ${remaining}`);
            return;
        }

        const newSkill: CharacterSkill = {
            id: skillDef.id,
            name: skillDef.name,
            pointsInvested: 1,
            cost: cost,
            governingAttribute: skillDef.governingAttribute,
            difficulty: skillDef.difficulty
        };

        this.character.skills.push(newSkill);
        this.updatePointsDisplay();
        
        // FIXED: Use new rebuild method
        this.rebuildSkillsSection();
        
        new Notice(`Learned ${skillDef.name}!`);
    }

    private investSkillPoint(
        skill: CharacterSkill,
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS],
        pointsDisplay: HTMLElement,
        effectiveLevel: HTMLElement,
        removeButton: HTMLButtonElement,
        isStartingSkill: boolean
    ): void {
        const newPoints = skill.pointsInvested + 1;
        const newCost = calculateSkillCost(newPoints, skill.difficulty);
        const costIncrease = newCost - skill.cost;
        const remaining = this.getRemainingPoints();

        if (remaining < costIncrease) {
            new Notice(`Not enough points! Need ${costIncrease}, have ${remaining}`);
            return;
        }

        skill.pointsInvested = newPoints;
        skill.cost = newCost;
        
        pointsDisplay.setText(`${skill.pointsInvested}p`);
        effectiveLevel.setText(this.getEffectiveSkillText(skill));
        
        if (isStartingSkill && skill.pointsInvested > 1) {
            removeButton.disabled = false;
            removeButton.removeClass("disabled");
        }
        
        this.updatePointsDisplay();
    }

    private removeSkillPoint(
        skill: CharacterSkill,
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS],
        pointsDisplay: HTMLElement,
        effectiveLevel: HTMLElement,
        removeButton: HTMLButtonElement,
        isStartingSkill: boolean
    ): void {
        if (isStartingSkill && skill.pointsInvested <= 1) {
            new Notice("Cannot remove your starting skill!");
            return;
        }

        const newPoints = skill.pointsInvested - 1;
        
        if (newPoints === 0) {
            const index = this.character.skills.findIndex(s => s.id === skill.id);
            if (index !== -1) {
                this.character.skills.splice(index, 1);
            }
            
            // FIXED: Use new rebuild method
            this.rebuildSkillsSection();
            
            new Notice(`Unlearned ${skillDef.name}`);
        } else {
            const newCost = calculateSkillCost(newPoints, skill.difficulty);
            skill.pointsInvested = newPoints;
            skill.cost = newCost;
            
            pointsDisplay.setText(`${skill.pointsInvested}p`);
            effectiveLevel.setText(this.getEffectiveSkillText(skill));
            
            if (isStartingSkill && skill.pointsInvested === 1) {
                removeButton.disabled = true;
                removeButton.addClass("disabled");
            }
        }
        
        this.updatePointsDisplay();
    }

    private getEffectiveSkillText(skill: CharacterSkill): string {
        const attrValue = this.character.attributes[skill.governingAttribute];
        const effectiveLevel = calculateEffectiveSkillLevel(skill, attrValue);
        return `Lv ${effectiveLevel}`;
    }

    private updateSkillDisplays(): void {
        this.character.skills.forEach(skill => {
            const control = this.skillControls.get(skill.id);
            if (control) {
                control.effectiveLevel.setText(this.getEffectiveSkillText(skill));
            }
        });
    }

    private createActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv("modal-button-container");

        const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancel",
            cls: "mod-cancel",
        });
        cancelBtn.addEventListener("click", () => this.close());

        const createBtn = buttonContainer.createEl("button", {
            text: "Create Character",
            cls: "mod-cta",
        });
        createBtn.addEventListener("click", () => this.createCharacter());
    }

    private calculateSpentPoints(): number {
        let spent = 0;

        Object.values(this.character.attributes).forEach((value) => {
            const diff = value - CHARACTER_CONSTANTS.ATTRIBUTE_BASELINE;
            spent += diff * CHARACTER_CONSTANTS.ATTRIBUTE_BASE_COST;
        });

        this.character.skills.forEach((skill) => {
            spent += skill.cost;
        });

        return spent;
    }

    private getRemainingPoints(): number {
        const spent = this.calculateSpentPoints();
        return this.character.totalPoints - spent;
    }

    private updatePointsDisplay(): void {
        const spent = this.calculateSpentPoints();
        const remaining = this.getRemainingPoints();

        this.character.spentPoints = spent;
        this.pointsDisplay.setText(this.getPointsText());

        this.pointsDisplay.removeClass("points-warning", "points-error");
        if (remaining < 0) {
            this.pointsDisplay.addClass("points-error");
        } else if (remaining < 10) {
            this.pointsDisplay.addClass("points-warning");
        }
    }

    private getPointsText(): string {
        const spent = this.calculateSpentPoints();
        const remaining = this.getRemainingPoints();
        return `Points: ${spent} / ${this.character.totalPoints} (${remaining} remaining)`;
    }

    private createCharacter(): void {
        if (!this.character.name.trim()) {
            new Notice("Please enter a manager name");
            return;
        }

        const remaining = this.getRemainingPoints();
        if (remaining < 0) {
            new Notice(`You've spent too many points! (${Math.abs(remaining)} over)`);
            return;
        }

        this.eventBus.publish(new CharacterCreatedEvent(this.character));
        new Notice("Character created successfully!");
        this.close();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

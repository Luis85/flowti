import { Modal, App, Setting, Notice } from "obsidian";
import { AVAILABLE_SKILLS, CHARACTER_CONSTANTS, AttributeType, SkillCategory } from "src/characters/types";
import { CHARACTER_TEMPLATES, CUSTOM_TEMPLATE, CharacterTemplate } from "src/characters/templates";
import { IEventBus } from "src/eventsystem";
import { CharacterCreatedEvent } from "src/eventsystem/characters/CharacterCreatedEvent";
import { CharacterAttributes, CharacterData, CharacterSkill, calculateSkillCost, calculateEffectiveSkillLevel } from "src/models/Character";
import { OneSeaterSettings } from "src/settings/types";

export class CharacterCreationModal extends Modal {
    private eventBus: IEventBus;
    private character: CharacterData;
    private settings: OneSeaterSettings;
    
    private selectedTemplate: CharacterTemplate | null = null;
    private customMode: boolean = false;

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
    private skillsSectionContainer: HTMLElement;
    private characterCustomizationContainer: HTMLElement;

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
        contentEl.createEl("h2", { text: "Create Character" });
        
        contentEl.createEl("p", {
            cls: "modal-intro",
            text: "You start from humble beginnings. Choose your background and work your way to the top."
        });

        // Character Name
        new Setting(contentEl)
            .setName("Your Name")
            .setDesc("Your name in the world")
            .addText((text) =>
                text
                    .setValue(this.character.name)
                    .onChange((value) => {
                        this.character.name = value;
                    })
            );

        // Template Selection
        this.createTemplateSelection(contentEl);

        // Character Customization (hidden until template selected)
        this.characterCustomizationContainer = contentEl.createDiv("character-customization-container");
        this.characterCustomizationContainer.style.display = "none";
        
        // Action Buttons
        this.createActionButtons(contentEl);
    }

    private createTemplateSelection(container: HTMLElement): void {
        const section = container.createDiv("template-selection-section");
        section.createEl("h3", { text: "Choose Your Background" });
        
        const templatesGrid = section.createDiv("templates-grid");
        
        // Add all templates
        Object.values(CHARACTER_TEMPLATES).forEach(template => {
            this.createTemplateCard(templatesGrid, template);
        });
        
        // Add custom option
        this.createTemplateCard(templatesGrid, CUSTOM_TEMPLATE);
    }

    private createTemplateCard(container: HTMLElement, template: CharacterTemplate): void {
        const card = container.createDiv("template-card");
        
        card.createEl("h4", { text: template.name, cls: "template-name" });
        card.createEl("p", { text: template.description, cls: "template-description" });
        
        // Show key attributes
        const attrs = card.createDiv("template-attributes");
        const keyAttr = this.getKeyAttribute(template);
        attrs.createEl("span", { 
            text: `Key: ${keyAttr}`,
            cls: "template-key-attribute"
        });
        
        card.addEventListener("click", () => {
            this.selectTemplate(template);
            
            // Visual feedback
            container.querySelectorAll(".template-card").forEach(c => {
                c.removeClass("selected");
            });
            card.addClass("selected");
        });
    }

    private getKeyAttribute(template: CharacterTemplate): string {
        const attrs = template.recommendedAttributes;
        const max = Math.max(attrs.strength, attrs.dexterity, attrs.intelligence, attrs.health);
        
        if (attrs.strength === max) return "ST";
        if (attrs.dexterity === max) return "DX";
        if (attrs.intelligence === max) return "IQ";
        return "HT";
    }

    private selectTemplate(template: CharacterTemplate): void {
        this.selectedTemplate = template;
        this.customMode = template.id === 'custom';
        
        // Apply template
        this.character.attributes = { ...template.recommendedAttributes };
        
        // Apply starting skills
        this.character.skills = template.startingSkills.map(skillData => {
            const skillDef = AVAILABLE_SKILLS[skillData.skillId];
            return {
                id: skillData.skillId,
                name: skillDef.name,
                pointsInvested: skillData.pointsInvested,
                cost: skillData.skillId === 'mechanic' && skillData.pointsInvested === 1 
                    ? 0 // First mechanic skill is free, this would be the base service the player can offer
                    : calculateSkillCost(skillData.pointsInvested, skillDef.difficulty),
                governingAttribute: skillDef.governingAttribute,
                difficulty: skillDef.difficulty
            };
        });
        
        // Show customization section
        this.showCustomizationSection();
    }

    private showCustomizationSection(): void {
        this.characterCustomizationContainer.empty();
        this.characterCustomizationContainer.style.display = "block";
        
        // Show template info
        if (this.selectedTemplate && this.selectedTemplate.id !== 'custom') {
            const templateInfo = this.characterCustomizationContainer.createDiv("template-info");
            templateInfo.createEl("h4", { text: `${this.selectedTemplate.name} Template` });
            templateInfo.createEl("p", { 
                text: this.selectedTemplate.backstory,
                cls: "template-backstory"
            });
        }

        // Attributes Section
        this.createAttributesSection(this.characterCustomizationContainer);

        // Points Display
        const pointsContainer = this.characterCustomizationContainer.createDiv("points-container");
        this.pointsDisplay = pointsContainer.createEl("div", {
            cls: "points-display",
            text: this.getPointsText(),
        });

        // Skills Section
        this.skillsSectionContainer = this.characterCustomizationContainer.createDiv("skills-section-wrapper");
        this.createSkillsSection(this.skillsSectionContainer);
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

            const currentValue = this.character.attributes[attr.key as keyof CharacterAttributes];
            const valueDisplay = header.createEl("span", {
                cls: "attribute-value",
                text: `${currentValue}`,
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
            slider.value = currentValue.toString();
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

    private rebuildSkillsSection(): void {
        this.skillsSectionContainer.empty();
        this.skillControls.clear();
        this.createSkillsSection(this.skillsSectionContainer);
    }

    private createSkillsSection(container: HTMLElement): void {
        const section = container.createDiv("character-section");
        section.createEl("h3", { text: "Skills & Training" });
        
        const desc = section.createEl("p", {
            cls: "section-description",
            text: "Click on skills to learn or improve them. Points cost based on difficulty.",
        });

        // Single unified skills grid
        this.createUnifiedSkillsGrid(section);
    }

    private createUnifiedSkillsGrid(container: HTMLElement): void {
        // Group all skills by category
        const categories = Object.values(SkillCategory);
        
        categories.forEach(category => {
            const categorySkills = Object.values(AVAILABLE_SKILLS)
                .filter(skill => skill.category === category);
            
            if (categorySkills.length === 0) return;

            const categorySection = container.createDiv("skill-category-section");
            categorySection.createEl("h4", { 
                text: category,
                cls: "skill-category-title"
            });

            const skillsGrid = categorySection.createDiv("skills-grid");

            categorySkills.forEach(skillDef => {
                const existingSkill = this.character.skills.find(s => s.id === skillDef.id);
                this.createSkillCard(skillsGrid, skillDef, existingSkill);
            });
        });
    }

    private createSkillCard(
        container: HTMLElement,
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS],
        existingSkill?: CharacterSkill
    ): void {
        const isLearned = !!existingSkill;
        const isStartingSkill = skillDef.isStartingSkill;
        
        const card = container.createDiv(`skill-card ${isLearned ? 'learned' : 'unlearned'}`);
        
        // Header
        const header = card.createDiv("skill-card-header");
        
        const titleContainer = header.createDiv("skill-card-title");
        titleContainer.createEl("span", {
            cls: "skill-card-name",
            text: skillDef.name
        });
        
        titleContainer.createEl("span", {
            cls: `difficulty-badge difficulty-${skillDef.difficulty.toLowerCase().replace(' ', '_')}`,
            text: skillDef.difficulty
        });

        // Stats (if learned)
        if (isLearned && existingSkill) {
            const stats = header.createDiv("skill-card-stats");
            stats.createEl("span", {
                cls: "skill-card-points",
                text: `${existingSkill.pointsInvested}p`
            });
            stats.createEl("span", {
                cls: "skill-card-level",
                text: this.getEffectiveSkillText(existingSkill)
            });
        }

        // Description
        card.createEl("p", {
            cls: "skill-card-description",
            text: skillDef.description
        });

        // Controls
        const controls = card.createDiv("skill-card-controls");
        
        if (isLearned && existingSkill) {
            // Learned skill - show +/- buttons
            const minusBtn = controls.createEl("button", {
                text: "−",
                cls: "skill-card-button minus-button"
            });
            
            const plusBtn = controls.createEl("button", {
                text: "+",
                cls: "skill-card-button plus-button"
            });

            // Lock starting skill at minimum
            if (isStartingSkill && existingSkill.pointsInvested <= 1) {
                minusBtn.disabled = true;
                minusBtn.addClass("disabled");
            }

            minusBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.handleSkillDecrease(skillDef, existingSkill, isStartingSkill);
            });

            plusBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.handleSkillIncrease(skillDef, existingSkill);
            });

            // Store references for updates
            this.skillControls.set(existingSkill.id, {
                container: card,
                valueDisplay: header.querySelector(".skill-card-points") as HTMLElement,
                investButton: plusBtn,
                removeButton: minusBtn,
                effectiveLevel: header.querySelector(".skill-card-level") as HTMLElement
            });
        } else {
            // Unlearned skill - show learn button
            const cost = calculateSkillCost(1, skillDef.difficulty);
            const learnBtn = controls.createEl("button", {
                text: `Learn (${cost}p)`,
                cls: "skill-card-button learn-button"
            });

            learnBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.handleSkillLearn(skillDef);
            });
        }
    }

    private handleSkillLearn(skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS]): void {
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
        this.rebuildSkillsSection();
        
        new Notice(`Learned ${skillDef.name}!`);
    }

    private handleSkillIncrease(
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS],
        skill: CharacterSkill
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
        
        // Update display
        const control = this.skillControls.get(skill.id);
        if (control) {
            control.valueDisplay.setText(`${skill.pointsInvested}p`);
            control.effectiveLevel.setText(this.getEffectiveSkillText(skill));
            
            // Enable minus button if it was disabled
            if (control.removeButton.disabled && skill.pointsInvested > 1) {
                control.removeButton.disabled = false;
                control.removeButton.removeClass("disabled");
            }
        }
        
        this.updatePointsDisplay();
    }

    private handleSkillDecrease(
        skillDef: typeof AVAILABLE_SKILLS[keyof typeof AVAILABLE_SKILLS],
        skill: CharacterSkill,
        isStartingSkill: boolean
    ): void {
        if (isStartingSkill && skill.pointsInvested <= 1) {
            new Notice("Cannot remove your starting skill!");
            return;
        }

        const newPoints = skill.pointsInvested - 1;
        
        if (newPoints === 0) {
            // Remove skill entirely
            const index = this.character.skills.findIndex(s => s.id === skill.id);
            if (index !== -1) {
                this.character.skills.splice(index, 1);
            }
            
            this.rebuildSkillsSection();
            new Notice(`Unlearned ${skillDef.name}`);
        } else {
            const newCost = calculateSkillCost(newPoints, skill.difficulty);
            skill.pointsInvested = newPoints;
            skill.cost = newCost;
            
            // Update display
            const control = this.skillControls.get(skill.id);
            if (control) {
                control.valueDisplay.setText(`${skill.pointsInvested}p`);
                control.effectiveLevel.setText(this.getEffectiveSkillText(skill));
                
                // Disable minus button if at minimum
                if (isStartingSkill && skill.pointsInvested === 1) {
                    control.removeButton.disabled = true;
                    control.removeButton.addClass("disabled");
                }
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
        if (!this.selectedTemplate) {
            new Notice("Please select a character background first!");
            return;
        }
        
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

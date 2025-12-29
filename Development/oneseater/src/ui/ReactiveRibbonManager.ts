import { Plugin, setIcon } from "obsidian";

export type RibbonButtonState = {
    icon: string;
    tooltip: string;
    disabled?: boolean;
    hidden?: boolean;
    active?: boolean; // Visuell "gedrückt"
};

export type RibbonButtonConfig = {
    id: string;
    initialState: RibbonButtonState;
    onClick: () => void;
};

export class ReactiveRibbonManager {
    private buttons: Map<string, {
        element: HTMLElement;
        state: RibbonButtonState;
    }> = new Map();

    constructor(private plugin: Plugin) {}

    register(config: RibbonButtonConfig): void {
        const element = this.plugin.addRibbonIcon(
            config.initialState.icon,
            config.initialState.tooltip,
            () => {
                const btn = this.buttons.get(config.id);
                if (btn?.state.disabled) return;
                config.onClick();
            }
        );

        this.buttons.set(config.id, {
            element,
            state: { ...config.initialState },
        });

        this.applyState(config.id);
    }

    update(id: string, partial: Partial<RibbonButtonState>): void {
        const btn = this.buttons.get(id);
        if (!btn) return;

        btn.state = { ...btn.state, ...partial };
        this.applyState(id);
    }

    private applyState(id: string): void {
        const btn = this.buttons.get(id);
        if (!btn) return;

        const { element, state } = btn;

        // Icon ändern
        setIcon(element, state.icon);

        // Tooltip ändern
        element.setAttribute("aria-label", state.tooltip);

        // Disabled State
        element.toggleClass("is-disabled", state.disabled ?? false);
        element.style.opacity = state.disabled ? "0.4" : "1";
        element.style.pointerEvents = state.disabled ? "none" : "auto";

        // Hidden State
        element.style.display = state.hidden ? "none" : "";

        // Active State (z.B. für "aktuell ausgewählt")
        element.toggleClass("is-active", state.active ?? false);
    }

    get(id: string): RibbonButtonState | undefined {
        return this.buttons.get(id)?.state;
    }

    dispose(): void {
        for (const { element } of this.buttons.values()) {
            element.remove();
        }
        this.buttons.clear();
    }
}

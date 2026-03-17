import OneSeater from "main";
import { PluginSettingTab, App, Setting } from "obsidian";
import { SETTINGS_CATALOG } from "src/settings/settings.catalog";
import { getDeep, setDeep, PathValue } from "./settings.utils";
import { SettingsItem, OneSeaterSettings } from "./types";

export class OneSeaterSettingTab extends PluginSettingTab {
	plugin: OneSeater;

	constructor(app: App, plugin: OneSeater) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// group by category
		const groups = new Map<string, SettingsItem[]>();
		for (const item of SETTINGS_CATALOG) {
			if (!groups.has(item.category)) groups.set(item.category, []);
			groups.get(item.category)?.push(item);
		}

		for (const [category, items] of groups) {
			containerEl.createEl("h3", { text: category });

			for (const item of items) {
				this.renderItem(containerEl, item);
			}
		}
	}

	
	private renderItem(containerEl: HTMLElement, item: SettingsItem) {
    const setting = new Setting(containerEl).setName(item.name);
    if (item.desc) setting.setDesc(item.desc);

    const currentValue = getDeep(this.plugin.settings, item.path);

    const commitAny = async (value: unknown) => {
        setDeep(this.plugin.settings, item.path, value as PathValue<OneSeaterSettings, typeof item.path>);
        await this.plugin.saveSettings();
        this.plugin.gameSettings?.applyFrom(this.plugin.settings.game);
    };

    switch (item.kind) {
        case "text":
            setting.addText((t) =>
                t
                    .setPlaceholder(item.placeholder ?? "")
                    .setValue(String(currentValue ?? ""))
                    .onChange((val) => commitAny(val))
            );
            break;

        case "number": {
            const numItem = item as typeof item & { min?: number; max?: number; step?: number };
            
            if (typeof numItem.min === "number" && typeof numItem.max === "number") {
                setting.addSlider((slider) => {
                    slider
                        .setLimits(numItem.min ?? 0, numItem.max ?? 1, numItem.step ?? 0.1)
                        .setDynamicTooltip()
                        .setValue(Number(currentValue))
                        .onChange((v) => commitAny(v));
                });
            } else {
                setting.addText((t) =>
                    t
                        .setPlaceholder(item.placeholder ?? "")
                        .setValue(String(currentValue ?? ""))
                        .onChange((val) => {
                            const parsed = parseFloat(val);
                            if (!Number.isNaN(parsed)) commitAny(parsed);
                        })
                );
            }
            
            setting.addExtraButton((btn) =>
                btn
                    .setIcon("reset")
                    .setTooltip("Reset to default")
                    .onClick(async () => {
                        await commitAny(item.default);
                        this.display();
                    })
            );
            break;
        }

        case "toggle":
            setting.addToggle((tog) =>
                tog
                    .setValue(Boolean(currentValue))
                    .onChange((v) => commitAny(v))
            );
            break;

        case "color":
            setting.addColorPicker((cp) =>
                cp
                    .setValue(String(currentValue))
                    .onChange((v) => commitAny(v))
            );
            break;

        case "dropdown":
            setting.addDropdown((dd) => {
                for (const opt of item.options ?? [])
                    dd.addOption(String(opt.value), opt.label);
                dd.setValue(String(currentValue ?? ""));
                dd.onChange((v) => {
                    const original = item.options?.find(o => String(o.value) === v)?.value;
                    commitAny(original ?? v);
                });
            });
            break;
    }
}
}

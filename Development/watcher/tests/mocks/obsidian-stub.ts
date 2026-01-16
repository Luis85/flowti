/**
 * Stub for the obsidian module in tests
 */

export class Notice {
	constructor(message: string, timeout?: number) {}
}

export class Plugin {
	app: any;
	manifest: any;

	loadData() {
		return Promise.resolve({});
	}

	saveData(data: any) {
		return Promise.resolve();
	}

	addRibbonIcon(icon: string, title: string, callback: () => void) {}

	addCommand(command: any) {}

	addSettingTab(tab: any) {}
}

export class App {
	vault: any = {
		adapter: {
			exists: () => Promise.resolve(false),
			stat: () => Promise.resolve(null),
			list: () => Promise.resolve({ files: [], folders: [] }),
			writeBinary: () => Promise.resolve(),
			read: () => Promise.resolve(""),
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		},
		createFolder: () => Promise.resolve(),
		getAbstractFileByPath: () => null,
	};
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl: any = {
		empty: () => {},
		createEl: () => ({ createEl: () => ({}), setText: () => {} }),
	};

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	display() {}
	hide() {}
}

export class Setting {
	settingEl: any = {};
	infoEl: any = {};
	nameEl: any = {};
	descEl: any = {};
	controlEl: any = {};

	constructor(containerEl: any) {}

	setName(name: string) {
		return this;
	}

	setDesc(desc: string) {
		return this;
	}

	addToggle(cb: (toggle: any) => void) {
		cb({
			setValue: () => ({ onChange: () => {} }),
			onChange: () => {},
		});
		return this;
	}

	addText(cb: (text: any) => void) {
		cb({
			setValue: () => ({ onChange: () => {} }),
			setPlaceholder: () => ({ onChange: () => {}, setValue: () => ({}) }),
			onChange: () => {},
		});
		return this;
	}

	addDropdown(cb: (dropdown: any) => void) {
		cb({
			addOption: () => ({ setValue: () => ({ onChange: () => {} }) }),
			setValue: () => ({ onChange: () => {} }),
			onChange: () => {},
		});
		return this;
	}

	addButton(cb: (button: any) => void) {
		cb({
			setButtonText: () => ({ onClick: () => {}, setCta: () => ({}) }),
			setIcon: () => ({ onClick: () => {} }),
			onClick: () => {},
			setCta: () => ({}),
			setWarning: () => ({}),
		});
		return this;
	}

	addSlider(cb: (slider: any) => void) {
		cb({
			setLimits: () => ({ setValue: () => ({ onChange: () => {}, setDynamicTooltip: () => ({}) }) }),
			setValue: () => ({ onChange: () => {} }),
			onChange: () => {},
			setDynamicTooltip: () => ({}),
		});
		return this;
	}

	addTextArea(cb: (textarea: any) => void) {
		cb({
			setValue: () => ({ onChange: () => {} }),
			setPlaceholder: () => ({ onChange: () => {}, setValue: () => ({}) }),
			onChange: () => {},
		});
		return this;
	}

	setClass(cls: string) {
		return this;
	}

	setHeading() {
		return this;
	}

	then(cb: (setting: this) => void) {
		cb(this);
		return this;
	}
}

export class Modal {
	app: App;
	contentEl: any = {
		empty: () => {},
		createEl: () => ({ createEl: () => ({}), setText: () => {} }),
		createDiv: () => ({ createEl: () => ({}), setText: () => {}, addClass: () => {} }),
	};
	titleEl: any = { setText: () => {} };

	constructor(app: App) {
		this.app = app;
	}

	open() {}
	close() {}
	onOpen() {}
	onClose() {}
}

export class TextComponent {
	inputEl: any = {};

	setValue(value: string) {
		return this;
	}

	setPlaceholder(placeholder: string) {
		return this;
	}

	onChange(callback: (value: string) => void) {
		return this;
	}
}

export class ButtonComponent {
	buttonEl: any = {};

	setButtonText(text: string) {
		return this;
	}

	setIcon(icon: string) {
		return this;
	}

	onClick(callback: () => void) {
		return this;
	}

	setCta() {
		return this;
	}

	setWarning() {
		return this;
	}
}

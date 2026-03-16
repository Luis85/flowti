export interface BadgeProps { text: string; color?: string; }
export interface StatCardData { label: string; value: string | number; trend?: string; color?: string; }
export interface SectionProps { title: string; children: HTMLElement | HTMLElement[]; collapsible?: boolean; }
export interface ActionDef { key: string; label: string; }
export interface KeyHintDef { key: string; description: string; }
export interface ListItem { content: HTMLElement; selected?: boolean; }
export interface FormFieldProps { label: string; type: string; value?: string; placeholder?: string; required?: boolean; options?: { value: string; label: string }[]; }

export function createBadge({ text, color }: BadgeProps): HTMLElement {
	const el = document.createElement("span");
	el.className = "tui-badge";
	el.textContent = `[${text}]`;
	if (color) el.style.color = color;
	return el;
}

export function createStatCard({ label, value, trend, color }: StatCardData): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-stat-card";

	const labelEl = document.createElement("div");
	labelEl.className = "tui-stat-card--label";
	labelEl.textContent = label;
	el.appendChild(labelEl);

	const valueEl = document.createElement("div");
	valueEl.className = "tui-stat-card--value";
	valueEl.textContent = String(value);
	if (color) valueEl.style.color = color;
	el.appendChild(valueEl);

	if (trend !== undefined) {
		const trendEl = document.createElement("div");
		trendEl.className = "tui-stat-card--trend";
		trendEl.textContent = trend;
		el.appendChild(trendEl);
	}

	return el;
}

export function createStatGrid(stats: StatCardData[]): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-stat-grid";
	for (const stat of stats) {
		el.appendChild(createStatCard(stat));
	}
	return el;
}

export function createSection({ title, children, collapsible }: SectionProps): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-section";

	const header = document.createElement("div");
	header.className = "tui-section--header";
	if (collapsible) {
		header.dataset.collapsible = "true";
	}

	const body = document.createElement("div");
	body.className = "tui-section--body";

	const childArray = Array.isArray(children) ? children : [children];
	for (const child of childArray) {
		body.appendChild(child);
	}

	if (collapsible) {
		let expanded = true;
		header.textContent = `▼ ${title}`;
		header.addEventListener("click", () => {
			expanded = !expanded;
			header.textContent = `${expanded ? "▼" : "▶"} ${title}`;
			body.style.display = expanded ? "" : "none";
		});
	} else {
		header.textContent = `─ ${title}`;
	}

	el.appendChild(header);
	el.appendChild(body);
	return el;
}

export function createActionBar(actions: ActionDef[]): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-action-bar";
	for (const action of actions) {
		const item = document.createElement("span");
		item.className = "tui-action-bar--item";

		const keyEl = document.createElement("span");
		keyEl.className = "tui-action-bar--key";
		keyEl.textContent = action.key;
		item.appendChild(keyEl);
		item.appendChild(document.createTextNode(" " + action.label));

		el.appendChild(item);
	}
	return el;
}

export function createKeyHints(hints: KeyHintDef[]): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-key-hints";
	for (const hint of hints) {
		const item = document.createElement("span");

		const keyEl = document.createElement("span");
		keyEl.className = "tui-key-hints--key";
		keyEl.textContent = hint.key;
		item.appendChild(keyEl);
		item.appendChild(document.createTextNode(" " + hint.description));

		el.appendChild(item);
	}
	return el;
}

export function createScrollableList(items: ListItem[]): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-list";
	for (const item of items) {
		const row = document.createElement("div");
		row.className = "tui-list--item";
		if (item.selected) row.classList.add("tui-list--item-selected");

		const indicator = document.createElement("span");
		indicator.className = "tui-list--indicator";
		indicator.textContent = item.selected ? "▶" : "";
		row.appendChild(indicator);
		row.appendChild(item.content);

		el.appendChild(row);
	}
	return el;
}

export function createMasterDetail(master: HTMLElement, detail?: HTMLElement, masterWidth?: string): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-master-detail";

	const masterEl = document.createElement("div");
	masterEl.className = "tui-master-detail--master";
	masterEl.style.width = masterWidth ?? "30ch";
	masterEl.appendChild(master);
	el.appendChild(masterEl);

	const detailEl = document.createElement("div");
	detailEl.className = "tui-master-detail--detail";
	if (detail) detailEl.appendChild(detail);
	el.appendChild(detailEl);

	return el;
}

export function createSearchInput({ placeholder, value }: { placeholder: string; value?: string }): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-search-input";

	const icon = document.createElement("span");
	icon.className = "tui-search-input--icon";
	icon.textContent = "🔍";
	el.appendChild(icon);

	if (value) {
		const val = document.createElement("span");
		val.className = "tui-search-input--value";
		val.textContent = value;
		el.appendChild(val);
	} else {
		const ph = document.createElement("span");
		ph.className = "tui-search-input--placeholder";
		ph.textContent = placeholder;
		el.appendChild(ph);
	}

	return el;
}

export function createFormField({ label, type, value, placeholder, required, options }: FormFieldProps): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-form-field";

	const labelEl = document.createElement("span");
	labelEl.className = "tui-form-field--label";
	labelEl.textContent = label;
	if (required) {
		const req = document.createElement("span");
		req.className = "tui-form-field--required";
		req.textContent = " *";
		labelEl.appendChild(req);
	}
	el.appendChild(labelEl);

	if (type === "select" && options) {
		for (const opt of options) {
			const optEl = document.createElement("div");
			const isSelected = value === opt.value;
			optEl.className = isSelected ? "tui-form-field--option tui-form-field--option-selected" : "tui-form-field--option";
			optEl.textContent = (isSelected ? "▶ " : "  ") + opt.label;
			el.appendChild(optEl);
		}
	} else {
		const input = document.createElement("div");
		input.className = "tui-form-field--input";
		if (value) {
			input.textContent = value;
		} else if (placeholder) {
			const ph = document.createElement("span");
			ph.className = "tui-form-field--placeholder";
			ph.textContent = placeholder;
			input.appendChild(ph);
		}
		el.appendChild(input);
	}

	return el;
}

export function text(content: string, opts?: { bold?: boolean; dim?: boolean; color?: string }): HTMLElement {
	const el = document.createElement("span");
	el.className = "tui-text";
	if (opts?.bold) el.classList.add("tui-text--bold");
	if (opts?.dim) el.classList.add("tui-text--dim");
	if (opts?.color) el.style.color = opts.color;
	el.textContent = content;
	return el;
}

export function textLine(content: string, opts?: { bold?: boolean; dim?: boolean; color?: string }): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-text-line";
	if (opts?.bold) el.classList.add("tui-text--bold");
	if (opts?.dim) el.classList.add("tui-text--dim");
	if (opts?.color) el.style.color = opts.color;
	el.textContent = content;
	return el;
}

# Agent Sidepanel Phase B — Child Lit Components

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline rendering in `flowti-agent-sidepanel` with 6 dedicated child Lit components. Each component is independently testable, owns its own CSS, and communicates via `CustomEvent` bubbling.

**Architecture:** Each child extends `FlowtiElement`, uses `static properties` (no decorators), overrides `renderContent()`, and dispatches `CustomEvent` with `{ bubbles: true, composed: true }`. The root component composes children via property binding (`html\`<flowti-agent-roster .agents=\${this.agents}>\``). The handler still talks only to the root component — children bubble events up.

**Tech Stack:** Lit 3.x (`FlowtiElement` base), TypeScript (strict), Vitest + happy-dom. Design tokens from `src/components/tokens.ts`. Shared styles from `src/components/shared-styles.ts`.

**Spec:** `docs/specs/2026-03-18-agent-sidepanel-view-design.md`

**Key references:**
- `src/components/flowti-element.ts` — Base class (loading/error/empty states)
- `src/components/tokens.ts` — Design tokens
- `src/components/shared-styles.ts` — Shared CSS (`statusBadge`, `emptyState`)
- `src/domain/agents/types.ts` — `AgentCard`, `ConversationTurn`, `ConversationMode`
- `src/components/agents/flowti-agent-sidepanel.ts` — Current root (Phase A inline)
- `tests/components/agents/flowti-agent-sidepanel.test.ts` — Existing root tests

**Test pattern:** `// @vitest-environment happy-dom` at top. Import component side-effect, create element, set properties, await `updateComplete`, query `shadowRoot`. See existing sidepanel test for reference.

**Event convention:** All child custom events use `{ bubbles: true, composed: true }` so they cross shadow DOM boundaries. Event names are kebab-case: `agent-selected`, `mode-changed`, `agent-send`, `team-toggled`.

---

## Chunk 1: Roster + Mode Bar + Input Bar (Extract from inline)

### Task 1: `flowti-agent-roster` component

**Files:**
- Create: `src/components/agents/flowti-agent-roster.ts`
- Test: `tests/components/agents/flowti-agent-roster.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/agents/flowti-agent-roster.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-agent-roster.js";

describe("flowti-agent-roster", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-agent-roster") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-agent-roster")).toBeDefined();
	});

	it("renders agent cards for each agent", async () => {
		el.agents = [
			{ name: "atlas", activity: "idle", persona: "Alice" },
			{ name: "scout", activity: "thinking", persona: "Bob" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll("[data-agent]");
		expect(cards.length).toBe(2);
	});

	it("highlights the active agent", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const card = shadow.querySelector("[data-agent='atlas']") as HTMLElement;
		expect(card.classList.contains("agent-card--active")).toBe(true);
	});

	it("dispatches agent-selected on card click", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const card = el.shadowRoot!.querySelector("[data-agent='atlas']") as HTMLElement;
		card.click();
		expect(detail).toEqual({ agent: "atlas" });
	});

	it("dispatches team-toggled on team button click", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("team-toggled", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const teamBtn = el.shadowRoot!.querySelector("[data-action='team-toggle']") as HTMLElement;
		teamBtn.click();
		expect(detail).toEqual({ enabled: true });
	});

	it("shows activity indicator on avatar", async () => {
		el.agents = [{ name: "atlas", activity: "thinking" }];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const avatar = el.shadowRoot!.querySelector(".agent-avatar--thinking");
		expect(avatar).not.toBeNull();
	});

	it("shows mood when available", async () => {
		el.agents = [{ name: "atlas", activity: "idle", mood: "cheerful" }];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("cheerful");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents/flowti-agent-roster.test.ts`

- [ ] **Step 3: Create `src/components/agents/flowti-agent-roster.ts`**

```typescript
// src/components/agents/flowti-agent-roster.ts
import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { statusBadge } from "../shared-styles.js";
import type { AgentCard } from "../../domain/agents/types.js";

export class FlowtiAgentRoster extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agents: { type: Array },
		activeAgent: { type: String },
		teamMode: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		css`
			:host { display: block; flex-shrink: 0; }
			.roster {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				overflow-x: auto;
				border-bottom: 1px solid var(--flowti-border);
			}
			.agent-card {
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				min-width: 64px;
				text-align: center;
				transition: background 0.15s;
			}
			.agent-card:hover { background: var(--background-modifier-hover); }
			.agent-card--active { background: var(--background-modifier-active-hover); }
			.agent-avatar {
				width: 32px; height: 32px;
				border-radius: 50%;
				display: flex; align-items: center; justify-content: center;
				font-weight: 700;
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				border: 2px solid var(--flowti-border);
			}
			.agent-avatar--thinking { border-color: var(--flowti-color-warning); animation: pulse 1.5s infinite; }
			.agent-avatar--speaking { border-color: var(--flowti-color-success); }
			.agent-avatar--using-tool { border-color: var(--flowti-color-info); }
			.agent-name { font-size: 0.75em; margin-top: 2px; }
			.agent-mood { font-size: 0.65em; color: var(--flowti-color-muted); }
			@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
			.team-toggle {
				display: flex; align-items: center; justify-content: center;
				min-width: 48px; padding: var(--flowti-space-xs);
				border-radius: var(--flowti-radius);
				cursor: pointer; border: 1px dashed var(--flowti-border);
				font-size: var(--flowti-font-sm); color: var(--flowti-color-muted);
				background: none; transition: background 0.15s;
			}
			.team-toggle:hover { background: var(--background-modifier-hover); }
			.team-toggle--active { border-color: var(--flowti-color-info); color: var(--flowti-color-info); }
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	teamMode = false;

	protected renderContent() {
		return html`
			<div class="roster">
				${this.agents.map((a) => html`
					<div
						class="agent-card ${a.name === this.activeAgent ? "agent-card--active" : ""}"
						data-agent="${a.name}"
						@click="${() => this.selectAgent(a.name)}"
					>
						<div class="agent-avatar agent-avatar--${a.activity}">
							${(a.persona ?? a.name).charAt(0).toUpperCase()}
						</div>
						<div class="agent-name">${a.persona ?? a.name}</div>
						${a.mood ? html`<div class="agent-mood">${a.mood}</div>` : nothing}
					</div>
				`)}
				<button
					class="team-toggle ${this.teamMode ? "team-toggle--active" : ""}"
					data-action="team-toggle"
					@click="${() => this.toggleTeam()}"
				>Team</button>
			</div>
		`;
	}

	private selectAgent(name: string) {
		this.dispatchEvent(new CustomEvent("agent-selected", { detail: { agent: name }, bubbles: true, composed: true }));
	}

	private toggleTeam() {
		this.dispatchEvent(new CustomEvent("team-toggled", { detail: { enabled: !this.teamMode }, bubbles: true, composed: true }));
	}
}

customElements.define("flowti-agent-roster", FlowtiAgentRoster);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-agent-roster.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-agent-roster.test.ts"
git commit -m "feat(plugin/agents): add flowti-agent-roster child component"
```

---

### Task 2: `flowti-mode-bar` component

**Files:**
- Create: `src/components/agents/flowti-mode-bar.ts`
- Test: `tests/components/agents/flowti-mode-bar.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/agents/flowti-mode-bar.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-mode-bar.js";

describe("flowti-mode-bar", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-mode-bar") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-mode-bar")).toBeDefined();
	});

	it("renders three mode buttons", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const buttons = el.shadowRoot!.querySelectorAll(".mode-btn");
		expect(buttons.length).toBe(3);
	});

	it("highlights active mode", async () => {
		el.activeMode = "document";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const active = el.shadowRoot!.querySelector(".mode-btn--active");
		expect(active?.textContent?.trim()).toBe("Doc");
	});

	it("dispatches mode-changed on button click", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("mode-changed", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const buttons = el.shadowRoot!.querySelectorAll(".mode-btn");
		(buttons[0] as HTMLElement).click();
		expect(detail).toEqual({ mode: "document" });
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents/flowti-mode-bar.test.ts`

- [ ] **Step 3: Create `src/components/agents/flowti-mode-bar.ts`**

```typescript
// src/components/agents/flowti-mode-bar.ts
import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationMode } from "../../domain/agents/types.js";

const modes: { id: ConversationMode; label: string }[] = [
	{ id: "document", label: "Doc" },
	{ id: "conversational", label: "Chat" },
	{ id: "canvas", label: "Canvas" },
];

export class FlowtiModeBar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		activeMode: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: block; flex-shrink: 0; }
			.mode-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}
			.mode-btn {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				background: none; border: none;
				color: var(--flowti-color-muted);
			}
			.mode-btn:hover { background: var(--background-modifier-hover); }
			.mode-btn--active { color: var(--text-normal); background: var(--background-modifier-active-hover); }
		`,
	];

	activeMode: ConversationMode = "conversational";

	protected renderContent() {
		return html`
			<div class="mode-bar">
				${modes.map((m) => html`
					<button
						class="mode-btn ${m.id === this.activeMode ? "mode-btn--active" : ""}"
						@click="${() => this.switchMode(m.id)}"
					>${m.label}</button>
				`)}
			</div>
		`;
	}

	private switchMode(mode: ConversationMode) {
		this.dispatchEvent(new CustomEvent("mode-changed", { detail: { mode }, bubbles: true, composed: true }));
	}
}

customElements.define("flowti-mode-bar", FlowtiModeBar);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-mode-bar.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-mode-bar.test.ts"
git commit -m "feat(plugin/agents): add flowti-mode-bar child component"
```

---

### Task 3: `flowti-input-bar` component

**Files:**
- Create: `src/components/agents/flowti-input-bar.ts`
- Test: `tests/components/agents/flowti-input-bar.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/agents/flowti-input-bar.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-input-bar.js";

describe("flowti-input-bar", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-input-bar") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-input-bar")).toBeDefined();
	});

	it("renders textarea and send button", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("textarea")).not.toBeNull();
		expect(shadow.querySelector("[data-action='send']")).not.toBeNull();
	});

	it("shows agent label", async () => {
		el.agentLabel = "Talking to Alice";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Talking to Alice");
	});

	it("dispatches agent-send on button click", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const textarea = el.shadowRoot!.querySelector("textarea") as HTMLTextAreaElement;
		textarea.value = "hello";
		textarea.dispatchEvent(new Event("input"));
		let detail: unknown = null;
		el.addEventListener("agent-send", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector("[data-action='send']") as HTMLElement;
		btn.click();
		expect(detail).toEqual({ message: "hello" });
	});

	it("disables send when processing", async () => {
		el.processing = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = el.shadowRoot!.querySelector("[data-action='send']") as HTMLButtonElement;
		expect(btn.textContent?.trim()).toBe("Stop");
	});

	it("dispatches agent-stop when processing and button clicked", async () => {
		el.processing = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let fired = false;
		el.addEventListener("agent-stop", () => { fired = true; });
		const btn = el.shadowRoot!.querySelector("[data-action='send']") as HTMLElement;
		btn.click();
		expect(fired).toBe(true);
	});

	it("auto-grows textarea on input", async () => {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const textarea = el.shadowRoot!.querySelector("textarea") as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();
		// Textarea has min-height and max-height styles
		expect(textarea.style.minHeight || textarea.getAttribute("style")).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents/flowti-input-bar.test.ts`

- [ ] **Step 3: Create `src/components/agents/flowti-input-bar.ts`**

```typescript
// src/components/agents/flowti-input-bar.ts
import { html, css } from "lit";
import { FlowtiElement } from "../flowti-element.js";

export class FlowtiInputBar extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agentLabel: { type: String },
		processing: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: block; flex-shrink: 0; }
			.agent-label {
				font-size: 0.7em;
				color: var(--flowti-color-muted);
				padding: 0 var(--flowti-space-sm);
			}
			.input-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				border-top: 1px solid var(--flowti-border);
			}
			textarea {
				flex: 1;
				resize: none;
				min-height: 36px;
				max-height: 120px;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
				font-size: var(--flowti-font-sm);
				overflow-y: auto;
			}
			button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: none;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				align-self: flex-end;
			}
			button:disabled { opacity: 0.5; cursor: default; }
		`,
	];

	agentLabel = "";
	processing = false;
	private inputText = "";

	protected renderContent() {
		return html`
			${this.agentLabel ? html`<div class="agent-label">${this.agentLabel}</div>` : ""}
			<div class="input-bar">
				<textarea
					placeholder="Type a message..."
					.value="${this.inputText}"
					@input="${this.onInput}"
					@keydown="${this.onKeydown}"
				></textarea>
				<button
					data-action="send"
					?disabled="${!this.inputText.trim() && !this.processing}"
					@click="${this.onButtonClick}"
				>${this.processing ? "Stop" : "Send"}</button>
			</div>
		`;
	}

	private onInput(e: Event) {
		this.inputText = (e.target as HTMLTextAreaElement).value;
		const textarea = e.target as HTMLTextAreaElement;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
		this.requestUpdate();
	}

	private onKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			this.send();
		}
	}

	private onButtonClick() {
		if (this.processing) {
			this.dispatchEvent(new CustomEvent("agent-stop", { bubbles: true, composed: true }));
		} else {
			this.send();
		}
	}

	private send() {
		const message = this.inputText.trim();
		if (!message) return;
		this.dispatchEvent(new CustomEvent("agent-send", { detail: { message }, bubbles: true, composed: true }));
		this.inputText = "";
		this.requestUpdate();
	}
}

customElements.define("flowti-input-bar", FlowtiInputBar);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-input-bar.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-input-bar.test.ts"
git commit -m "feat(plugin/agents): add flowti-input-bar child component with auto-grow"
```

---

## Chunk 2: Conversation Modes (3 mode views)

### Task 4: `flowti-conversational-mode` component

**Files:**
- Create: `src/components/agents/flowti-conversational-mode.ts`
- Test: `tests/components/agents/flowti-conversational-mode.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/agents/flowti-conversational-mode.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-conversational-mode.js";

describe("flowti-conversational-mode", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-conversational-mode") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-conversational-mode")).toBeDefined();
	});

	it("renders conversation turns", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "Hello", timestamp: "", mode: "conversational" },
			{ id: "2", role: "agent", agentName: "atlas", persona: "Alice", content: "Hi!", timestamp: "", mode: "conversational" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Hello");
		expect(shadow.textContent).toContain("Hi!");
	});

	it("shows agent name on agent turns", async () => {
		el.turns = [
			{ id: "1", role: "agent", agentName: "atlas", persona: "Alice", content: "Hi", timestamp: "", mode: "conversational" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Alice");
	});

	it("renders user turns with right alignment class", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "Hello", timestamp: "", mode: "conversational" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const userTurn = el.shadowRoot!.querySelector(".turn--user");
		expect(userTurn).not.toBeNull();
	});

	it("shows thinking indicator when agent is thinking", async () => {
		el.turns = [
			{ id: "1", role: "agent", agentName: "atlas", content: "thinking...", thinking: "Let me consider", timestamp: "", mode: "conversational" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const thinking = el.shadowRoot!.querySelector(".turn__thinking");
		expect(thinking).not.toBeNull();
	});

	it("renders empty state when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Start a conversation");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents/flowti-conversational-mode.test.ts`

- [ ] **Step 3: Create `src/components/agents/flowti-conversational-mode.ts`**

```typescript
// src/components/agents/flowti-conversational-mode.ts
import { html, css, nothing } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationTurn } from "../../domain/agents/types.js";

export class FlowtiConversationalMode extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		turns: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
			.conversation {
				flex: 1;
				overflow-y: auto;
				padding: var(--flowti-space-sm);
			}
			.empty-hint {
				display: flex; align-items: center; justify-content: center;
				height: 100%; color: var(--flowti-color-muted); font-size: var(--flowti-font-sm);
			}
			.turn { margin-bottom: var(--flowti-space-sm); }
			.turn--user { text-align: right; }
			.turn--agent { text-align: left; }
			.turn__bubble {
				display: inline-block;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				max-width: 85%;
				text-align: left;
				font-size: var(--flowti-font-sm);
				word-wrap: break-word;
			}
			.turn--user .turn__bubble { background: var(--interactive-accent); color: var(--text-on-accent); }
			.turn--agent .turn__bubble { background: var(--background-secondary); }
			.turn__name { font-size: 0.7em; color: var(--flowti-color-muted); margin-bottom: 2px; }
			.turn__thinking {
				font-size: 0.75em; color: var(--flowti-color-muted); font-style: italic;
				padding: 2px var(--flowti-space-sm); margin-bottom: 2px;
			}
		`,
	];

	turns: ConversationTurn[] = [];

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = false;
	}

	protected updated(): void {
		const container = this.shadowRoot?.querySelector(".conversation");
		if (container) container.scrollTop = container.scrollHeight;
	}

	protected renderContent() {
		if (this.turns.length === 0) {
			return html`<div class="conversation"><div class="empty-hint">Start a conversation</div></div>`;
		}
		return html`
			<div class="conversation">
				${this.turns.map((t) => this.renderTurn(t))}
			</div>
		`;
	}

	private renderTurn(turn: ConversationTurn) {
		return html`
			<div class="turn turn--${turn.role}">
				${turn.role === "agent" ? html`<div class="turn__name">${turn.persona ?? turn.agentName ?? "Agent"}</div>` : nothing}
				${turn.thinking ? html`<div class="turn__thinking">${turn.thinking}</div>` : nothing}
				<div class="turn__bubble">${turn.content}</div>
			</div>
		`;
	}
}

customElements.define("flowti-conversational-mode", FlowtiConversationalMode);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-conversational-mode.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-conversational-mode.test.ts"
git commit -m "feat(plugin/agents): add flowti-conversational-mode with auto-scroll"
```

---

### Task 5: `flowti-document-mode` component

**Files:**
- Create: `src/components/agents/flowti-document-mode.ts`
- Test: `tests/components/agents/flowti-document-mode.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/agents/flowti-document-mode.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-document-mode.js";

describe("flowti-document-mode", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-document-mode") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-document-mode")).toBeDefined();
	});

	it("renders turns in document format", async () => {
		el.turns = [
			{ id: "1", role: "agent", agentName: "atlas", persona: "Alice", content: "Here is my analysis.", timestamp: "2026-03-18T12:00:00Z", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Here is my analysis");
	});

	it("shows tool calls in collapsible details", async () => {
		el.turns = [
			{
				id: "1", role: "agent", agentName: "atlas", content: "Done.",
				toolCalls: [{ id: "t1", name: "read_file", status: "completed" }],
				timestamp: "", mode: "document",
			},
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const details = el.shadowRoot!.querySelector("details");
		expect(details).not.toBeNull();
		expect(el.shadowRoot!.textContent).toContain("read_file");
	});

	it("shows thinking in expandable section", async () => {
		el.turns = [
			{
				id: "1", role: "agent", agentName: "atlas", content: "Result",
				thinking: "Let me analyze this...",
				timestamp: "", mode: "document",
			},
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const thinkingDetails = el.shadowRoot!.querySelector(".doc-thinking");
		expect(thinkingDetails).not.toBeNull();
		expect(el.shadowRoot!.textContent).toContain("Let me analyze");
	});

	it("renders empty state when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("document");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents/flowti-document-mode.test.ts`

- [ ] **Step 3: Create `src/components/agents/flowti-document-mode.ts`**

```typescript
// src/components/agents/flowti-document-mode.ts
import { html, css, nothing } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationTurn } from "../../domain/agents/types.js";

export class FlowtiDocumentMode extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		turns: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
			.document {
				flex: 1; overflow-y: auto;
				padding: var(--flowti-space-md);
			}
			.empty-hint {
				display: flex; align-items: center; justify-content: center;
				height: 100%; color: var(--flowti-color-muted); font-size: var(--flowti-font-sm);
			}
			.doc-entry {
				margin-bottom: var(--flowti-space-md);
				padding-bottom: var(--flowti-space-md);
				border-bottom: 1px solid var(--flowti-border);
			}
			.doc-entry:last-child { border-bottom: none; }
			.doc-header {
				display: flex; align-items: center; gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-xs);
				font-size: 0.75em; color: var(--flowti-color-muted);
			}
			.doc-role { font-weight: 600; }
			.doc-content {
				font-size: var(--flowti-font-sm);
				line-height: 1.5;
				white-space: pre-wrap;
			}
			.doc-thinking {
				margin-top: var(--flowti-space-xs);
				font-size: 0.8em; color: var(--flowti-color-muted);
			}
			.doc-thinking summary {
				cursor: pointer; font-style: italic;
			}
			.doc-thinking-content {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				margin-top: var(--flowti-space-xs);
				border-left: 2px solid var(--flowti-border);
				font-style: italic;
			}
			details {
				margin-top: var(--flowti-space-xs);
				font-size: 0.8em;
			}
			details summary {
				cursor: pointer; color: var(--flowti-color-info);
			}
			.tool-list {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				margin-top: var(--flowti-space-xs);
			}
			.tool-item {
				font-family: var(--flowti-font-mono);
				font-size: 0.85em;
				padding: 2px 0;
			}
			.tool-item--completed { color: var(--flowti-color-success); }
			.tool-item--started { color: var(--flowti-color-warning); }
		`,
	];

	turns: ConversationTurn[] = [];

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = false;
	}

	protected renderContent() {
		if (this.turns.length === 0) {
			return html`<div class="document"><div class="empty-hint">Send a message in document mode</div></div>`;
		}
		return html`
			<div class="document">
				${this.turns.map((t) => this.renderEntry(t))}
			</div>
		`;
	}

	private renderEntry(turn: ConversationTurn) {
		const name = turn.role === "agent" ? (turn.persona ?? turn.agentName ?? "Agent") : "You";
		return html`
			<div class="doc-entry">
				<div class="doc-header">
					<span class="doc-role">${name}</span>
					${turn.timestamp ? html`<span>${new Date(turn.timestamp).toLocaleTimeString()}</span>` : nothing}
				</div>
				${turn.thinking ? html`
					<details class="doc-thinking">
						<summary>Thinking...</summary>
						<div class="doc-thinking-content">${turn.thinking}</div>
					</details>
				` : nothing}
				${turn.toolCalls?.length ? html`
					<details>
						<summary>${turn.toolCalls.length} tool call${turn.toolCalls.length > 1 ? "s" : ""}</summary>
						<div class="tool-list">
							${turn.toolCalls.map((tc) => html`
								<div class="tool-item tool-item--${tc.status}">${tc.name} (${tc.status})</div>
							`)}
						</div>
					</details>
				` : nothing}
				<div class="doc-content">${turn.content}</div>
			</div>
		`;
	}
}

customElements.define("flowti-document-mode", FlowtiDocumentMode);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-document-mode.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-document-mode.test.ts"
git commit -m "feat(plugin/agents): add flowti-document-mode with tool calls and thinking"
```

---

### Task 6: `flowti-canvas-mode` component

**Files:**
- Create: `src/components/agents/flowti-canvas-mode.ts`
- Test: `tests/components/agents/flowti-canvas-mode.test.ts`

**Canvas mode behavior:**
- Creates `.canvas` JSON files at `.flowti/canvas/agent-{name}-{timestamp}.canvas`
- Canvas JSON format: `{ nodes: [...], edges: [...] }`
- Each turn becomes a node: `{ id, type: "text", x, y, width, height, text, color }`
- User turns → blue nodes, Agent turns → green nodes
- Component manages its own layout (simple vertical stack, 200px spacing)
- File I/O deferred to an `ICanvasWriter` interface (implemented outside component)

- [ ] **Step 1: Write failing test**

```typescript
// tests/components/agents/flowti-canvas-mode.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../../../src/components/agents/flowti-canvas-mode.js";

describe("flowti-canvas-mode", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-canvas-mode") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-canvas-mode")).toBeDefined();
	});

	it("renders canvas placeholder when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("canvas");
	});

	it("renders canvas preview with turn nodes", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "Hello", timestamp: "", mode: "canvas" },
			{ id: "2", role: "agent", agentName: "atlas", content: "Hi!", timestamp: "", mode: "canvas" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const nodes = el.shadowRoot!.querySelectorAll(".canvas-node");
		expect(nodes.length).toBe(2);
	});

	it("generates canvas JSON from turns", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "Hello", timestamp: "", mode: "canvas" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const component = el as unknown as { getCanvasJson(): string };
		const json = JSON.parse(component.getCanvasJson());
		expect(json.nodes).toHaveLength(1);
		expect(json.nodes[0].type).toBe("text");
		expect(json.nodes[0].text).toBe("Hello");
	});

	it("dispatches canvas-export event on export button click", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "Hello", timestamp: "", mode: "canvas" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("canvas-export", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const btn = el.shadowRoot!.querySelector("[data-action='export-canvas']") as HTMLElement;
		if (btn) btn.click();
		expect(detail).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents/flowti-canvas-mode.test.ts`

- [ ] **Step 3: Create `src/components/agents/flowti-canvas-mode.ts`**

```typescript
// src/components/agents/flowti-canvas-mode.ts
import { html, css } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { ConversationTurn } from "../../domain/agents/types.js";

interface CanvasNode {
	id: string;
	type: "text";
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	color: string;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide: "bottom";
	toSide: "top";
}

export class FlowtiCanvasMode extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		turns: { type: Array },
		agentName: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
			.canvas-view {
				flex: 1; overflow-y: auto;
				padding: var(--flowti-space-md);
			}
			.empty-hint {
				display: flex; align-items: center; justify-content: center;
				height: 100%; color: var(--flowti-color-muted); font-size: var(--flowti-font-sm);
			}
			.canvas-toolbar {
				display: flex; justify-content: flex-end;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
			}
			.canvas-toolbar button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: 1px solid var(--flowti-border);
				background: none; cursor: pointer;
				font-size: var(--flowti-font-sm); color: var(--text-normal);
			}
			.canvas-toolbar button:hover { background: var(--background-modifier-hover); }
			.canvas-preview {
				display: flex; flex-direction: column; gap: var(--flowti-space-sm);
			}
			.canvas-node {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
				border-radius: var(--flowti-radius);
				font-size: var(--flowti-font-sm);
				word-wrap: break-word;
				border-left: 3px solid;
			}
			.canvas-node--user { border-color: var(--interactive-accent); background: color-mix(in srgb, var(--interactive-accent) 10%, transparent); }
			.canvas-node--agent { border-color: var(--flowti-color-success); background: color-mix(in srgb, var(--flowti-color-success) 10%, transparent); }
			.canvas-edge {
				width: 2px; height: 12px;
				margin-left: 24px;
				background: var(--flowti-border);
			}
		`,
	];

	turns: ConversationTurn[] = [];
	agentName = "";

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = false;
	}

	protected renderContent() {
		if (this.turns.length === 0) {
			return html`<div class="canvas-view"><div class="empty-hint">Send a message in canvas mode</div></div>`;
		}
		return html`
			<div class="canvas-toolbar">
				<button data-action="export-canvas" @click="${this.exportCanvas}">Export .canvas</button>
			</div>
			<div class="canvas-view">
				<div class="canvas-preview">
					${this.turns.map((t, i) => html`
						${i > 0 ? html`<div class="canvas-edge"></div>` : ""}
						<div class="canvas-node canvas-node--${t.role}">${t.content}</div>
					`)}
				</div>
			</div>
		`;
	}

	getCanvasJson(): string {
		const nodes: CanvasNode[] = this.turns.map((t, i) => ({
			id: t.id,
			type: "text" as const,
			x: 0,
			y: i * 200,
			width: 400,
			height: 150,
			text: t.content,
			color: t.role === "user" ? "1" : "4",
		}));

		const edges: CanvasEdge[] = [];
		for (let i = 1; i < nodes.length; i++) {
			edges.push({
				id: `edge-${nodes[i - 1].id}-${nodes[i].id}`,
				fromNode: nodes[i - 1].id,
				toNode: nodes[i].id,
				fromSide: "bottom",
				toSide: "top",
			});
		}

		return JSON.stringify({ nodes, edges });
	}

	private exportCanvas() {
		const canvasJson = this.getCanvasJson();
		this.dispatchEvent(new CustomEvent("canvas-export", {
			detail: { json: canvasJson, agentName: this.agentName },
			bubbles: true,
			composed: true,
		}));
	}
}

customElements.define("flowti-canvas-mode", FlowtiCanvasMode);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-canvas-mode.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-canvas-mode.test.ts"
git commit -m "feat(plugin/agents): add flowti-canvas-mode with preview and export"
```

---

## Chunk 3: Refactor Root Component + Quality Gate

### Task 7: Refactor `flowti-agent-sidepanel` to compose children

**Files:**
- Modify: `src/components/agents/flowti-agent-sidepanel.ts`
- Modify: `tests/components/agents/flowti-agent-sidepanel.test.ts`

This is the key refactoring step. The root component drops all inline CSS and rendering methods, replacing them with child component composition. The handler doesn't change.

- [ ] **Step 1: Rewrite `src/components/agents/flowti-agent-sidepanel.ts`**

```typescript
// src/components/agents/flowti-agent-sidepanel.ts
/**
 * Root Lit component for the Agent Sidepanel.
 * Composes child components: roster → mode bar → active mode → input bar.
 * Phase B: delegates all rendering to child Lit components.
 */

import { html, css } from "lit";
import type { PropertyValues } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import type { AgentCard, ConversationTurn, ConversationMode } from "../../domain/agents/types.js";

// Side-effect imports to register child custom elements
import "./flowti-agent-roster.js";
import "./flowti-mode-bar.js";
import "./flowti-conversational-mode.js";
import "./flowti-document-mode.js";
import "./flowti-canvas-mode.js";
import "./flowti-input-bar.js";

export class FlowtiAgentSidepanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agents: { type: Array },
		activeAgent: { type: String },
		activeMode: { type: String },
		turns: { type: Array },
		teamMode: { type: Boolean },
		processing: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	activeMode: ConversationMode = "conversational";
	turns: ConversationTurn[] = [];
	teamMode = false;
	processing = false;

	protected willUpdate(changed: PropertyValues): void {
		super.willUpdate(changed);
		this.isEmpty = this.agents.length === 0;
		if (this.isEmpty) {
			this.emptyMessage = "No agents available. Start the CLI server with 'flowti serve'.";
		}
	}

	protected renderContent() {
		const activeCard = this.agents.find((a) => a.name === this.activeAgent);
		const label = this.teamMode
			? "Talking to team"
			: `Talking to ${activeCard?.persona ?? this.activeAgent}`;

		return html`
			<flowti-agent-roster
				.agents="${this.agents}"
				.activeAgent="${this.activeAgent}"
				.teamMode="${this.teamMode}"
			></flowti-agent-roster>
			<flowti-mode-bar
				.activeMode="${this.activeMode}"
			></flowti-mode-bar>
			${this.renderActiveMode()}
			<flowti-input-bar
				.agentLabel="${label}"
				.processing="${this.processing}"
			></flowti-input-bar>
		`;
	}

	private renderActiveMode() {
		switch (this.activeMode) {
			case "document":
				return html`<flowti-document-mode .turns="${this.turns}"></flowti-document-mode>`;
			case "canvas":
				return html`<flowti-canvas-mode .turns="${this.turns}" .agentName="${this.activeAgent}"></flowti-canvas-mode>`;
			case "conversational":
			default:
				return html`<flowti-conversational-mode .turns="${this.turns}"></flowti-conversational-mode>`;
		}
	}
}

customElements.define("flowti-agent-sidepanel", FlowtiAgentSidepanel);
```

- [ ] **Step 2: Update tests**

```typescript
// tests/components/agents/flowti-agent-sidepanel.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";

describe("flowti-agent-sidepanel", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-agent-sidepanel")).toBeDefined();
	});

	it("renders empty state when no agents", async () => {
		el.agents = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No agents");
	});

	it("composes child components when agents provided", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-agent-roster")).not.toBeNull();
		expect(shadow.querySelector("flowti-mode-bar")).not.toBeNull();
		expect(shadow.querySelector("flowti-conversational-mode")).not.toBeNull();
		expect(shadow.querySelector("flowti-input-bar")).not.toBeNull();
	});

	it("switches mode view based on activeMode", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.activeMode = "document";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.querySelector("flowti-document-mode")).not.toBeNull();
		expect(shadow.querySelector("flowti-conversational-mode")).toBeNull();
	});

	it("renders canvas mode when activeMode is canvas", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		el.activeMode = "canvas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.querySelector("flowti-canvas-mode")).not.toBeNull();
	});

	it("bubbles agent-selected from roster", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const roster = el.shadowRoot!.querySelector("flowti-agent-roster") as HTMLElement;
		roster?.dispatchEvent(new CustomEvent("agent-selected", { detail: { agent: "atlas" }, bubbles: true, composed: true }));
		expect(detail).toEqual({ agent: "atlas" });
	});

	it("bubbles agent-send from input bar", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-send", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const inputBar = el.shadowRoot!.querySelector("flowti-input-bar") as HTMLElement;
		inputBar?.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "hello" }, bubbles: true, composed: true }));
		expect(detail).toEqual({ message: "hello" });
	});
});
```

- [ ] **Step 3: Run all agent tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents tests/infrastructure/handlers/agent-handlers.test.ts tests/domain/agents tests/infrastructure/agents`

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/flowti-agent-sidepanel.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-agent-sidepanel.test.ts"
git commit -m "refactor(plugin/agents): compose child Lit components in root sidepanel"
```

---

### Task 8: Quality gate

- [ ] **Step 1: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit -skipLibCheck`

- [ ] **Step 2: Run lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/components/agents/ src/domain/agents/`

- [ ] **Step 3: Run full agent test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents tests/infrastructure/handlers/agent-handlers.test.ts tests/domain/agents tests/infrastructure/agents`

Expected: All tests pass (6 component test files + 3 infra/domain).

- [ ] **Step 4: Fix any issues and commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/components/agents/" "01 - Projects/Flowti Plugin/tests/components/agents/"
git commit -m "fix(plugin/agents): Phase B quality gate fixes"
```

---

## Summary

| Task | Component | Lines (est.) | Tests |
|------|-----------|-------------|-------|
| 1 | `flowti-agent-roster` | ~100 | 7 |
| 2 | `flowti-mode-bar` | ~60 | 4 |
| 3 | `flowti-input-bar` | ~100 | 7 |
| 4 | `flowti-conversational-mode` | ~90 | 5 |
| 5 | `flowti-document-mode` | ~120 | 4 |
| 6 | `flowti-canvas-mode` | ~120 | 4 |
| 7 | Root refactor | ~80 (rewrite) | 7 (updated) |
| 8 | Quality gate | — | full suite |
| **Total** | **6 new + 1 rewritten** | **~670** | **~38 new** |

**Phase B deliverables:**
- 6 independently testable child Lit components
- Root component reduced from 262 lines to ~80 (composition only)
- All inline CSS extracted to owning components
- Document mode: rich view with tool calls, thinking sections
- Canvas mode: preview + export to `.canvas` JSON format
- Input bar: auto-grow textarea, send/stop toggle
- All events bubble through shadow DOM via `composed: true`

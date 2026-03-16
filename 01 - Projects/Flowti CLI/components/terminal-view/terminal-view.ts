export interface TerminalViewProps {
	title?: string;
	width?: number;
	showTitleBar?: boolean;
}

export function createTerminalView(props: TerminalViewProps = {}): HTMLElement {
	const title = props.title ?? "Terminal";
	const width = props.width ?? 80;
	const showTitleBar = props.showTitleBar ?? true;

	const el = document.createElement("div");
	el.className = "terminal-view";
	el.style.width = width + "ch";

	if (showTitleBar) {
		const titleBar = document.createElement("div");
		titleBar.className = "terminal-view--title-bar";

		const dots = document.createElement("span");
		dots.className = "terminal-view--dots";
		for (const color of ["#ff5f56", "#ffbd2e", "#27c93f"]) {
			const dot = document.createElement("span");
			dot.className = "terminal-view--dot";
			dot.style.backgroundColor = color;
			dots.appendChild(dot);
		}
		titleBar.appendChild(dots);

		const titleText = document.createElement("span");
		titleText.className = "terminal-view--title";
		titleText.textContent = title;
		titleBar.appendChild(titleText);

		el.appendChild(titleBar);
	}

	const content = document.createElement("div");
	content.className = "terminal-view--content";
	el.appendChild(content);

	return el;
}

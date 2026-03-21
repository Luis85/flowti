import { html, LitElement, css } from "lit";

export class FtProcessLog extends LitElement {
	static properties = { lines: { type: Array } };

	static styles = css`
		pre {
			margin: 0;
			font-size: 11px;
			line-height: 1.35;
			max-height: 200px;
			overflow: auto;
			padding: 8px;
			background: var(--background-secondary, #262626);
			border-radius: 4px;
			white-space: pre-wrap;
			word-break: break-word;
		}
	`;

	lines: string[] = [];

	render() {
		return html`<pre>${this.lines.join("\n")}</pre>`;
	}
}

if (!customElements.get("ft-process-log")) customElements.define("ft-process-log", FtProcessLog);

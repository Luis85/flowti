/** Dark theme panel styles injected as a <style> element on first panel open. */

let injected = false;

const CSS = `
.agent-panel {
	position: absolute;
	z-index: 1000;
	width: 360px;
	max-height: 480px;
	background: #1e293b;
	border: 1px solid #334155;
	border-radius: 8px;
	color: #e2e8f0;
	font-family: 'Segoe UI', system-ui, sans-serif;
	font-size: 13px;
	display: flex;
	flex-direction: column;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	overflow: hidden;
}

.agent-panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 14px;
	border-bottom: 1px solid #334155;
	background: #0f172a;
}

.agent-panel-header-name {
	font-weight: 600;
	font-size: 14px;
}

.agent-panel-header-type {
	font-size: 11px;
	color: #94a3b8;
	margin-left: 8px;
}

.agent-panel-close {
	background: none;
	border: none;
	color: #94a3b8;
	font-size: 16px;
	cursor: pointer;
	padding: 2px 6px;
	border-radius: 4px;
}

.agent-panel-close:hover {
	background: #334155;
	color: #e2e8f0;
}

.agent-panel-info {
	padding: 10px 14px;
	border-bottom: 1px solid #334155;
}

.agent-panel-info-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 6px;
}

.agent-panel-info-item {
	text-align: center;
	padding: 4px;
	background: #0f172a;
	border-radius: 4px;
}

.agent-panel-info-label {
	font-size: 10px;
	color: #64748b;
	text-transform: uppercase;
}

.agent-panel-info-value {
	font-size: 14px;
	font-weight: 600;
}

.agent-panel-meta {
	display: flex;
	gap: 12px;
	margin-top: 8px;
	font-size: 12px;
	color: #94a3b8;
}

.agent-panel-tabs {
	display: flex;
	border-bottom: 1px solid #334155;
	background: #0f172a;
}

.agent-panel-tab {
	flex: 1;
	padding: 8px 4px;
	background: none;
	border: none;
	border-bottom: 2px solid transparent;
	color: #64748b;
	font-size: 12px;
	cursor: pointer;
	text-align: center;
}

.agent-panel-tab:hover {
	color: #94a3b8;
}

.agent-panel-tab[data-active="true"] {
	color: #38bdf8;
	border-bottom-color: #38bdf8;
}

.agent-panel-content {
	flex: 1;
	overflow-y: auto;
	padding: 10px 14px;
	min-height: 120px;
	max-height: 280px;
}

.agent-panel-talk-thread {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-bottom: 10px;
}

.agent-panel-talk-turn {
	padding: 6px 10px;
	border-radius: 6px;
	font-size: 12px;
	line-height: 1.4;
}

.agent-panel-talk-turn[data-sender="user"] {
	background: #1e3a5f;
	align-self: flex-end;
	max-width: 85%;
}

.agent-panel-talk-turn[data-sender="agent"] {
	background: #334155;
	align-self: flex-start;
	max-width: 85%;
}

.agent-panel-talk-input {
	display: flex;
	gap: 6px;
	margin-top: auto;
}

.agent-panel-talk-input input {
	flex: 1;
	padding: 6px 10px;
	background: #0f172a;
	border: 1px solid #334155;
	border-radius: 4px;
	color: #e2e8f0;
	font-size: 12px;
	outline: none;
}

.agent-panel-talk-input input:focus {
	border-color: #38bdf8;
}

.agent-panel-talk-input button {
	padding: 6px 14px;
	background: #2563eb;
	border: none;
	border-radius: 4px;
	color: #e2e8f0;
	font-size: 12px;
	cursor: pointer;
}

.agent-panel-talk-input button:hover {
	background: #3b82f6;
}

.agent-panel-task-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6px 0;
	border-bottom: 1px solid #1e293b;
}

.agent-panel-task-badge {
	font-size: 10px;
	padding: 2px 6px;
	border-radius: 3px;
	text-transform: uppercase;
	font-weight: 600;
}

.agent-panel-task-badge[data-status="pending"] {
	background: #854d0e;
	color: #fbbf24;
}

.agent-panel-task-badge[data-status="in-progress"] {
	background: #1e3a5f;
	color: #38bdf8;
}

.agent-panel-task-badge[data-status="completed"] {
	background: #14532d;
	color: #4ade80;
}

.agent-panel-task-assign {
	margin-top: 12px;
	padding-top: 10px;
	border-top: 1px solid #334155;
}

.agent-panel-task-assign-title {
	font-size: 11px;
	color: #94a3b8;
	margin-bottom: 6px;
	text-transform: uppercase;
}

.agent-panel-assign-btn {
	padding: 4px 10px;
	background: #2563eb;
	border: none;
	border-radius: 4px;
	color: #e2e8f0;
	font-size: 11px;
	cursor: pointer;
	margin: 2px 4px 2px 0;
}

.agent-panel-assign-btn:hover {
	background: #3b82f6;
}

.agent-panel-permission-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 0;
	border-bottom: 1px solid #1e293b;
}

.agent-panel-permission-tool {
	font-weight: 600;
}

.agent-panel-permission-actions {
	display: flex;
	gap: 4px;
}

.agent-panel-permission-allow {
	padding: 3px 10px;
	background: #166534;
	border: none;
	border-radius: 4px;
	color: #4ade80;
	font-size: 11px;
	cursor: pointer;
}

.agent-panel-permission-deny {
	padding: 3px 10px;
	background: #7f1d1d;
	border: none;
	border-radius: 4px;
	color: #f87171;
	font-size: 11px;
	cursor: pointer;
}

.agent-panel-history-item {
	padding: 6px 0;
	border-bottom: 1px solid #1e293b;
	font-size: 12px;
}

.agent-panel-history-time {
	color: #64748b;
	font-size: 10px;
}

.agent-panel-history-summary {
	margin-top: 2px;
}

.agent-panel-grant-history {
	margin-top: 12px;
	padding-top: 10px;
	border-top: 1px solid #334155;
}

.agent-panel-grant-title {
	font-size: 11px;
	color: #94a3b8;
	margin-bottom: 6px;
	text-transform: uppercase;
}

.agent-panel-grant-item {
	font-size: 11px;
	padding: 4px 0;
	color: #94a3b8;
}

.agent-panel-empty {
	color: #64748b;
	font-style: italic;
	text-align: center;
	padding: 20px 0;
}

.agent-panel-talk-thinking {
	color: #94a3b8;
	font-style: italic;
}

.thinking-dots span {
	animation: thinking-bounce 1.4s infinite ease-in-out;
	display: inline-block;
	font-size: 18px;
	line-height: 1;
}

.thinking-dots span:nth-child(1) { animation-delay: 0s; }
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-bounce {
	0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
	40% { opacity: 1; transform: translateY(-4px); }
}

.agent-panel-confirm-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1001;
	border-radius: 8px;
}

.agent-panel-confirm-dialog {
	background: #1e293b;
	border: 1px solid #334155;
	border-radius: 8px;
	padding: 20px;
	text-align: center;
	max-width: 280px;
}

.agent-panel-confirm-buttons {
	display: flex;
	gap: 8px;
	justify-content: center;
	margin-top: 12px;
}
`;

export function injectPanelStyles(): void {
	if (injected) return;
	const style = document.createElement("style");
	style.setAttribute("data-agent-panel", "true");
	style.textContent = CSS;
	document.head.appendChild(style);
	injected = true;
}

export function resetStyleInjection(): void {
	injected = false;
}

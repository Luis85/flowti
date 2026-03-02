/**
 * DOM highlighting helpers for E2E test screenshots.
 *
 * Injects CSS animations and applies highlight classes to elements
 * before test actions, making interactions visible in screenshots.
 *
 * All manipulation happens through cli.eval() — no direct DOM access.
 *
 * Colors:
 *   - Input focus:    blue glow (#4fc3f7)
 *   - Button hover:   orange pulse (#ffb74d)
 *   - Generic:        green outline (#81c784)
 *   - Ribbon:         purple pulse (#ce93d8)
 *   - Assert pass:    gold outline (#ffd54f)
 *   - Assert fail:    red outline (#ef5350)
 *   - WebView:        cyan glow (#26c6da) — injected into webview content
 */
import type { ObsidianCli } from "../../../src/infrastructure/cli/ObsidianCli";

const E2E_STYLE_ID = "flowti-e2e-highlight-styles";

const HIGHLIGHT_CSS = `
.ft-e2e-highlight-input {
  outline: 3px solid #4fc3f7 !important;
  box-shadow: 0 0 12px 4px rgba(79, 195, 247, 0.5) !important;
  transition: box-shadow 0.3s ease;
}
.ft-e2e-highlight-button {
  outline: 3px solid #ffb74d !important;
  box-shadow: 0 0 12px 4px rgba(255, 183, 77, 0.5) !important;
  animation: ft-e2e-pulse 0.6s ease-in-out 2 !important;
}
.ft-e2e-highlight-element {
  outline: 3px solid #81c784 !important;
  box-shadow: 0 0 10px 3px rgba(129, 199, 132, 0.4) !important;
}
.ft-e2e-highlight-ribbon {
  outline: 3px solid #ce93d8 !important;
  box-shadow: 0 0 14px 5px rgba(206, 147, 216, 0.6) !important;
  animation: ft-e2e-pulse 0.6s ease-in-out 2 !important;
  border-radius: 4px;
}
.ft-e2e-highlight-assert-pass {
  outline: 3px solid #ffd54f !important;
  box-shadow: 0 0 12px 4px rgba(255, 213, 79, 0.5) !important;
}
.ft-e2e-highlight-assert-fail {
  outline: 3px solid #ef5350 !important;
  box-shadow: 0 0 12px 4px rgba(239, 83, 80, 0.5) !important;
  animation: ft-e2e-pulse 0.6s ease-in-out 2 !important;
}
@keyframes ft-e2e-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
`.trim();

/**
 * Injects the E2E highlight CSS into Obsidian's DOM.
 * Safe to call multiple times — skips if already injected.
 */
export function injectHighlightStyles(cli: ObsidianCli): void {
	cli.eval([
		`if (!document.getElementById('${E2E_STYLE_ID}')) {`,
		`  const s = document.createElement('style');`,
		`  s.id = '${E2E_STYLE_ID}';`,
		`  s.textContent = ${JSON.stringify(HIGHLIGHT_CSS)};`,
		`  document.head.appendChild(s);`,
		`}`,
	].join(" "));
}

/**
 * Highlights an input element: focuses it and adds a blue glow.
 * The highlight persists until clearHighlights() is called,
 * or auto-removes after `duration` ms if specified.
 */
export function highlightInput(cli: ObsidianCli, selector: string, duration?: number): void {
	const escaped = selector.replace(/'/g, "\\'");
	const cls = "ft-e2e-highlight-input";
	const autoRemove = duration ? ` setTimeout(() => el.classList.remove('${cls}'), ${duration});` : "";
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('${cls}'); el.focus();${autoRemove} }`,
		`})()`,
	].join(" "));
}

/**
 * Highlights a button element: adds an orange pulse animation.
 * Scrolls into view if the element is outside the visible area.
 * The highlight persists until clearHighlights() is called,
 * or auto-removes after `duration` ms if specified.
 */
export function highlightButton(cli: ObsidianCli, selector: string, duration?: number): void {
	const escaped = selector.replace(/'/g, "\\'");
	const cls = "ft-e2e-highlight-button";
	const autoRemove = duration ? ` setTimeout(() => el.classList.remove('${cls}'), ${duration});` : "";
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('${cls}');${autoRemove} }`,
		`})()`,
	].join(" "));
}

/**
 * Highlights any element by selector: adds a green outline.
 * Scrolls into view if the element is outside the visible area.
 * Auto-removes after `duration` ms if specified.
 */
export function highlightElement(cli: ObsidianCli, selector: string, duration?: number): void {
	const escaped = selector.replace(/'/g, "\\'");
	const cls = "ft-e2e-highlight-element";
	const autoRemove = duration ? ` setTimeout(() => el.classList.remove('${cls}'), ${duration});` : "";
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('${cls}');${autoRemove} }`,
		`})()`,
	].join(" "));
}

/**
 * Highlights a ribbon button by aria-label: adds a purple pulse animation.
 * Finds the button via case-insensitive partial aria-label match,
 * scrolls into view, applies the highlight class, and dispatches a
 * full pointer event sequence (pointerdown → pointerup → click).
 * Returns the matched aria-label for logging.
 */
export function highlightRibbon(cli: ObsidianCli, label: string): string {
	const escaped = label.replace(/'/g, "\\'");
	const result = cli.eval([
		`(() => {`,
		`  const needle = '${escaped}'.toLowerCase();`,
		`  const actions = document.querySelectorAll('.side-dock-ribbon-action');`,
		`  let el = null;`,
		`  for (const a of actions) {`,
		`    const lbl = (a.getAttribute('aria-label') || '').toLowerCase();`,
		`    if (lbl.includes(needle)) { el = a; break; }`,
		`  }`,
		`  if (!el) throw new Error('No ribbon button matching aria-label *=' + '${escaped}');`,
		`  el.scrollIntoView({ behavior: 'smooth', block: 'center' });`,
		`  el.classList.add('ft-e2e-highlight-ribbon');`,
		`  const rect = el.getBoundingClientRect();`,
		`  const cx = rect.left + rect.width / 2;`,
		`  const cy = rect.top + rect.height / 2;`,
		`  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy }));`,
		`  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy }));`,
		`  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));`,
		`  return el.getAttribute('aria-label') || '${escaped}';`,
		`})()`,
	].join(" "));
	if (!result.success) {
		throw new Error(`Ribbon '${label}' failed: ${result.error}`);
	}
	return result.value;
}

/** Auto-remove delay: pass highlights fade quickly, fail highlights linger. */
const ASSERT_HIGHLIGHT_DURATION_PASS = 800;
const ASSERT_HIGHLIGHT_DURATION_FAIL = 800;

/**
 * Highlights a DOM element with pass/fail assertion styling.
 * Pass: gold outline (300ms). Fail: red outline with pulse (500ms).
 * Scrolls into view and shows a brief notice with the result.
 */
export function highlightAssert(
	cli: ObsidianCli,
	selector: string,
	passed: boolean,
	label: string,
): void {
	const escaped = selector.replace(/'/g, "\\'");
	const cls = passed ? "ft-e2e-highlight-assert-pass" : "ft-e2e-highlight-assert-fail";
	const duration = passed ? ASSERT_HIGHLIGHT_DURATION_PASS : ASSERT_HIGHLIGHT_DURATION_FAIL;
	cli.eval([
		`(() => {`,
		`  const el = document.querySelector('${escaped}');`,
		`  if (el) {`,
		`    el.scrollIntoView({ behavior: 'smooth', block: 'center' });`,
		`    el.classList.add('${cls}');`,
		`    setTimeout(() => el.classList.remove('${cls}'), ${duration});`,
		`  }`,
		`})()`,
	].join(" "));
	const icon = passed ? "\u2713" : "\u2717";
	const escapedLabel = label.replace(/'/g, "\\'");
	cli.eval(`new Notice('${icon} ${escapedLabel}', ${passed ? 2000 : 4000})`);
}

/**
 * Shows an assertion result notice (no DOM element to highlight).
 * Used for event, eval, and other non-DOM assertions.
 */
export function notifyAssert(
	cli: ObsidianCli,
	passed: boolean,
	label: string,
): void {
	const icon = passed ? "\u2713" : "\u2717";
	const escapedLabel = label.replace(/'/g, "\\'");
	cli.eval(`new Notice('${icon} ${escapedLabel}', ${passed ? 2000 : 4000})`);
}

/**
 * Removes all highlight classes from all elements.
 */
export function clearHighlights(cli: ObsidianCli): void {
	cli.eval(
		"document.querySelectorAll('.ft-e2e-highlight-input,.ft-e2e-highlight-button,.ft-e2e-highlight-element,.ft-e2e-highlight-ribbon,.ft-e2e-highlight-assert-pass,.ft-e2e-highlight-assert-fail').forEach(el => { el.classList.remove('ft-e2e-highlight-input','ft-e2e-highlight-button','ft-e2e-highlight-element','ft-e2e-highlight-ribbon','ft-e2e-highlight-assert-pass','ft-e2e-highlight-assert-fail'); })",
	);
}

// ── WebView Highlight (cross-process via webview.executeJavaScript) ──

const WEBVIEW_HIGHLIGHT_CSS = `
.ft-e2e-wv-highlight {
  outline: 3px solid #26c6da !important;
  box-shadow: 0 0 14px 5px rgba(38, 198, 218, 0.6) !important;
  animation: ft-e2e-wv-pulse 0.6s ease-in-out 2 !important;
  position: relative;
  z-index: 99999;
}
@keyframes ft-e2e-wv-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
`.trim().replace(/\n/g, " ");

/**
 * Highlights an element inside the active Electron webview.
 * Injects highlight CSS into the webview's DOM (idempotent), then
 * applies the highlight class to the matched element.
 *
 * Color: cyan (#26c6da) — distinct from main-DOM highlights.
 */
export function highlightWebView(cli: ObsidianCli, selector: string, duration?: number): void {
	const escaped = selector.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
	const cssEscaped = WEBVIEW_HIGHLIGHT_CSS.replace(/'/g, "\\'");
	const autoRemove = duration
		? `setTimeout(() => el.classList.remove('ft-e2e-wv-highlight'), ${duration});`
		: "";

	const result = cli.eval([
		`(async () => {`,
		`  const wv = document.querySelector('webview');`,
		`  if (!wv) throw new Error('No webview element found');`,
		`  await wv.executeJavaScript(\``,
		`    (() => {`,
		`      if (!document.getElementById('ft-e2e-wv-styles')) {`,
		`        const s = document.createElement('style');`,
		`        s.id = 'ft-e2e-wv-styles';`,
		`        s.textContent = '${cssEscaped}';`,
		`        document.head.appendChild(s);`,
		`      }`,
		`      const el = document.querySelector('${escaped}');`,
		`      if (el) {`,
		`        el.scrollIntoView({ behavior: 'smooth', block: 'center' });`,
		`        el.classList.add('ft-e2e-wv-highlight');`,
		`        ${autoRemove}`,
		`        return 'highlighted';`,
		`      }`,
		`      return 'not-found';`,
		`    })()`,
		`  \`);`,
		`  return 'ok';`,
		`})()`,
	].join(" "));

	if (!result.success) {
		// Non-fatal: webview highlight failure should not block the step
		console.warn(`[e2e] WebView highlight failed for '${selector}': ${result.error}`);
	}
}

/**
 * Clears all highlight classes inside the active Electron webview.
 */
export function clearWebViewHighlights(cli: ObsidianCli): void {
	cli.eval([
		`(async () => {`,
		`  const wv = document.querySelector('webview');`,
		`  if (!wv) return 'no-webview';`,
		`  await wv.executeJavaScript(\``,
		`    document.querySelectorAll('.ft-e2e-wv-highlight').forEach(el => el.classList.remove('ft-e2e-wv-highlight'))`,
		`  \`);`,
		`  return 'cleared';`,
		`})()`,
	].join(" "));
}

/**
 * Test utilities for Lit components in happy-dom.
 *
 * Usage:
 *   const el = await fixture<MyElement>('my-element', { prop: 'value' });
 *   expect(el.shadowRoot?.textContent).toContain('value');
 *   cleanup();
 */

/**
 * Create and mount a Lit component, wait for first render.
 */
export async function fixture<T extends HTMLElement>(
	tag: string,
	props?: Record<string, unknown>,
): Promise<T> {
	const el = document.createElement(tag) as T;
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			(el as Record<string, unknown>)[key] = value;
		}
	}
	document.body.appendChild(el);
	// Wait for Lit's updateComplete if available
	if ('updateComplete' in el) {
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
	}
	return el;
}

/**
 * Remove all test fixtures from the DOM.
 */
export function cleanup(): void {
	document.body.innerHTML = '';
}

/**
 * Query inside a component's shadow root.
 */
export function shadowQuery<T extends Element>(
	el: HTMLElement,
	selector: string,
): T | null {
	return el.shadowRoot?.querySelector<T>(selector) ?? null;
}

/**
 * Query all inside a component's shadow root.
 */
export function shadowQueryAll<T extends Element>(
	el: HTMLElement,
	selector: string,
): T[] {
	return Array.from(el.shadowRoot?.querySelectorAll<T>(selector) ?? []);
}

/**
 * Get visible text content from a component's shadow root.
 */
export function shadowText(el: HTMLElement): string {
	return el.shadowRoot?.textContent?.trim() ?? '';
}

/**
 * Dispatch a custom event and return whether it was handled.
 */
export function dispatch(
	el: HTMLElement,
	eventName: string,
	detail?: unknown,
): boolean {
	return el.dispatchEvent(
		new CustomEvent(eventName, { detail, bubbles: true, composed: true }),
	);
}

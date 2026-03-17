type Props = Record<string, unknown>;

/** Set properties on an HTMLElement (typically a Lit component). */
export function setProps(el: HTMLElement, props: Props): void {
	for (const [key, value] of Object.entries(props)) {
		(el as unknown as Props)[key] = value;
	}
}

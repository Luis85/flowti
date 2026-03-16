/**
 * form-page.tsx — Generic form page pattern.
 *
 * Renders a vertical list of FormFields with Tab navigation between fields.
 * Used by scaffold, make, capture, publish pages.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { FormField } from "../primitives/form-field.js";
import type { FormFieldProps } from "../primitives/form-field.js";

export interface FormFieldDef {
	readonly name: string;
	readonly label: string;
	readonly type: "text" | "select" | "toggle";
	readonly options?: readonly string[];
	readonly required?: boolean;
	readonly placeholder?: string;
}

interface FormPageProps {
	readonly title: string;
	readonly fields: readonly FormFieldDef[];
	readonly values: Readonly<Record<string, string | boolean>>;
	readonly onValueChange: (name: string, value: string | boolean) => void;
	readonly onSubmit: () => void;
	readonly onCancel: () => void;
	readonly enabled?: boolean;
}

export function FormPage({ title, fields, values, onValueChange, onSubmit, onCancel, enabled = true }: FormPageProps): React.JSX.Element {
	const [focusedField, setFocusedField] = useState(0);

	useInput((input, key) => {
		if (!enabled) return;
		if (key.downArrow || (key.tab && !key.shift)) {
			setFocusedField((f) => Math.min(f + 1, fields.length - 1));
		}
		if (key.upArrow || (key.tab && key.shift)) {
			setFocusedField((f) => Math.max(f - 1, 0));
		}
		if (key.return) {
			const field = fields[focusedField];
			if (field.type === "toggle") {
				onValueChange(field.name, !values[field.name]);
			} else if (focusedField === fields.length - 1) {
				onSubmit();
			}
		}
		if (key.escape) onCancel();

		const field = fields[focusedField];
		if (field?.type === "text" && input && !key.ctrl && !key.meta) {
			if (key.backspace || key.delete) {
				const current = String(values[field.name] ?? "");
				onValueChange(field.name, current.slice(0, -1));
			} else if (input.length === 1) {
				const current = String(values[field.name] ?? "");
				onValueChange(field.name, current + input);
			}
		}

		if (field?.type === "select" && field.options) {
			if (key.leftArrow || key.rightArrow) {
				const current = String(values[field.name] ?? field.options[0]);
				const idx = field.options.indexOf(current);
				const next = key.rightArrow
					? field.options[(idx + 1) % field.options.length]
					: field.options[(idx - 1 + field.options.length) % field.options.length];
				onValueChange(field.name, next);
			}
		}
	});

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			<Text bold color="cyan">{title}</Text>
			<Box flexDirection="column" marginTop={1}>
				{fields.map((field, i) => {
					const val = values[field.name];
					const fieldProps: FormFieldProps = field.type === "toggle"
						? { type: "toggle", label: field.label, value: Boolean(val), focused: i === focusedField }
						: field.type === "select"
							? { type: "select", label: field.label, value: String(val ?? field.options?.[0] ?? ""), options: field.options ?? [], focused: i === focusedField }
							: { type: "text", label: field.label, value: String(val ?? ""), placeholder: field.placeholder, focused: i === focusedField };
					return <FormField key={field.name} {...fieldProps} />;
				})}
			</Box>
			<Box marginTop={1}>
				<Text dimColor>Enter submit | Esc cancel | Tab next field</Text>
			</Box>
		</Box>
	);
}

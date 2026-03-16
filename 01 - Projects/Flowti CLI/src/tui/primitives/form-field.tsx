/**
 * form-field.tsx — Form input field supporting text, select, and toggle types.
 */

import React from "react";
import { Box, Text } from "ink";

interface FormFieldBaseProps {
	readonly label: string;
	readonly focused?: boolean;
	readonly error?: string;
}

interface TextFieldProps extends FormFieldBaseProps {
	readonly type: "text";
	readonly value: string;
	readonly placeholder?: string;
}

interface SelectFieldProps extends FormFieldBaseProps {
	readonly type: "select";
	readonly value: string;
	readonly options: readonly string[];
}

interface ToggleFieldProps extends FormFieldBaseProps {
	readonly type: "toggle";
	readonly value: boolean;
}

export type FormFieldProps = TextFieldProps | SelectFieldProps | ToggleFieldProps;

export function FormField(props: FormFieldProps): React.JSX.Element {
	const { label, focused, error } = props;
	const indicator = focused ? "\u25B6 " : "  ";

	let valueDisplay: React.ReactNode;
	switch (props.type) {
		case "text":
			valueDisplay = <Text>{props.value || props.placeholder || ""}{focused ? "\u2588" : ""}</Text>;
			break;
		case "select":
			valueDisplay = <Text>{props.value}</Text>;
			break;
		case "toggle":
			valueDisplay = <Text color={props.value ? "green" : "red"}>{props.value ? "Yes" : "No"}</Text>;
			break;
	}

	return (
		<Box>
			<Text color={focused ? "cyan" : undefined} bold={focused}>{indicator}{label}: </Text>
			{valueDisplay}
			{error !== undefined && <Text color="red"> {error}</Text>}
		</Box>
	);
}

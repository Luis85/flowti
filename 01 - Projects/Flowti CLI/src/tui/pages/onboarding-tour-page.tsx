/**
 * onboarding-tour-page.tsx — Inline onboarding tour renderer.
 *
 * Renders the current tour step based on type (narrate, prompt, auto, delegate, checkpoint).
 * Progress bar at top, step content in middle, footer with Enter hint.
 * All steps rendered inline — no page navigation during the tour.
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { registerPage } from "./page-registry.js";
import { useTuiContext } from "../context.js";
import { useLoaderContext } from "../context.js";
import { useLoader } from "../hooks/use-loader.js";
import { loadOnboardingTour } from "../loaders/onboarding-tour-loader.js";
import { advanceProgress } from "../../domain/onboarding/tour-engine.js";
import { writeProgress, createInitialProgress } from "../../domain/onboarding/onboarding-store.js";
import { markOnboardingComplete } from "../../domain/onboarding/onboarding-detection.js";
import { FormField } from "../primitives/form-field.js";
import type { PageProps } from "../types.js";

function ProgressBar({ current, total }: { current: number; total: number }): React.JSX.Element {
	const filled = total > 0 ? Math.round((current / total) * 20) : 0;
	const bar = "\u2501".repeat(filled) + "\u2591".repeat(20 - filled);
	return (
		<Box paddingX={1} marginBottom={1}>
			<Text dimColor>Step {current + 1} of {total} </Text>
			<Text color="cyan">{bar}</Text>
		</Box>
	);
}

function OnboardingTourPage({ params, navigate, enabled }: PageProps): React.JSX.Element {
	const tui = useTuiContext();
	const ctx = useLoaderContext(params);
	const tourData = loadOnboardingTour(ctx);

	const [inputValue, setInputValue] = useState("");
	const [inputError, setInputError] = useState("");
	const [autoStatus, setAutoStatus] = useState<"idle" | "running" | "done" | "error">("idle");
	const [autoMessage, setAutoMessage] = useState("");

	const handleAdvance = useCallback((newContext?: Record<string, string>) => {
		if (!tourData.tour || !tourData.progress) return;
		const step = tourData.tour.steps[tourData.stepIndex];
		if (!step) return;

		const updated = advanceProgress(tourData.progress, step.id, newContext);
		writeProgress(tui.vaultRoot, updated, tui.deps);

		// Check if tour is complete
		if (updated.currentStepIndex >= tourData.totalSteps) {
			markOnboardingComplete(tui.vaultRoot, tui.deps);
			navigate("start");
			return;
		}

		// Reset input state for next step
		setInputValue("");
		setInputError("");
		setAutoStatus("idle");
		setAutoMessage("");
	}, [tourData, tui, navigate]);

	useInput((input, key) => {
		if (!enabled) return;
		if (!tourData.stepResult) return;

		const { kind } = tourData.stepResult;

		if (kind === "prompt") {
			if (key.return) {
				const trimmed = inputValue.trim();
				if (tourData.stepResult.validation === "non-empty" && trimmed === "") {
					setInputError("This field is required");
					return;
				}
				setInputError("");
				handleAdvance({ [tourData.stepResult.field]: trimmed });
				return;
			}
			if (key.backspace || key.delete) {
				setInputValue((v) => v.slice(0, -1));
				return;
			}
			if (input && !key.ctrl && !key.meta && input.length === 1) {
				setInputValue((v) => v + input);
			}
			return;
		}

		if (kind === "narrate" || kind === "checkpoint") {
			if (key.return) {
				handleAdvance();
			}
			return;
		}

		if (kind === "auto") {
			if (autoStatus === "done" || autoStatus === "error") {
				if (key.return) handleAdvance();
			}
			return;
		}

		if (kind === "complete") {
			if (key.return) {
				markOnboardingComplete(tui.vaultRoot, tui.deps);
				navigate("start");
			}
		}
	}, { isActive: enabled });

	// Auto step: run action on first render
	React.useEffect(() => {
		if (tourData.stepResult?.kind !== "auto" || autoStatus !== "idle") return;
		setAutoStatus("running");
		setAutoMessage(`Running ${tourData.stepResult.action}...`);
		// Auto actions complete immediately in the TUI (domain functions are sync)
		setAutoStatus("done");
		setAutoMessage(`${tourData.stepResult.action} completed`);
	}, [tourData.stepResult, autoStatus]);

	if (tourData.error) {
		return (
			<Box flexDirection="column" paddingX={1}>
				<Text color="red">{tourData.error}</Text>
			</Box>
		);
	}

	if (!tourData.stepResult) {
		return <Text dimColor>Loading tour...</Text>;
	}

	const { stepResult } = tourData;

	return (
		<Box flexDirection="column" flexGrow={1}>
			<ProgressBar current={tourData.stepIndex} total={tourData.totalSteps} />
			<Box flexDirection="column" flexGrow={1} paddingX={1}>
				{stepResult.kind === "narrate" && (
					<Box flexDirection="column">
						<Text color="cyan" bold>{stepResult.speaker}</Text>
						<Box marginTop={1}><Text wrap="wrap">{stepResult.content}</Text></Box>
					</Box>
				)}
				{stepResult.kind === "prompt" && (
					<Box flexDirection="column">
						<Text wrap="wrap">{stepResult.content}</Text>
						<Box marginTop={1}>
							<FormField type="text" label={stepResult.field} value={inputValue} focused error={inputError || undefined} />
						</Box>
					</Box>
				)}
				{stepResult.kind === "auto" && (
					<Box flexDirection="column">
						<Text wrap="wrap">{stepResult.content}</Text>
						<Box marginTop={1}>
							{autoStatus === "running" && <Text color="yellow">{autoMessage}</Text>}
							{autoStatus === "done" && <Text color="green">{"\u2714"} {autoMessage}</Text>}
							{autoStatus === "error" && <Text color="red">{"\u2718"} {autoMessage}</Text>}
						</Box>
					</Box>
				)}
				{stepResult.kind === "checkpoint" && (
					<Box flexDirection="column">
						<Text color="green" bold>{"\u2714"} {stepResult.label}</Text>
						<Box marginTop={1}><Text wrap="wrap">{stepResult.content}</Text></Box>
						{stepResult.completedSteps.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								{stepResult.completedSteps.map((s) => (
									<Text key={s} color="green">  {"\u2714"} {s}</Text>
								))}
							</Box>
						)}
					</Box>
				)}
				{stepResult.kind === "delegate" && (
					<Box flexDirection="column">
						<Text wrap="wrap">{stepResult.hintsContent ?? "Complete this section to continue."}</Text>
						<Box marginTop={1}>
							<Text dimColor>This step is simplified in the tour. Full features available after onboarding.</Text>
						</Box>
					</Box>
				)}
				{stepResult.kind === "complete" && (
					<Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
						<Text color="green" bold>Onboarding Complete!</Text>
						<Text dimColor>Press Enter to start using Flowti.</Text>
					</Box>
				)}
			</Box>
			<Box paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
				{stepResult.kind === "prompt"
					? <Text dimColor>Enter Submit</Text>
					: stepResult.kind === "auto" && autoStatus === "running"
						? <Text dimColor>Please wait...</Text>
						: <Text dimColor>Enter Continue</Text>
				}
			</Box>
		</Box>
	);
}

registerPage("onboarding-tour", OnboardingTourPage);

/**
 * ISO compliance characteristic definitions.
 *
 * Static data — 19 characteristics across 3 standards:
 *   ISO 9001 (6) — Quality Management
 *   ISO 27001 (5) — Information Security
 *   ISO 25010 (8) — Software Quality
 */

import type { ComplianceCharacteristic, IsoStandard } from "./types";

export const COMPLIANCE_CHARACTERISTICS: ComplianceCharacteristic[] = [
	// ── ISO 9001: Quality Management ─────────────────────────
	{
		id: "iso-9001:customer-focus",
		standard: "iso-9001",
		name: "Customer Focus",
		description: "Ensure primary focus on meeting customer requirements and enhancing satisfaction.",
		guidance: "Tag journeys that validate end-user workflows, onboarding flows, or user acceptance scenarios.",
	},
	{
		id: "iso-9001:leadership",
		standard: "iso-9001",
		name: "Leadership",
		description: "Establish unity of purpose and direction through leadership engagement.",
		guidance: "Tag journeys that validate administrative controls, role management, or governance workflows.",
	},
	{
		id: "iso-9001:process-approach",
		standard: "iso-9001",
		name: "Process Approach",
		description: "Manage activities as interrelated processes that function as a coherent system.",
		guidance: "Tag journeys that validate cross-feature workflows, data pipelines, or multi-step processes.",
	},
	{
		id: "iso-9001:evidence-based-decisions",
		standard: "iso-9001",
		name: "Evidence-Based Decisions",
		description: "Base decisions on the analysis and evaluation of data and information.",
		guidance: "Tag journeys that validate analytics, reporting, dashboard data accuracy, or metric computation.",
	},
	{
		id: "iso-9001:continuous-improvement",
		standard: "iso-9001",
		name: "Continuous Improvement",
		description: "Make continual improvement an ongoing objective of the organization.",
		guidance: "Tag journeys that validate feedback loops, retrospective outputs, or improvement tracking.",
	},
	{
		id: "iso-9001:risk-based-thinking",
		standard: "iso-9001",
		name: "Risk-Based Thinking",
		description: "Address risks and opportunities to prevent or reduce undesired effects.",
		guidance: "Tag journeys that validate error handling, fallback behavior, or graceful degradation.",
	},

	// ── ISO 27001: Information Security ──────────────────────
	{
		id: "iso-27001:access-control",
		standard: "iso-27001",
		name: "Access Control",
		description: "Ensure authorized access to information and prevent unauthorized access.",
		guidance: "Tag journeys that validate authentication, authorization, secret storage, or permission checks.",
	},
	{
		id: "iso-27001:data-classification",
		standard: "iso-27001",
		name: "Data Classification",
		description: "Classify information based on legal requirements, value, and sensitivity.",
		guidance: "Tag journeys that validate data labeling, privacy settings, or sensitive field handling.",
	},
	{
		id: "iso-27001:incident-management",
		standard: "iso-27001",
		name: "Incident Management",
		description: "Manage information security incidents efficiently and consistently.",
		guidance: "Tag journeys that validate error reporting, diagnostics, health monitoring, or alert systems.",
	},
	{
		id: "iso-27001:business-continuity",
		standard: "iso-27001",
		name: "Business Continuity",
		description: "Prepare for, respond to, and recover from disruptions.",
		guidance: "Tag journeys that validate backup/restore, state recovery, migration, or offline capability.",
	},
	{
		id: "iso-27001:compliance-monitoring",
		standard: "iso-27001",
		name: "Compliance Monitoring",
		description: "Ensure adherence to regulatory, contractual, and internal requirements.",
		guidance: "Tag journeys that validate audit trails, event logging, traceability, or compliance checks.",
	},

	// ── ISO 25010: Software Quality ──────────────────────────
	{
		id: "iso-25010:functional-suitability",
		standard: "iso-25010",
		name: "Functional Suitability",
		description: "Degree to which the product provides functions that meet stated and implied needs.",
		guidance: "Tag journeys that validate core feature correctness, completeness, and appropriateness.",
	},
	{
		id: "iso-25010:performance-efficiency",
		standard: "iso-25010",
		name: "Performance Efficiency",
		description: "Performance relative to resources used under stated conditions.",
		guidance: "Tag journeys that validate response times, resource usage, or throughput under load.",
	},
	{
		id: "iso-25010:compatibility",
		standard: "iso-25010",
		name: "Compatibility",
		description: "Degree to which the product can exchange information with other products.",
		guidance: "Tag journeys that validate import/export, API integration, or cross-plugin interoperability.",
	},
	{
		id: "iso-25010:usability",
		standard: "iso-25010",
		name: "Usability",
		description: "Degree to which the product can be used by specified users to achieve specified goals.",
		guidance: "Tag journeys that validate user onboarding, discoverability, error prevention, or accessibility.",
	},
	{
		id: "iso-25010:reliability",
		standard: "iso-25010",
		name: "Reliability",
		description: "Degree to which the product performs specified functions under stated conditions for a specified period.",
		guidance: "Tag journeys that validate fault tolerance, recoverability, or maturity of error handling.",
	},
	{
		id: "iso-25010:security",
		standard: "iso-25010",
		name: "Security",
		description: "Degree to which information and data are protected from unauthorized access.",
		guidance: "Tag journeys that validate data protection, confidentiality, integrity, or non-repudiation.",
	},
	{
		id: "iso-25010:maintainability",
		standard: "iso-25010",
		name: "Maintainability",
		description: "Degree of effectiveness and efficiency with which the product can be modified.",
		guidance: "Tag journeys that validate configuration, extensibility, modularity, or refactoring outcomes.",
	},
	{
		id: "iso-25010:portability",
		standard: "iso-25010",
		name: "Portability",
		description: "Degree of effectiveness and efficiency with which the product can be transferred between environments.",
		guidance: "Tag journeys that validate installation, adaptability, or cross-environment deployment.",
	},
];

/** Returns characteristics filtered by ISO standard. */
export function getCharacteristicsByStandard(standard: IsoStandard): ComplianceCharacteristic[] {
	return COMPLIANCE_CHARACTERISTICS.filter((c) => c.standard === standard);
}

/** Returns a single characteristic by its ID. */
export function getCharacteristicById(id: string): ComplianceCharacteristic | undefined {
	return COMPLIANCE_CHARACTERISTICS.find((c) => c.id === id);
}

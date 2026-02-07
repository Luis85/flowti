/**
 * Flowti Data Dictionary
 *
 * Zentrales Glossar aller Domänenbegriffe gemäß IREB-Empfehlungen.
 * Jeder Begriff hat:
 * - Eindeutige ID (TERM-xxx)
 * - Definition
 * - Synonyme (optional)
 * - Referenzen zu verwandten Begriffen
 *
 * @see https://www.ireb.org/ - International Requirements Engineering Board
 */

// ─────────────────────────────────────────────────────────────────────────────
// Dictionary Term Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DictionaryTerm {
	/** Unique term identifier (TERM-xxx format) */
	readonly id: string;
	/** Clear, unambiguous definition */
	readonly definition: string;
	/** Alternative names for this term */
	readonly synonyms?: readonly string[];
	/** Related terms in the dictionary */
	readonly relatedTerms?: readonly string[];
	/** Allowed values (for enumerated terms) */
	readonly values?: readonly string[];
	/** Concrete examples */
	readonly examples?: readonly string[];
	/** Format specification (for technical terms) */
	readonly format?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Dictionary
// ─────────────────────────────────────────────────────────────────────────────

export const DATA_DICTIONARY = {
	// ─────────────────────────────────────────────────────────────
	// Core Entities
	// ─────────────────────────────────────────────────────────────

	Solution: {
		id: "TERM-001",
		definition:
			"Eine abgeschlossene Einheit, die ein Problem löst oder einen Wert schafft. " +
			"Kann ein Produkt, Prozess, Service oder andere Lösungsart sein.",
		synonyms: ["Project", "Initiative"],
		relatedTerms: ["SolutionType", "LifecyclePhase"],
	},

	SolutionType: {
		id: "TERM-002",
		definition:
			"Kategorisierung einer Solution nach ihrer Natur. " +
			"Bestimmt welche Deliverables und Phasen relevant sind.",
		values: [
			"Application",
			"Process",
			"Service",
			"Product",
			"Capability",
			"Data",
			"Tool",
			"Organization",
			"Policy",
		],
		relatedTerms: ["Solution", "Deliverable"],
	},

	LifecyclePhase: {
		id: "TERM-003",
		definition:
			"Eine definierte Phase im Lebenszyklus einer Solution. " +
			"Jede Phase hat spezifische Deliverables und Acceptance Criteria.",
		values: [
			"Ideate",
			"Design",
			"Validate",
			"Develop",
			"Test",
			"Release",
			"Run",
			"Measure",
			"Learn",
		],
		relatedTerms: ["Solution", "Deliverable", "Gate"],
	},

	Deliverable: {
		id: "TERM-004",
		definition:
			"Ein konkretes Arbeitsergebnis einer Lifecycle-Phase. " +
			"Kann ein Dokument, Artefakt oder messbares Ergebnis sein.",
		examples: ["Problem Statement", "Architecture Diagram", "Test Report"],
		relatedTerms: ["LifecyclePhase", "AcceptanceCriteria"],
	},

	AcceptanceCriteria: {
		id: "TERM-005",
		definition:
			"Messbare Bedingungen, die erfüllt sein müssen, damit ein Deliverable " +
			"als vollständig akzeptiert wird.",
		examples: [
			"All unit tests pass",
			"Code review approved",
			"Stakeholder sign-off",
		],
		relatedTerms: ["Deliverable", "Gate"],
	},

	Gate: {
		id: "TERM-006",
		definition:
			"Ein Entscheidungspunkt zwischen Lifecycle-Phasen. " +
			"Prüft ob alle Deliverables einer Phase die Acceptance Criteria erfüllen.",
		synonyms: ["Phase Gate", "Quality Gate", "Decision Point"],
		relatedTerms: ["LifecyclePhase", "AcceptanceCriteria"],
	},

	// ─────────────────────────────────────────────────────────────
	// Solution Types - Detailed Definitions
	// ─────────────────────────────────────────────────────────────

	Application: {
		id: "TERM-020",
		definition:
			"Softwarebasierte Lösung wie Web-Apps, Tools, Plattformen oder SaaS-Produkte.",
		examples: ["Plugin", "Mobile App", "Desktop Software", "Web Platform"],
		relatedTerms: ["SolutionType", "Product"],
	},

	Process: {
		id: "TERM-021",
		definition:
			"Business- oder operative Prozesse, die definieren wie Arbeit ausgeführt wird.",
		examples: [
			"Order-to-Cash",
			"Incident Management",
			"Onboarding Process",
		],
		relatedTerms: ["SolutionType", "Service"],
	},

	Service: {
		id: "TERM-022",
		definition:
			"Kunden- oder intern-orientierte Dienstleistungen, die kontinuierlichen Wert liefern.",
		examples: [
			"Customer Support Service",
			"Maintenance Service",
			"Consulting Service",
		],
		relatedTerms: ["SolutionType", "Process"],
	},

	Product: {
		id: "TERM-023",
		definition:
			"Marktorientiertes Angebot, das Applications, Services und Prozesse kombiniert.",
		examples: ["SaaS Product", "Digital Product", "Hybrid Product"],
		relatedTerms: ["SolutionType", "Application", "Service"],
	},

	Capability: {
		id: "TERM-024",
		definition:
			"Organisatorische Fähigkeit, die Menschen, Prozesse und Tools kombiniert.",
		examples: [
			"Data Analytics Capability",
			"DevOps Capability",
			"AI/ML Capability",
		],
		relatedTerms: ["SolutionType", "Organization"],
	},

	Data: {
		id: "TERM-025",
		definition:
			"Daten, Analytics und Informationsprodukte, die Entscheidungen unterstützen.",
		examples: ["Data Product", "KPI Dashboard", "Master Data Domain"],
		relatedTerms: ["SolutionType", "Tool"],
	},

	Tool: {
		id: "TERM-026",
		definition:
			"Unterstützende Systeme oder Plattformen, die Arbeit ermöglichen.",
		examples: [
			"ERP Customization",
			"CI/CD Toolchain",
			"Monitoring System",
		],
		relatedTerms: ["SolutionType", "Application"],
	},

	Organization: {
		id: "TERM-027",
		definition:
			"Organisationsstrukturen, Teams und Governance-Modelle.",
		examples: ["Team Setup", "Operating Model", "Role Model"],
		relatedTerms: ["SolutionType", "Capability"],
	},

	Policy: {
		id: "TERM-028",
		definition:
			"Regeln, Standards und Policies, die Verhalten und Entscheidungen leiten.",
		examples: ["Security Policy", "Coding Standards", "Quality Policy"],
		relatedTerms: ["SolutionType", "Process"],
	},

	// ─────────────────────────────────────────────────────────────
	// Traceability
	// ─────────────────────────────────────────────────────────────

	UUID: {
		id: "TERM-010",
		definition:
			"Universally Unique Identifier. " +
			"Eindeutige ID für Traceability über den gesamten Lifecycle.",
		format: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
	},

	Frontmatter: {
		id: "TERM-011",
		definition:
			"YAML-Metadaten am Anfang einer Markdown-Datei. " +
			"Enthält strukturierte Attribute wie ID, Type, Phase.",
		relatedTerms: ["Solution", "Metadata"],
	},

	Traceability: {
		id: "TERM-012",
		definition:
			"Die Fähigkeit, Anforderungen und Artefakte über den gesamten Lifecycle " +
			"hinweg zu verfolgen und deren Beziehungen zu verstehen.",
		relatedTerms: ["UUID", "Solution", "Deliverable"],
	},

	// ─────────────────────────────────────────────────────────────
	// Metrics & Gamification (for future use)
	// ─────────────────────────────────────────────────────────────

	Metric: {
		id: "TERM-030",
		definition:
			"Messbare Größe zur Bewertung von Fortschritt, Qualität oder Erfolg.",
		examples: ["Test Coverage", "Cycle Time", "Customer Satisfaction"],
		relatedTerms: ["AcceptanceCriteria", "Gate"],
	},

	XP: {
		id: "TERM-031",
		definition:
			"Experience Points - Gamification-Element zur Darstellung von Fortschritt.",
		relatedTerms: ["Metric", "LifecyclePhase"],
	},

	// ─────────────────────────────────────────────────────────────
	// Ideas and Requirements (IREB-conformant)
	// ─────────────────────────────────────────────────────────────

	Idea: {
		id: "TERM-040",
		definition:
			"Ein vorläufiger Gedanke oder Konzept, das zu einer Anforderung werden kann. " +
			"Ideas werden erfasst, bewertet und bei Bedarf zu Requirements weiterentwickelt.",
		synonyms: ["Konzept", "Vorschlag"],
		relatedTerms: ["Requirement", "Solution", "IdeaStatus"],
	},

	Requirement: {
		id: "TERM-041",
		definition:
			"Eine Bedingung oder Fähigkeit, die ein System erfüllen muss (IREB). " +
			"Requirements sind verifizierbar, priorisiert und nachverfolgbar.",
		synonyms: ["Anforderung", "Spezifikation"],
		relatedTerms: ["Idea", "Solution", "AcceptanceCriteria", "RequirementStatus", "Priority"],
	},

	IdeaStatus: {
		id: "TERM-042",
		definition:
			"Der aktuelle Zustand einer Idee im Erfassungsprozess.",
		values: ["Active", "Archived", "Implemented"],
		relatedTerms: ["Idea"],
	},

	RequirementStatus: {
		id: "TERM-043",
		definition:
			"Der aktuelle Zustand einer Anforderung im Requirement-Lifecycle (IREB).",
		values: ["Proposed", "Approved", "Satisfied", "Obsolete"],
		relatedTerms: ["Requirement"],
	},

	Priority: {
		id: "TERM-044",
		definition:
			"Die relative Wichtigkeit einer Anforderung für den Projekterfolg.",
		values: ["High", "Medium", "Low"],
		relatedTerms: ["Requirement"],
	},

	// ─────────────────────────────────────────────────────────────
	// Jobs to be Done (JTBD)
	// ─────────────────────────────────────────────────────────────

	JTBD: {
		id: "TERM-045",
		definition:
			"Jobs to be Done - Ein Framework zur Erfassung von Benutzerbedürfnissen. " +
			'Format: "When [situation], I want to [motivation], so I can [outcome]". ' +
			"Verwendet Anthony Ulwick's Outcome-Driven Innovation (ODI) Methodik.",
		synonyms: ["Job to be Done", "User Job", "Customer Job"],
		relatedTerms: ["Idea", "Requirement", "Solution", "OpportunityScore"],
	},

	JTBDStatus: {
		id: "TERM-046",
		definition:
			"Der aktuelle Zustand eines Jobs to be Done im Erfassungsprozess.",
		values: ["Active", "Validated", "Archived"],
		relatedTerms: ["JTBD"],
	},

	OpportunityScore: {
		id: "TERM-047",
		definition:
			"Bewertungsmetrik für JTBD nach Ulwick's ODI Formel: " +
			"Opportunity = Importance + max(Importance - Satisfaction, 0). " +
			"Skala 1-10, wobei höhere Werte größere Verbesserungspotenziale anzeigen.",
		relatedTerms: ["JTBD", "Importance", "Satisfaction"],
	},

	Importance: {
		id: "TERM-048",
		definition:
			"Wie wichtig ist ein Job für den Benutzer? " +
			"Skala 1-5 (1=unwichtig, 5=sehr wichtig).",
		values: ["1", "2", "3", "4", "5"],
		relatedTerms: ["JTBD", "OpportunityScore"],
	},

	Satisfaction: {
		id: "TERM-049",
		definition:
			"Wie zufrieden ist der Benutzer mit bestehenden Lösungen für diesen Job? " +
			"Skala 1-5 (1=unzufrieden, 5=sehr zufrieden).",
		values: ["1", "2", "3", "4", "5"],
		relatedTerms: ["JTBD", "OpportunityScore"],
	},
} as const satisfies Record<string, DictionaryTerm>;

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

/** All term names in the dictionary */
export type DictionaryTermName = keyof typeof DATA_DICTIONARY;

/** Helper to get a term definition */
export function getTerm(name: DictionaryTermName): DictionaryTerm {
	return DATA_DICTIONARY[name];
}

/** Helper to get all terms */
export function getAllTerms(): readonly DictionaryTerm[] {
	return Object.values(DATA_DICTIONARY);
}

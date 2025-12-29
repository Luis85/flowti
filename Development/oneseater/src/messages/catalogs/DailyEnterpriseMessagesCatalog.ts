import { MessageTemplate } from "src/messages/types";
import { defaultTimeOfDayFactor } from "src/simulation/utils";

/**
 * ENTERPRISE_DAILY_INBOX_CATALOG
 * - Mehr Varianz, realistische Daily-Inbox in einem Unternehmen.
 * - Nutzt dieselben Felder wie DAILY_MESSAGES_CATALOG.
 */
export const ENTERPRISE_DAILY_INBOX_CATALOG: MessageTemplate[] = [
  // ----------------------------
  // IT / Security
  // ----------------------------
  {
    id: "it-reset-01",
    type: "IT",
    subject: "Passwort-Reset Anfrage",
    body: "Hi,\n\nkannst du bitte mein Passwort zurücksetzen? Ich komme nicht mehr ins System.\n\nDanke!",
    author: "Mitarbeiter (Sales)",
    priority: "2 - Medium",
    possible_actions: ["read", "archive", "respond", "delete", "spam"],
    weight: 2.2,
    tags: ["internal", "it"],
    soft: {
      timeOfDayFactor: (m) => (m < 420 ? 0.2 : m < 600 ? 1.2 : defaultTimeOfDayFactor(m)),
      weekendFactor: (w) => (w ? 0.4 : 1.0),
    },
  },
  {
    id: "it-phish-01",
    type: "Phishing",
    subject: "⚠️ Konto gesperrt – Aktion erforderlich",
    body: "Ihr Konto wurde wegen verdächtiger Aktivitäten gesperrt.\nBitte verifizieren Sie umgehend Ihre Zugangsdaten über den Link.",
    author: "IT Service Desk",
    priority: "0 - Urgent",
    possible_actions: ["read", "inspect", "spam", "delete", "respond"],
    weight: 1.3,
    tags: ["security", "risk", "junk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.6 : 1.0),
    },
  },
  {
    id: "it-maint-01",
    type: "System",
    subject: "Geplante Wartung: ERP nicht verfügbar",
    body: "Reminder: Heute 22:00–23:30 ist das ERP wegen Wartung nicht verfügbar.\nBitte offene Buchungen vorher abschließen.",
    author: "IT Operations",
    priority: "2 - Medium",
    possible_actions: ["read", "archive"],
    weight: 0.9,
    tags: ["it", "system"],
    soft: {
      timeOfDayFactor: (m) => (m < 900 ? 0.4 : m < 1200 ? 1.0 : 1.4),
      weekendFactor: (w) => (w ? 0.8 : 1.0),
    },
  },

  // ----------------------------
  // Finance / Accounting
  // ----------------------------
  {
    id: "fin-pay-01",
    type: "Payment",
    subject: "Zahlungseingang verbucht",
    body: "Eine Zahlung ist eingegangen und wurde verbucht. Bitte Einnahmen einsammeln.",
    author: "Finance Bot",
    priority: "1 - High",
    possible_actions: ["read", "collect", "archive"],
    weight: 1.8,
    tags: ["finance", "cash"],
    soft: {
      timeOfDayFactor: (m) => (m < 480 ? 0.2 : m < 1020 ? 1.3 : 0.6),
      weekendFactor: (w) => (w ? 0.3 : 1.0),
    },
  },
  {
    id: "fin-overdue-01",
    type: "Overdue",
    subject: "Rechnung überfällig: Bitte prüfen",
    body: "Rechnung #INV-**** ist überfällig.\nSoll eine Mahnung rausgehen oder Rücksprache mit Sales?",
    author: "Accounting",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "archive", "respond"],
    weight: 1.2,
    tags: ["finance", "risk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.1,
      weekendFactor: (w) => (w ? 0.2 : 1.0),
    },
  },
  {
    id: "fin-refund-01",
    type: "Refund",
    subject: "Rückerstattung angefragt",
    body: "Kunde fordert Rückerstattung wegen Unzufriedenheit.\nBitte Entscheidung treffen und ggf. Prozess anstoßen.",
    author: "Customer Support",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "archive", "respond"],
    weight: 0.8,
    tags: ["customer", "finance"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 0.9,
      weekendFactor: (w) => (w ? 0.5 : 1.0),
    },
  },

  // ----------------------------
  // Sales / Commercial
  // ----------------------------
  {
    id: "sales-lead-01",
    type: "Opportunity",
    subject: "Neuer Lead: Demo angefragt",
    body: "Ein potenzieller Kunde hat eine Demo angefragt.\nBitte priorisieren und Termin vorschlagen.",
    author: "CRM",
    priority: "1 - High",
    possible_actions: ["read", "accept", "decline", "archive"],
    weight: 1.1,
    tags: ["sales", "deal"],
    soft: {
      timeOfDayFactor: (m) => (m < 540 ? 0.4 : m < 1020 ? 1.4 : 0.6),
      weekendFactor: (w) => (w ? 0.25 : 1.0),
    },
  },
  {
    id: "sales-discount-01",
    type: "SalesDecision",
    subject: "Rabattfreigabe benötigt",
    body: "Kunde fordert 12% Rabatt bei Laufzeit 12 Monate.\nFreigabe erbeten (Deadline heute 16:00).",
    author: "Sales Manager",
    priority: "0 - Urgent",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 0.9,
    tags: ["sales", "risk"],
    soft: {
      timeOfDayFactor: (m) => (m < 480 ? 0.3 : m < 960 ? 1.5 : 0.7),
      weekendFactor: (w) => (w ? 0.2 : 1.0),
    },
  },
  {
    id: "sales-contract-01",
    type: "Legal",
    subject: "Vertragsklausel unklar – bitte prüfen",
    body: "Im Vertragsentwurf ist eine Haftungsklausel enthalten, die wir so nicht akzeptieren.\nBitte prüfen / Rückmeldung geben.",
    author: "Legal Desk",
    priority: "1 - High",
    possible_actions: ["read", "inspect", "respond", "archive"],
    weight: 0.6,
    tags: ["legal", "sales"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.0,
      weekendFactor: (w) => (w ? 0.15 : 1.0),
    },
  },

  // ----------------------------
  // Operations / Vendor / Supply
  // ----------------------------
  {
    id: "ops-delay-01",
    type: "VendorDelay",
    subject: "Lieferverzögerung angekündigt",
    body: "Lieferant meldet 3–5 Tage Verzögerung wegen Engpässen.\nBitte Kundenerwartung managen.",
    author: "Supplier Ops",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "archive", "respond"],
    weight: 1.0,
    tags: ["ops", "supplier", "risk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.05,
      weekendFactor: (w) => (w ? 0.4 : 1.0),
    },
  },
  {
    id: "ops-price-01",
    type: "VendorUpdate",
    subject: "Preisanpassung ab nächstem Monat",
    body: "Ankündigung: Einkaufspreise steigen um 6% ab nächstem Monat.\nBitte prüfen (Margen/Weitergabe).",
    author: "Supplier Sales",
    priority: "2 - Medium",
    possible_actions: ["read", "archive", "respond"],
    weight: 0.7,
    tags: ["ops", "supplier", "finance"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 0.9,
      weekendFactor: (w) => (w ? 0.25 : 1.0),
    },
  },
  {
    id: "ops-claim-01",
    type: "Complain",
    subject: "Kunde: Lieferung beschädigt angekommen",
    body: "Kunde meldet Transportschaden und fordert Ersatz.\nBitte prüfen und Entscheidung treffen.",
    author: "Support Desk",
    priority: "1 - High",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 0.9,
    tags: ["customer", "ops", "risk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.0,
      weekendFactor: (w) => (w ? 0.6 : 1.0),
    },
  },

  // ----------------------------
  // HR / People
  // ----------------------------
  {
    id: "hr-sick-01",
    type: "HR",
    subject: "Krankmeldung",
    body: "Hi,\n\nich bin heute krank und nicht erreichbar.\n\nViele Grüße",
    author: "Mitarbeiter (Ops)",
    priority: "2 - Medium",
    possible_actions: ["read", "archive"],
    weight: 0.8,
    tags: ["internal", "hr"],
    soft: {
      timeOfDayFactor: (m) => (m < 540 ? 1.2 : defaultTimeOfDayFactor(m) * 0.7),
      weekendFactor: (w) => (w ? 0.2 : 1.0),
    },
  },
  {
    id: "hr-policy-01",
    type: "Policy",
    subject: "Reminder: Sicherheitsunterweisung fällig",
    body: "Die jährliche Sicherheitsunterweisung ist fällig.\nBitte bis Freitag abschließen.",
    author: "HR",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 0.6,
    tags: ["internal", "policy"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 0.8,
      weekendFactor: (w) => (w ? 0.15 : 1.0),
    },
  },

  // ----------------------------
  // Internal / Projects
  // ----------------------------
  {
    id: "int-status-01",
    type: "InternalUpdate",
    subject: "Projektstatus: Blocker gemeldet",
    body: "Wir haben aktuell einen Blocker im Deployment.\nBitte priorisieren: Entscheidung zu Rollback vs Hotfix.",
    author: "Project Lead",
    priority: "0 - Urgent",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 0.9,
    tags: ["internal", "project", "risk"],
    soft: {
      timeOfDayFactor: (m) => (m < 540 ? 0.3 : m < 1080 ? 1.3 : 0.6),
      weekendFactor: (w) => (w ? 0.35 : 1.0),
    },
  },
  {
    id: "int-meeting-01",
    type: "Internal",
    subject: "Kannst du kurz 10 Min? (kurze Abstimmung)",
    body: "Hast du kurz Zeit für eine schnelle Abstimmung? Geht um Priorisierung für heute.",
    author: "Kollege",
    priority: "3 - Low",
    possible_actions: ["read", "archive", "respond", "spam", "delete"],
    weight: 1.6,
    tags: ["internal", "noise"],
    soft: {
      timeOfDayFactor: (m) => (m < 540 ? 0.4 : m < 1020 ? 1.4 : 0.4),
      weekendFactor: (w) => (w ? 0.3 : 1.0),
    },
  },

  // ----------------------------
  // “Gray” Spam / Noise (realistischer)
  // ----------------------------
  {
    id: "spam-vendor-01",
    type: "Spam",
    subject: "Re: Rechnung / Zahlungsbeleg (bitte prüfen)",
    body: "Hallo,\n\nanbei der Zahlungsbeleg. Bitte bestätigen.\n\nDanke",
    author: "Accounts Payable <noreply@payments-portal.tld>",
    priority: "2 - Medium",
    possible_actions: ["read", "inspect", "spam", "delete", "respond"],
    weight: 1.9,
    tags: ["junk", "risk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.15,
      weekendFactor: (w) => (w ? 0.9 : 1.0),
    },
  },
  {
    id: "spam-training-01",
    type: "Spam",
    subject: "Pflichtschulung: Jetzt registrieren (extern)",
    body: "Sie wurden zur Pflichtschulung eingeladen. Bitte registrieren Sie sich über den externen Link.",
    author: "Training Platform",
    priority: "3 - Low",
    possible_actions: ["read", "inspect", "spam", "delete", "archive"],
    weight: 1.2,
    tags: ["junk", "security"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.05,
      weekendFactor: (w) => (w ? 0.8 : 1.0),
    },
  },

  // ----------------------------
  // Customer / Service (mehr Varianz)
  // ----------------------------
  {
    id: "cust-nice-01",
    type: "Customer",
    subject: "Danke! Alles läuft wieder",
    body: "Hallo Team,\n\nkurzes Feedback: Problem ist gelöst, danke für die schnelle Hilfe!\n\nBeste Grüße",
    author: "Kunde",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 0.7,
    tags: ["customer", "positive"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 0.85,
      weekendFactor: (w) => (w ? 0.4 : 1.0),
    },
  },
  {
    id: "cust-angry-01",
    type: "Complain",
    subject: "Unzufrieden – bitte Rückruf heute",
    body: "Das ist bereits das zweite Mal diese Woche.\nBitte heute noch Rückruf — sonst kündigen wir.",
    author: "Kunde (Key Account)",
    priority: "0 - Urgent",
    possible_actions: ["read", "respond", "accept", "decline", "archive"],
    weight: 0.7,
    tags: ["customer", "risk"],
    soft: {
      timeOfDayFactor: (m) => defaultTimeOfDayFactor(m) * 1.2,
      weekendFactor: (w) => (w ? 0.3 : 1.0),
    },
  },
];

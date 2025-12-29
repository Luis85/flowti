import { MessageTemplate } from "src/messages/types";


export const BUSINESS_DAILY_INBOX_CATALOG: MessageTemplate[] = [
  // =========================
  // Kundenkommunikation
  // =========================
  {
    id: "cust-001",
    category: "customer",
	type: "Customer",
	priority: "3 - Low",
    subject: "Rückfrage zu unserem Angebot",
    body: "Guten Tag,\n\nwir haben Ihr Angebot geprüft, hätten aber noch eine Rückfrage zur enthaltenen Leistung.\nKönnten Sie das bitte kurz erläutern?\n\nVielen Dank!",
    author: "Kunde Müller GmbH",
    possible_actions: ["read", "archive"],
    weight: 3,
  },
  {
    id: "cust-002",
    category: "customer",
	type: "Customer",
	priority: "3 - Low",
    subject: "Beschwerde: Verzögerte Lieferung",
    body: "Sehr geehrtes Team,\n\nleider warten wir seit mehreren Tagen auf die zugesagte Lieferung. Bitte um kurzfristige Klärung.\n\nMit freundlichen Grüßen",
    author: "Kunde Schuster AG",
    possible_actions: ["read", "archive"],
    weight: 2,
  },
  {
    id: "cust-003",
    category: "customer",
	type: "Customer",
	priority: "3 - Low",
    subject: "Vielen Dank für die schnelle Umsetzung",
    body: "Hallo zusammen,\n\nvielen Dank für die schnelle und unkomplizierte Umsetzung unseres Anliegens. Top Service!\n\nBeste Grüße",
    author: "Kunde NovaTech",
    possible_actions: ["read", "archive"],
    weight: 1,
  },

  // =========================
  // Vertrieb & Aufträge
  // =========================
  {
    id: "sales-001",
    category: "sales",
	type: "Sales",
	priority: "3 - Low",
    subject: "Angebot angenommen - Auftrag #SO-4837",
    body: "Gute Nachrichten!\n\nDer Kunde hat das Angebot angenommen. Der Auftrag kann angelegt und weiterverarbeitet werden.",
    author: "Sales System",
    possible_actions: ["read", "accept"],
    weight: 2,
  },
  {
    id: "sales-002",
    category: "sales",
	type: "Sales",
	priority: "3 - Low",
    subject: "Angebot abgelehnt",
    body: "Der Kunde hat sich leider gegen unser Angebot entschieden.\nBegründung: Preis zu hoch.",
    author: "Sales System",
    possible_actions: ["read", "archive"],
    weight: 1,
  },

  // =========================
  // Finanzen & Buchhaltung
  // =========================
  {
    id: "finance-001",
    category: "finance",
	type: "Finance",
	priority: "3 - Low",
    subject: "Zahlungseingang verbucht",
    body: "Eine Zahlung in Höhe von 4.250 € wurde erfolgreich verbucht.",
    author: "Finance Bot",
    possible_actions: ["read", "collect"],
    weight: 2,
  },
  {
    id: "finance-002",
    category: "finance",
	type: "Finance",
	priority: "3 - Low",
    subject: "Zahlung überfällig",
    body: "Rechnung #INV-2291 ist seit 7 Tagen überfällig.\nBitte prüfen Sie das weitere Vorgehen.",
    author: "Finance Bot",
    possible_actions: ["read", "archive"],
    weight: 1,
  },

  // =========================
  // Interne Kommunikation
  // =========================
  {
    id: "int-001",
    category: "internal",
	type: "Internal",
	priority: "3 - Low",
    subject: "Statusupdate Projekt Phoenix",
    body: "Kurzes Update:\n- Entwicklung im Plan\n- Testing startet morgen\n- Keine Blocker",
    author: "Projektleitung",
    possible_actions: ["read", "archive"],
    weight: 3,
  },
  {
    id: "int-002",
    category: "internal",
	type: "Internal",
	priority: "3 - Low",
    subject: "Eskalation: Kunde wartet auf Rückmeldung",
    body: "Der Kunde wartet seit gestern auf eine Rückmeldung.\nBitte heute priorisieren.",
    author: "Account Management",
    possible_actions: ["read", "archive"],
    weight: 1,
  },

  // =========================
  // Lieferanten & Partner
  // =========================
  {
    id: "partner-001",
    category: "partner",
	type: "Partner",
	priority: "2 - Medium",
    subject: "Lieferverzögerung angekündigt",
    body: "Aufgrund aktueller Engpässe verzögert sich die Lieferung um ca. 3 Werktage.",
    author: "Lieferant Alpha",
    possible_actions: ["read", "archive"],
    weight: 1,
  },
  {
    id: "partner-002",
    category: "partner",
	type: "Partner",
	priority: "2 - Medium",
    subject: "Preisanpassung ab nächstem Quartal",
    body: "Wir möchten Sie darüber informieren, dass ab dem nächsten Quartal neue Preise gelten.",
    author: "Lieferant Beta",
    possible_actions: ["read", "archive"],
    weight: 1,
  },

  // =========================
  // System & Verwaltung
  // =========================
  {
    id: "sys-001",
    category: "system",
	type: "System",
	priority: "2 - Medium",
    subject: "Geplante Systemwartung",
    body: "Am kommenden Samstag findet eine geplante Systemwartung statt.\nDowntime ca. 2 Stunden.",
    author: "IT System",
    possible_actions: ["read", "archive"],
    weight: 1,
  },

  // =========================
  // Spam & Noise
  // =========================
  {
    id: "spam-001",
    category: "spam",
	type: "Spam",
	priority: "2 - Medium",
    subject: "🚀 Boost your business now!",
    body: "Limited time offer! Increase your revenue instantly.\nClick here now!",
    author: "Business Growth Pro",
    possible_actions: ["spam", "delete"],
    weight: 5,
  },
  {
    id: "spam-002",
    category: "spam",
	type: "Spam",
	priority: "2 - Medium",
    subject: "Rechnung ausstehend?",
    body: "Bitte prüfen Sie den angehängten Zahlungsbeleg.",
    author: "Unknown author",
    possible_actions: ["spam", "delete"],
    weight: 3,
  },
];

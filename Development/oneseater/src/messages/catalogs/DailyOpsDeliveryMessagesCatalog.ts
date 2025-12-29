import { MessageTemplate } from "src/messages/types";

/**
 * OPS_DELIVERY_DAILY_INBOX_CATALOG
 * - Bunter Mix aus Mittelstand + SaaS/Agency
 * - Fokus: Ops & Delivery (Projekte, Kunden, Finanzen, Lieferanten, Compliance, IT, HR)
 * - Viele "Graubereich"-Mails (Fast-legit), Systemnoise, Eskalationen, Entscheidungen.
 *
 * Hinweis:
 * - `channel` ist optional und dient dem MessageGeneratorService als Routing hint.
 * - `possible_actions` muss zu euren implementierten Actions passen (read/spam/archive/delete/accept/decline/collect/inspect/respond etc.)
 */
export const OPS_DELIVERY_DAILY_INBOX_CATALOG: MessageTemplate[] = [
  // ==========================================================
  // CUSTOMER / DELIVERY (Requests, Escalations, Feedback)
  // ==========================================================
  {
    id: "od-cust-001",
    channel: "customer",
    type: "Customer",
    subject: "Rückfrage: Was genau ist im Support enthalten?",
    body:
      "Hallo Team,\n\nkönnt ihr bitte kurz aufschlüsseln, was im Support-Paket enthalten ist (Reaktionszeiten, Umfang, Kanäle)?\n\nDanke!",
    author: "Kunde (Procurement)",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 2.2,
    tags: ["customer", "delivery"],
  },
  {
    id: "od-cust-002",
    channel: "customer",
    type: "Complain",
    subject: "Eskalation: Wir brauchen heute eine verbindliche Aussage",
    body:
      "Guten Tag,\n\nwir warten seit gestern auf eine Rückmeldung. Bitte heute bis 15:00 eine verbindliche Aussage, sonst eskalieren wir intern.\n\nMit freundlichen Grüßen",
    author: "Kunde (Key Account)",
    priority: "0 - Urgent",
    possible_actions: ["read", "respond", "accept", "decline", "archive"],
    weight: 1.1,
    tags: ["customer", "risk"],
  },
  {
    id: "od-cust-003",
    channel: "customer",
    type: "Customer",
    subject: "Kleines Lob – super schnelle Reaktionszeit 🙌",
    body:
      "Hi,\n\nkurzes Lob: die Reaktionszeit gestern war top und das Thema ist gelöst.\nDanke!\n\nVG",
    author: "Kunde",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 0.7,
    tags: ["customer", "positive"],
  },
  {
    id: "od-cust-004",
    channel: "customer",
    type: "ChangeRequest",
    subject: "Change Request: Scope Erweiterung (bitte Aufwand einschätzen)",
    body:
      "Hallo,\n\nwir würden gern den Scope erweitern: zusätzliche Rolle + neues Reporting.\nBitte Aufwandsschätzung und Auswirkungen auf Timeline.\n\nDanke!",
    author: "Kunde (PO)",
    priority: "1 - High",
    possible_actions: ["read", "inspect", "respond", "archive"],
    weight: 1.0,
    tags: ["customer", "scope", "delivery"],
  },
  {
    id: "od-cust-005",
    channel: "customer",
    type: "Meeting",
    subject: "Terminvorschlag: Steering 30 Min – diese Woche",
    body:
      "Hi,\n\nkönnen wir diese Woche ein 30-Min Steering machen? Fokus: Status, Risiken, nächste Milestones.\n\nGrüße",
    author: "Kunde (Sponsor)",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.3,
    tags: ["customer", "meeting"],
  },

  // ==========================================================
  // SALES / COMMERCIAL (Deals, Pricing, Discounts)
  // ==========================================================
  {
    id: "od-sales-001",
    channel: "sales",
    type: "Opportunity",
    subject: "Neuer Lead: Anfrage für Workshop-Angebot",
    body:
      "Ein Lead hat angefragt: 1-Tages Workshop (Discovery / Scoping) + grobe Kostenschätzung.\nBitte Angebotstext & Preisrahmen.",
    author: "CRM",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "archive"],
    weight: 1.2,
    tags: ["sales", "ops"],
  },
  {
    id: "od-sales-002",
    channel: "sales",
    type: "SalesDecision",
    subject: "Rabattfreigabe: 8% bei 12 Monaten (Deadline 16:00)",
    body:
      "Kunde fordert 8% Rabatt, wenn wir 12 Monate Laufzeit fixieren.\nBitte freigeben oder ablehnen (Deadline 16:00).",
    author: "Sales Manager",
    priority: "0 - Urgent",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 0.9,
    tags: ["sales", "decision"],
  },
  {
    id: "od-sales-003",
    channel: "sales",
    type: "Quote",
    subject: "Angebot abgelehnt – Grund: Budget eingefroren",
    body:
      "Update: Angebot wurde abgelehnt.\nGrund: Budget Freeze bis Q2.\nBitte in Pipeline auf Wiedervorlage.",
    author: "Sales System",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 0.8,
    tags: ["sales"],
  },

  // ==========================================================
  // FINANCE (Payments, Overdues, Refunds, Invoicing)
  // ==========================================================
  {
    id: "od-fin-001",
    channel: "finance",
    type: "Payment",
    subject: "Zahlungseingang: 3.980 € (bitte einsammeln)",
    body:
      "Zahlung ist eingegangen und verbucht.\nBitte in der Finance-Übersicht einsammeln/zuordnen.",
    author: "Finance Bot",
    priority: "1 - High",
    possible_actions: ["read", "collect", "archive"],
    weight: 1.7,
    tags: ["finance", "cash"],
  },
  {
    id: "od-fin-002",
    channel: "finance",
    type: "Overdue",
    subject: "Rechnung überfällig: Kunde bittet um Zahlungsziel-Verlängerung",
    body:
      "Kunde bittet um Verlängerung Zahlungsziel um 14 Tage.\nBitte Entscheidung + Rückmeldung an Finance/Sales.",
    author: "Accounting",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 1.1,
    tags: ["finance", "risk"],
  },
  {
    id: "od-fin-003",
    channel: "finance",
    type: "Invoice",
    subject: "Abrechnung: Timesheets fehlen für letzte Woche",
    body:
      "Für die Abrechnung fehlen noch Timesheets von 2 Personen.\nBitte nachpflegen oder bestätigen, dass 0h korrekt sind.",
    author: "Finance Ops",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.4,
    tags: ["finance", "ops", "delivery"],
  },
  {
    id: "od-fin-004",
    channel: "finance",
    type: "Refund",
    subject: "Chargeback Meldung (Kreditkarte) – bitte prüfen",
    body:
      "Es liegt ein Chargeback vor. Bitte Sachverhalt prüfen und Evidence liefern (Leistungsnachweis / Kommunikation).",
    author: "Payment Provider",
    priority: "1 - High",
    possible_actions: ["read", "inspect", "respond", "archive"],
    weight: 0.7,
    tags: ["finance", "risk"],
  },

  // ==========================================================
  // OPS / SUPPLIERS / PROCUREMENT
  // ==========================================================
  {
    id: "od-ops-001",
    channel: "ops",
    type: "SupplierDelay",
    subject: "Lieferant: Verzögerung 3–5 Tage (Engpass)",
    body:
      "Aufgrund Engpässen verzögert sich die Lieferung um 3–5 Tage.\nBitte Kundenkommunikation prüfen.",
    author: "Supplier Ops",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.1,
    tags: ["ops", "supplier", "risk"],
  },
  {
    id: "od-ops-002",
    channel: "ops",
    type: "Procurement",
    subject: "Einkauf: Preisänderung ab nächstem Monat (+6%)",
    body:
      "Ankündigung: Preise steigen ab nächstem Monat um 6%.\nBitte Entscheidung: weitergeben / absorbieren / neu verhandeln.",
    author: "Supplier Sales",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 0.8,
    tags: ["ops", "finance", "supplier"],
  },
  {
    id: "od-ops-003",
    channel: "ops",
    type: "Warehouse",
    subject: "Lager: Bestandsdifferenz festgestellt (bitte prüfen)",
    body:
      "Bei der Inventur wurde eine Bestandsdifferenz festgestellt.\nBitte prüfen, ob Buchungskorrektur erforderlich ist.",
    author: "Warehouse",
    priority: "2 - Medium",
    possible_actions: ["read", "inspect", "respond", "archive"],
    weight: 0.9,
    tags: ["ops", "inventory"],
  },
  {
    id: "od-ops-004",
    channel: "ops",
    type: "Logistics",
    subject: "Sendung hängt im Transit – Kunde fragt nach ETA",
    body:
      "Sendung hängt im Transit. Kunde fragt nach ETA.\nBitte prüfen und Update geben.",
    author: "Logistics Desk",
    priority: "1 - High",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.0,
    tags: ["ops", "customer", "risk"],
  },

  // ==========================================================
  // DELIVERY / PROJECT (Risks, Status, Planning, Quality)
  // ==========================================================
  {
    id: "od-deliv-001",
    channel: "internal",
    type: "Project",
    subject: "Projekt: Blocker im Deployment – Entscheidung erforderlich",
    body:
      "Wir haben einen Blocker im Deployment.\nOption A: Rollback\nOption B: Hotfix\nBitte Entscheidung bis 13:00.",
    author: "Tech Lead",
    priority: "0 - Urgent",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 1.0,
    tags: ["delivery", "risk", "internal"],
  },
  {
    id: "od-deliv-002",
    channel: "internal",
    type: "QA",
    subject: "QA: 5 neue Bugs im Regression-Test (2 kritisch)",
    body:
      "Regression hat 5 neue Bugs gefunden, davon 2 kritisch.\nBitte triage + Entscheidung, ob Release verschoben wird.",
    author: "QA",
    priority: "1 - High",
    possible_actions: ["read", "inspect", "respond", "archive"],
    weight: 1.2,
    tags: ["delivery", "quality", "risk"],
  },
  {
    id: "od-deliv-003",
    channel: "internal",
    type: "Planning",
    subject: "Bitte Input: Sprint-Ziel & Prioritäten",
    body:
      "Wir brauchen heute Input fürs Planning: Sprint-Ziel + Top 3 Prioritäten.\nKannst du das bis 11:30 kurz schicken?",
    author: "Scrum Master",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.4,
    tags: ["delivery", "planning", "internal"],
  },
  {
    id: "od-deliv-004",
    channel: "internal",
    type: "Scope",
    subject: "Scope creep erkannt – bitte Entscheidung",
    body:
      "In den letzten 2 Wochen kamen 6 Scope-Additionen rein.\nBitte Entscheidung: CR-Prozess + Budget/Timeline anpassen?",
    author: "Delivery Manager",
    priority: "1 - High",
    possible_actions: ["read", "accept", "decline", "respond", "archive"],
    weight: 0.9,
    tags: ["delivery", "scope", "risk"],
  },

  // ==========================================================
  // IT / SYSTEM (Incidents, Access, Maintenance)
  // ==========================================================
  {
    id: "od-it-001",
    channel: "it",
    type: "Incident",
    subject: "Incident: VPN instabil – mehrere Meldungen",
    body:
      "Mehrere Nutzer melden VPN-Probleme.\nBitte prüfen, ob Provider-Issue vorliegt. Workaround kommunizieren?",
    author: "IT Service Desk",
    priority: "1 - High",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.0,
    tags: ["it", "incident"],
  },
  {
    id: "od-it-002",
    channel: "it",
    type: "Access",
    subject: "Zugriffsanfrage: Projekt-Repo (extern)",
    body:
      "Externer Mitarbeiter benötigt Zugriff auf Repo + CI.\nBitte prüfen und freigeben (Least Privilege).",
    author: "IT Admin",
    priority: "2 - Medium",
    possible_actions: ["read", "accept", "decline", "inspect", "archive"],
    weight: 0.9,
    tags: ["it", "security"],
  },
  {
    id: "od-system-001",
    channel: "system",
    type: "System",
    subject: "Automatische Erinnerung: Offene Tickets > 7 Tage",
    body:
      "Es sind 4 Tickets älter als 7 Tage.\nBitte priorisieren oder schließen (mit Begründung).",
    author: "Service Desk Bot",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 1.6,
    tags: ["system", "noise"],
  },

  // ==========================================================
  // HR / PEOPLE (Sick, Training, Recruiting)
  // ==========================================================
  {
    id: "od-hr-001",
    channel: "hr",
    type: "HR",
    subject: "Krankmeldung – heute nicht verfügbar",
    body:
      "Hi,\n\nich bin heute krank und nicht erreichbar.\n\nVG",
    author: "Mitarbeiter",
    priority: "2 - Medium",
    possible_actions: ["read", "archive"],
    weight: 1.1,
    tags: ["hr", "internal"],
  },
  {
    id: "od-hr-002",
    channel: "hr",
    type: "Training",
    subject: "Pflichtschulung fällig: InfoSec Awareness",
    body:
      "Reminder: Bitte die InfoSec Awareness Schulung bis Freitag abschließen.",
    author: "HR",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 0.9,
    tags: ["hr", "policy"],
  },
  {
    id: "od-hr-003",
    channel: "hr",
    type: "Recruiting",
    subject: "Recruiting: Interview-Feedback benötigt",
    body:
      "Für Kandidat*in fehlen noch 2 Feedbacks.\nBitte bis heute Abend ausfüllen.",
    author: "Recruiting",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 0.8,
    tags: ["hr", "internal"],
  },

  // ==========================================================
  // LEGAL / COMPLIANCE (DPAs, Audits, Policies)
  // ==========================================================
  {
    id: "od-legal-001",
    channel: "legal",
    type: "Legal",
    subject: "DPA / AVV: Kunde will Anpassung in Clause 7",
    body:
      "Kunde fordert Anpassungen im DPA (Clause 7 – Subprocessors).\nBitte prüfen und Rückmeldung geben.",
    author: "Legal Desk",
    priority: "1 - High",
    possible_actions: ["read", "inspect", "respond", "archive"],
    weight: 0.6,
    tags: ["legal", "customer"],
  },
  {
    id: "od-legal-002",
    channel: "legal",
    type: "Compliance",
    subject: "Audit-Vorbereitung: Nachweise für Prozess X benötigt",
    body:
      "Für die Audit-Vorbereitung benötigen wir Nachweise für Prozess X (Dokumente/Logs).\nBitte bis Mittwoch liefern.",
    author: "Compliance",
    priority: "2 - Medium",
    possible_actions: ["read", "respond", "archive"],
    weight: 0.7,
    tags: ["legal", "policy", "internal"],
  },

  // ==========================================================
  // INTERNAL NOISE (Pings, FYIs, low-value chatter)
  // ==========================================================
  {
    id: "od-noise-001",
    channel: "internal",
    type: "Internal",
    subject: "Hast du kurz 5 Min? (kleine Rückfrage)",
    body:
      "Hey,\n\nhast du kurz 5 Min? Kleines Thema, schnell geklärt.\n\nDanke!",
    author: "Kollege",
    priority: "3 - Low",
    possible_actions: ["read", "respond", "archive", "delete", "spam"],
    weight: 2.0,
    tags: ["internal", "noise"],
  },
  {
    id: "od-noise-002",
    channel: "internal",
    type: "Message",
    subject: "FYI: Team Lunch am Freitag 🍕",
    body:
      "Kurzer Hinweis: Team Lunch am Freitag 12:30.\nWer ist dabei?",
    author: "Office",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 1.1,
    tags: ["internal", "social"],
  },

  // ==========================================================
  // SPAM / GRAY SPAM (dangerous + “almost legit”)
  // ==========================================================
  {
    id: "od-spam-001",
    channel: "spam",
    type: "Spam",
    subject: "Rechnung / Zahlungsbeleg – Aktion erforderlich",
    body:
      "Hallo,\n\nbitte öffnen Sie den Anhang zur Prüfung des Zahlungsbelegs.\n\nDanke",
    author: "Accounts Payable <billing@pay-portal.tld>",
    priority: "1 - High",
    possible_actions: ["read", "inspect", "spam", "delete"],
    weight: 2.2,
    tags: ["junk", "risk"],
  },
  {
    id: "od-spam-002",
    channel: "spam",
    type: "Spam",
    subject: "⚠️ Security Alert: Password expires today",
    body:
      "Your password expires today. Reset now to avoid lockout.\n(External link)",
    author: "IT Support <it-help@external.tld>",
    priority: "0 - Urgent",
    possible_actions: ["read", "inspect", "spam", "delete"],
    weight: 1.7,
    tags: ["junk", "security"],
  },
  {
    id: "od-spam-003",
    channel: "spam",
    type: "Marketing",
    subject: "Wir helfen Ihnen 10x schneller zu skalieren (kostenloses Webinar)",
    body:
      "Kostenloses Webinar: Prozesse optimieren, Kosten senken.\nJetzt anmelden!",
    author: "Growth Team",
    priority: "3 - Low",
    possible_actions: ["read", "spam", "delete", "archive"],
    weight: 2.8,
    tags: ["junk", "marketing"],
  },

  // ==========================================================
  // EXTRA VARIANCE: small/odd but real mails
  // ==========================================================
  {
    id: "od-misc-001",
    channel: "ops",
    type: "Facilities",
    subject: "Büro: Paket liegt am Empfang",
    body:
      "Ein Paket ist am Empfang angekommen. Bitte abholen.",
    author: "Front Desk",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 0.9,
    tags: ["ops", "internal"],
  },
  {
    id: "od-misc-002",
    channel: "system",
    type: "Message",
    subject: "Auto-Reminder: Dokument review fällig",
    body:
      "Dokument 'Runbook' hat Review-Datum erreicht.\nBitte prüfen und ggf. aktualisieren.",
    author: "Docs Bot",
    priority: "3 - Low",
    possible_actions: ["read", "archive"],
    weight: 1.3,
    tags: ["system", "quality"],
  },
  {
    id: "od-misc-003",
    channel: "finance",
    type: "Expense",
    subject: "Spesen: Beleg fehlt (bitte nachreichen)",
    body:
      "Für Spesenabrechnung fehlt ein Beleg.\nBitte nachreichen oder als privat markieren.",
    author: "Finance Ops",
    priority: "3 - Low",
    possible_actions: ["read", "respond", "archive"],
    weight: 1.0,
    tags: ["finance", "internal"],
  },
];

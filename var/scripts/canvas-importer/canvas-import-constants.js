export const TYPE_ORDER = {
  // Flowchart Types (höchste Priorität)
  Event: 1,
  Gateway: 2,
  Subprocess: 3,
  Data: 4,
  Document: 5,
  Database: 6,
  Terminator: 7,
  // Product Hierarchie
  Epic: 10,
  Feature: 11,
  Deliverable: 12,
  Task: 13,
  Test: 14,
  Issue: 15,
  Done: 16,
  Note: 17,
  // Container & Fallback
  Group: 50,
  Node: 99
};

export const TYPE_FOLDER_MAP = {
  // Product Types
  Epic: "Epics",
  Feature: "Features",
  Deliverable: "Deliverables",
  Task: "Tasks",
  Test: "Tests",
  Issue: "Issues",
  Done: "Done",
  Note: "Notes",
  // Flowchart Types
  Event: "Events",
  Gateway: "Gateways",
  Subprocess: "Subprocesses",
  Data: "Data",
  Document: "Documents",
  Database: "Databases",
  Terminator: "Terminators",
  // Container & Fallback
  Group: "Groups",
  Node: "Nodes"
};

export const DEFAULT_COLOR_MAP = {
  "1": "Issue",       // red
  "2": "Epic",        // orange
  "3": "Task",        // yellow
  "4": "Test",        // green
  "5": "Deliverable", // blue
  "6": "Feature"      // purple
};

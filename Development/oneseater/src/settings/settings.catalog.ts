import { Path } from "./settings.utils";
import { OneSeaterSettings, SettingsItem } from "./types";

/**
 * Single Source of Truth for:
 * - Settings UI
 * - Default Settings
 * - Validation constraints
 * - Grouping (Obsidian settings sections)
 * - Systems
 * 
 * To add new Settings, you need to adjust the settings/types.ts, the settings.catalog and the GameSettingsStore
 */
export const SETTINGS_CATALOG: SettingsItem<Path<OneSeaterSettings>>[] = [

  // ─────────────────────────────────────────────────────────────
  // Player – Identity
  // ─────────────────────────────────────────────────────────────
  {
    category: "Player",
    name: "Player Name",
    kind: "text",
    path: "player.name",
    default: "",
  },
  {
    category: "Player",
    name: "Organization",
    kind: "text",
    path: "player.organization",
    default: "",
  },

  // ─────────────────────────────────────────────────────────────
  // Player – Branding (Text-based colors)
  // ─────────────────────────────────────────────────────────────
  {
    category: "Player",
    name: "Player Icon",
    desc: "Icon name or emoji.",
    kind: "text",
    path: "player.icon",
    default: "",
  },
  {
    category: "Player",
    name: "Player Logo",
    desc: "Path or identifier for logo asset.",
    kind: "text",
    path: "player.logo",
    default: "",
  },
  {
    category: "Player",
    name: "Primary Color",
    desc: "Hex color (e.g. #ff0000).",
    kind: "color",
    path: "player.primary_color",
    default: "#ffffff",
  },
  {
    category: "Player",
    name: "Secondary Color",
    kind: "color",
    path: "player.secondary_color",
    default: "#999999",
  },
  {
    category: "Player",
    name: "Tertiary Color",
    kind: "color",
    path: "player.tertiary_color",
    default: "#333333",
  },

  // ─────────────────────────────────────────────────────────────
  // Simulation – Core
  // ─────────────────────────────────────────────────────────────
  {
    category: "Simulation",
    name: "Slowdown after wake up",
    kind: "toggle",
    path: "game.slowAfterSleep",
    default: true,
  },
  {
    category: "Simulation",
    name: "Enable Daily Mail",
    kind: "toggle",
    path: "game.dailyMail",
    default: true,
  },
  {
    category: "Simulation",
    name: "Enable Daily Spam",
    kind: "toggle",
    path: "game.dailySpam",
    default: true,
  },
  {
    category: "Simulation",
    name: "Max Messages",
    desc: "Hard limit for inbox size.",
    kind: "number",
    path: "game.maxMessages",
    default: 100,
    min: 10,
    max: 300,
    step: 10,
  },
  {
    category: "Simulation",
    name: "Daily Mail Chance",
    desc: "Probability of receiving normal mail per day.",
    kind: "number",
    path: "game.dailyMailChance",
    default: 0.01,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    category: "Simulation",
    name: "Daily Spam Chance",
	desc: "how much of that daily mail is spam?",
    kind: "number",
    path: "game.dailySpamChance",
    default: 0.8,
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    category: "Simulation",
    name: "Daily Order Chance",
    desc: "Chance to receive a sales order per day.",
    kind: "number",
    path: "game.dailyOrderChance",
    default: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    category: "Simulation",
    name: "Mail Lambda",
    desc: "How many Mails at once.",
    kind: "number",
    path: "game.mailLambda",
    default: 1,
    min: 1,
    max: 10,
    step: 1,
  },
  {
    category: "Simulation",
    name: "Mail Cap per Step",
    desc: "Hard limit per step.",
    kind: "number",
    path: "game.mailHardCapPerStep",
    default: 1,
    min: 1,
    max: 10,
    step: 1,
  },
  
  // ─────────────────────────────────────────────────────────────
  // Payment
  // ─────────────────────────────────────────────────────────────
  {
    category: "Payment",
    name: "Payment Succes Rate",
    desc: "Chance to be the received payment a success.",
    kind: "number",
    path: "game.paymentSuccessChance",
    default: 0.65,
    min: 0,
    max: 1,
    step: 0.01,
  },
    {
    category: "Payment",
    name: "Payment Delay Days",
    desc: "Base Duration after shipping a order.",
    kind: "number",
    path: "game.paymentDelayDays",
    default: 3,
    min: 1,
    max: 10,
    step: 1,
  },
    {
    category: "Payment",
    name: "Payment Jitter Days",
    desc: "Varianz in Delay.",
    kind: "number",
    path: "game.paymentJitterDays",
    default: 2,
    min: 1,
    max: 10,
    step: 1,
  },
  
  // ─────────────────────────────────────────────────────────────
  // Data & Storage
  // ─────────────────────────────────────────────────────────────
  {
    category: "Data",
    name: "Data Folder Path",
    desc: "Base folder for cached and generated data.",
    kind: "text",
    path: "dataFolderPath",
    default: "OneSeater/Data",
  },
  {
    category: "Data",
    name: "Compendium Folder Path",
    desc: "Folder for generated entity and compendium files.",
    kind: "text",
    path: "compendiumFolderPath",
    default: "OneSeater/Compendium",
  },
  {
    category: "Data",
    name: "Templates Folder Path",
    desc: "Folder containing note and document templates.",
    kind: "text",
    path: "templatesFolderPath",
    default: "OneSeater/Templates",
  },

  // ─────────────────────────────────────────────────────────────
  // Plugin Behaviour
  // ─────────────────────────────────────────────────────────────
  {
    category: "Plugin",
    name: "Plugin Mode",
    desc: "Determines whether the plugin runs in game or realistic mode.",
    kind: "dropdown",
    path: "pluginMode",
    default: "GameSimulation",
    options: [
      { label: "Game Simulation", value: "GameSimulation" },
      { label: "Realistic Mode", value: "Realistic" },
    ],
  },
  {
    category: "Plugin",
    name: "Enable Cache",
    desc: "Caches generated data to improve performance.",
    kind: "toggle",
    path: "cacheEnabled",
    default: true,
  },

  // ─────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────
  {
    category: "Export",
    name: "Date Format",
    desc: "Moment / DayJS compatible date format.",
    kind: "text",
    path: "exportDateFormat",
    default: "YYYY-MM-DD",
  },
  {
    category: "Export",
    name: "Include Timestamp in Filename",
    desc: "Adds a timestamp suffix to exported files.",
    kind: "toggle",
    path: "includeTimestampInFilename",
    default: true,
  },
];

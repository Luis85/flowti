// =============================================================================
// CSV Importer for Obsidian QuickAdd + Modal Forms
// =============================================================================
// Features:
// - Reads CSV files from the vault (auto-detects delimiter: comma, semicolon, tab)
// - Creates one note per row in a configurable project folder
// - Adds CSV columns as frontmatter properties with customizable mapping
// - Supports markdown template files for note body with {{column_name}} placeholders
// - Persistent configuration storage (mapping + all settings) per CSV
// - Quick-start from saved configurations
// - Dry-run mode to preview changes before execution
// - Generates import log (Markdown) and index file (.base) after import
//
// Requirements:
// - QuickAdd plugin (this script runs as a QuickAdd macro/user script)
// - Progress modal utility at: var/scripts/utilities/import-progress-modal.js
// =============================================================================

"use strict";

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

/**
 * @typedef {Object} ColumnMapping
 * @property {string} header - Original CSV column header
 * @property {string} property - Target YAML property name
 * @property {string} example - Example value from the CSV data
 * @property {boolean} include - Whether to include this column in the import
 */

/**
 * @typedef {Object} StoredConfig
 * @property {string} id - Configuration identifier (CSV basename)
 * @property {string[]} headers - Original CSV headers
 * @property {string} title_template - Template for file naming
 * @property {ColumnMapping[]} columns - Column mapping configuration
 * @property {string} target_folder - Target folder path
 * @property {string} project_folder - Project folder name
 * @property {boolean} overwrite - Whether to overwrite existing files
 * @property {boolean} has_header_row - Whether CSV has header row
 * @property {string|null} body_template_path - Path to body template file
 * @property {string|null} detected_delimiter - Detected CSV delimiter
 * @property {string|null} csv_path - Path to the associated CSV file
 */

/**
 * @typedef {Object} ImportStats
 * @property {number} created - Number of newly created files
 * @property {number} overwritten - Number of overwritten files
 * @property {number} skipped - Number of skipped files
 * @property {number} failed - Number of failed imports
 * @property {number} duration - Import duration in milliseconds
 */

/**
 * @typedef {Object} LogEntry
 * @property {string} message - Log message
 * @property {string} level - Log level (info, success, warning, error)
 * @property {number} timestamp - Unix timestamp
 */

const CONFIG = {
  /** Default target folder for imports */
  DEFAULT_TARGET_FOLDER: "Sandbox/CSV Import",

  /** Folder where configurations are stored */
  CONFIG_FOLDER: "var/csv-import/configs",

  /** Path to the progress modal utility */
  PROGRESS_MODAL_PATH: "var/scripts/utilities/import-progress-modal.js",

  /** Supported CSV delimiters (in detection order) */
  SUPPORTED_DELIMITERS: [",", ";", "\t", "|"],

  /** Minimum rows to analyze for delimiter detection */
  DELIMITER_DETECTION_ROWS: 5,
};

const MESSAGES = {
  // Errors
  ERROR_NO_QUICKADD: "QuickAdd API not available.",
  ERROR_NO_CSV_FILES: "No CSV files found in your vault.",
  ERROR_NO_OPTIONS: "No CSV files or saved configurations found.",
  ERROR_FILE_NOT_FOUND: (path) => `File not found: ${path}`,
  ERROR_CSV_READ_FAILED: (path) => `Could not read CSV file: ${path}`,
  ERROR_NO_DATA: "No data found in the CSV file.",
  ERROR_NO_TARGET_FOLDER: "Please specify a target folder.",
  ERROR_FOLDER_CREATE_FAILED: (err) =>
    `Could not create target/project folder: ${err}`,
  ERROR_PATH_NOT_FOLDER: (path) => `Path exists and is not a folder: ${path}`,
  ERROR_FOLDER_CREATION_FAILED: (path) => `Failed to create folder: ${path}`,
  ERROR_ROW_IMPORT: (row, err) => `Error importing row ${row}: ${err}`,
  ERROR_TEMPLATE_READ: (path) => `Could not read template file: ${path}`,
  ERROR_CONFIG_CSV_NOT_FOUND: (path) =>
    `CSV file from saved config not found: ${path}`,

  // Cancellation
  CANCELLED_SELECTION: "Selection cancelled.",
  CANCELLED_BASE_CONFIG: "CSV import cancelled (base configuration).",
  CANCELLED_MAPPING_CHOICE: "CSV import cancelled (configuration choice).",
  CANCELLED_FILE_CONFIG: "CSV import cancelled (file configuration).",
  CANCELLED_BY_USER: "Import cancelled by user.",

  // Progress & Status
  STATUS_IMPORTING: (row, title) => `Row ${row}: ${title}`,
  STATUS_COMPLETE: "CSV import completed.",
  STATUS_WRITING_LOG: "Writing import log...",
  STATUS_WRITING_BASE: "Creating index file...",
  STATUS_OPENING_RESULT: "📂 Opening import result...",

  // Log messages
  LOG_TARGET_FOLDER: (path) => `📂 Target folder: ${path}`,
  LOG_PROJECT_FOLDER: (path) => `📁 Project folder: ${path}`,
  LOG_OVERWRITE_MODE: (enabled) =>
    `📝 Overwrite existing: ${enabled ? "yes" : "no"}`,
  LOG_HEADER_ROW: (has) => `🔤 CSV has header row: ${has ? "yes" : "no"}`,
  LOG_DRY_RUN: (enabled) => `🧪 Dry-run mode: ${enabled ? "yes" : "no"}`,
  LOG_DELIMITER: (d) => `🔣 Detected delimiter: "${d === "\t" ? "TAB" : d}"`,
  LOG_COLUMNS: (cols) => `📊 Columns: ${cols}`,
  LOG_BODY_TEMPLATE: (path) =>
    `📄 Body template: ${path || "(none - using default)"}`,
  LOG_CLEAR_FOLDER: (enabled) =>
    `🗑️ Clear folder before import: ${enabled ? "yes" : "no"}`,
  LOG_MAPPING_HEADER: "🧩 Active column → property mapping:",
  LOG_MAPPING_ACTIVE: (header, property, example) =>
    `  • "${header}" → "${property}"${example ? ` (e.g. "${example}")` : ""}`,
  LOG_MAPPING_SKIPPED: (header) => `  • "${header}" → (skipped)`,
  LOG_TEMPLATE_WARNING: (placeholders) =>
    `⚠️ Template contains unknown placeholders: ${placeholders.join(", ")}`,
  LOG_IMPORT_LOG_CREATED: (path) => `📋 Import log created: ${path}`,
  LOG_BASE_FILE_CREATED: (path) => `📑 Index file created: ${path}`,

  // File operations
  FILE_CREATED: (name) => `✅ Created: ${name}`,
  FILE_OVERWRITTEN: (name) => `♻️ Overwritten: ${name}`,
  FILE_SKIPPED: (name) => `⏭️ Skipped (already exists): ${name}`,
  FILE_WRITE_ERROR: (name) => `⚠️ Could not write: ${name}`,
  FILE_WOULD_CREATE: (name) => `🔍 Would create: ${name}`,
  FILE_WOULD_OVERWRITE: (name) => `🔍 Would overwrite: ${name}`,
  FILE_WOULD_SKIP: (name) => `🔍 Would skip: ${name}`,

  // Summary
  SUMMARY_HEADER: "----- Summary -----",
  SUMMARY_TOTAL: (n) => `📄 Total:       ${n}`,
  SUMMARY_CREATED: (n) => `✅ Created:     ${n}`,
  SUMMARY_OVERWRITTEN: (n) => `♻️ Overwritten: ${n}`,
  SUMMARY_SKIPPED: (n) => `⏭️ Skipped:     ${n}`,
  SUMMARY_FAILED: (n) => `❌ Failed:      ${n}`,
  SUMMARY_DURATION: (d) => `⏱️ Duration:    ${d}`,
  SUMMARY_DRY_RUN_NOTE: "ℹ️ This was a dry-run. No files were modified.",

  // Final notice
  NOTICE_COMPLETE: (created, overwritten, skipped, failed) =>
    `CSV import finished: ${created} created, ${overwritten} overwritten, ${skipped} skipped, ${failed} failed.`,
  NOTICE_DRY_RUN_COMPLETE: (wouldCreate, wouldOverwrite, wouldSkip) =>
    `Dry-run complete: ${wouldCreate} would be created, ${wouldOverwrite} would be overwritten, ${wouldSkip} would be skipped.`,
  NOTICE_CONFIG_SAVED: "Import configuration saved.",

  // Labels (for input dialogs)
  LABEL_EXISTING_IMPORT: "Use existing import",
  LABEL_EXISTING_IMPORT_PLACEHOLDER: "Select a saved import configuration",
  LABEL_NEW_IMPORT: "Create new import",
  LABEL_NEW_IMPORT_PLACEHOLDER: "Select a CSV file to import",
  LABEL_TARGET_FOLDER: "Target folder",
  LABEL_TARGET_PLACEHOLDER: "Vault/path/for/import",
  LABEL_PROJECT_FOLDER: "Project folder (under target)",
  LABEL_PROJECT_PLACEHOLDER: "Subfolder for this CSV import",
  LABEL_OVERWRITE: "Overwrite existing notes?",
  LABEL_HEADER_ROW: "CSV has header row?",
  LABEL_DRY_RUN: "Dry-run (preview only)?",
  LABEL_BODY_TEMPLATE: "Body template file (optional)",
  LABEL_BODY_TEMPLATE_PLACEHOLDER: "Select markdown template or leave empty",
  LABEL_CONFIG_MODE: (name) =>
    `Configuration for "${name}" found – use or redefine?`,
  LABEL_TITLE_TEMPLATE: "Title template",
  LABEL_TITLE_DESCRIPTION: "Use {{column_name}} or {{file_index}}",
  LABEL_COLUMN_MAPPING: (header) => `YAML property for "${header}"`,
  LABEL_COLUMN_DESCRIPTION_WITH_EXAMPLE: (example) =>
    `Example: ${example} (empty = skip)`,
  LABEL_COLUMN_DESCRIPTION: "Empty = skip this column",
  LABEL_SAVE_CONFIG: "Save configuration for reuse?",
  LABEL_CONFIG_ID: (id) => `Config id: ${id}`,

  // Options
  OPTION_YES: "yes",
  OPTION_NO: "no",
  OPTION_SKIP: "(skip)",
  OPTION_USE_SAVED: "Use saved configuration",
  OPTION_REDEFINE: "Redefine configuration",
  OPTION_NO_TEMPLATE: "(no template)",

  // Additional errors
  ERROR_NO_SELECTION: "Please select either an existing import or a CSV file.",
  ERROR_CONFIG_NOT_FOUND: (id) => `Configuration not found: ${id}`,

  // Clear folder
  LABEL_CLEAR_FOLDER: "Clear target folder before import?",
  LABEL_CLEAR_FOLDER_DESCRIPTION: "Removes all files except import logs (_*)",
  CONFIRM_CLEAR_FOLDER_TITLE: "⚠️ Clear target folder?",
  CONFIRM_CLEAR_FOLDER_MESSAGE: (folder, fileCount) =>
    `This will permanently delete ${fileCount} file(s) in:\n${folder}\n\nImport logs will be preserved.`,
  STATUS_CLEARING_FOLDER: "Clearing target folder…",
  LOG_FOLDER_ALREADY_EMPTY: (folderPath) =>
    `Target folder "${folderPath}" is already empty.`,
  LOG_FOLDER_CLEARED: (count) => `🗑️ Cleared ${count} file(s) from target folder`,
  LOG_FOLDER_CLEAR_SKIPPED: "⏭️ Folder clearing skipped by user",
  CANCELLED_CLEAR_CONFIRM: "Import cancelled (folder clear not confirmed).",
};

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Main entry point for the CSV Importer QuickAdd script.
 * @param {Object} params - QuickAdd parameters
 * @param {Object} params.app - Obsidian App instance
 * @param {Object} params.quickAddApi - QuickAdd API instance
 */
module.exports = async (params) => {
  const { app, quickAddApi } = params;

  const qa = quickAddApi || app.plugins.plugins.quickadd?.api;
  if (!qa) {
    new Notice(MESSAGES.ERROR_NO_QUICKADD);
    return;
  }

  // Load progress modal utility
  const progressUrl = app.vault.adapter.getResourcePath(
    CONFIG.PROGRESS_MODAL_PATH
  );
  const { createProgressOverlay } = await import(progressUrl);

  // -------------------------------------------------------------------------
  // Step 1: Select existing import OR new CSV 
  // -------------------------------------------------------------------------
  const startResult = await selectImportSource(app, qa);
  if (!startResult) return;

  const { csvFile, csvBaseName, csvContent, detectedDelimiter, storedConfig, useQuickStart } = startResult;

  // -------------------------------------------------------------------------
  // Step 2: Get configuration (quick-start, from storage, or user input)
  // -------------------------------------------------------------------------
  const importConfig = await getImportConfiguration(
    app,
    qa,
    csvBaseName,
    csvFile.path,
    csvContent,
    detectedDelimiter,
    storedConfig,
    useQuickStart
  );
  if (!importConfig) return;

  // -------------------------------------------------------------------------
  // Step 3: Parse CSV with final configuration
  // -------------------------------------------------------------------------
  const { headers, rows } = parseCSV(
    csvContent,
    importConfig.hasHeaderRow,
    importConfig.delimiter
  );

  if (!headers.length || !rows.length) {
    new Notice(MESSAGES.ERROR_NO_DATA);
    return;
  }

  // -------------------------------------------------------------------------
  // Step 4: Ensure target folders exist
  // -------------------------------------------------------------------------
  const folders = await ensureTargetFolders(
    app,
    importConfig.targetFolder,
    importConfig.projectFolder
  );
  if (!folders) return;

  // -------------------------------------------------------------------------
  // Step 5: Confirm folder clearing (if enabled)
  // -------------------------------------------------------------------------
  let shouldClearFolder = false;
  if (importConfig.clearFolder && !importConfig.dryRun) {
    const confirmed = await confirmClearFolder(app, qa, folders.project);
    if (confirmed === null) {
      // User cancelled selection
      new Notice(MESSAGES.CANCELLED_CLEAR_CONFIRM);
      return;
    }
    shouldClearFolder = confirmed;
  }


  // -------------------------------------------------------------------------
  // Step 6: Load body template if specified
  // -------------------------------------------------------------------------
  let bodyTemplate = null;
  if (importConfig.bodyTemplatePath) {
    bodyTemplate = await loadBodyTemplate(app, importConfig.bodyTemplatePath);
  }

  // -------------------------------------------------------------------------
  // Step 7: Validate template placeholders
  // -------------------------------------------------------------------------
  const templateWarnings = validateTemplate(
    importConfig.titleTemplate,
    headers
  );
  const bodyTemplateWarnings = bodyTemplate
    ? validateTemplate(bodyTemplate, headers)
    : [];

  // -------------------------------------------------------------------------
  // Step 8: Execute import with progress tracking
  // -------------------------------------------------------------------------
  await executeImport({
    app,
    csvFile,
    rows,
    headers,
    importConfig,
    folders,
    bodyTemplate,
    templateWarnings: [...templateWarnings, ...bodyTemplateWarnings],
    shouldClearFolder,
    createProgressOverlay,
  });
};

// =============================================================================
// WORKFLOW STEPS
// =============================================================================

/**
 * Prompts user to select an existing import config OR a new CSV file on one screen.
 * @param {Object} app - Obsidian App instance
 * @param {Object} qa - QuickAdd API
 * @returns {Promise<Object|null>} Result object with csvFile, config, etc. or null if cancelled
 */
async function selectImportSource(app, qa) {
  // Get available saved configurations
  const savedConfigs = await loadAllSavedConfigs(app);

  // Get available CSV files
  const csvFiles = app.vault.getFiles().filter((f) => f.extension === "csv");

  if (savedConfigs.length === 0 && csvFiles.length === 0) {
    new Notice(MESSAGES.ERROR_NO_OPTIONS);
    return null;
  }

  // Build options for existing imports
  const existingImportOptions = [];
  for (const config of savedConfigs) {
    existingImportOptions.push(`${config.id} → ${config.project_folder}`);
  }

  // Build options for new imports
  const newImportOptions = [...csvFiles.map((f) => f.path)];

  let selection;
  try {
    selection = await qa.requestInputs([
      {
        id: "existing_import",
        label: MESSAGES.LABEL_EXISTING_IMPORT,
        type: "suggester",
        options: existingImportOptions,
        placeholder: MESSAGES.LABEL_EXISTING_IMPORT_PLACEHOLDER,
      },
      {
        id: "new_import",
        label: MESSAGES.LABEL_NEW_IMPORT,
        type: "suggester",
        options: newImportOptions,
        placeholder: MESSAGES.LABEL_NEW_IMPORT_PLACEHOLDER,
      },
    ]);
  } catch (e) {
    console.error("Import source selection error:", e);
    new Notice(MESSAGES.CANCELLED_SELECTION);
    return null;
  }

  if (!selection) {
    new Notice(MESSAGES.CANCELLED_SELECTION);
    return null;
  }

  const existingChoice = selection.existing_import;
  const newChoice = selection.new_import;

  // Determine which option was selected (existing takes priority if both selected)
  const useExisting = existingChoice && existingChoice !== MESSAGES.OPTION_SKIP;
  const useNew = newChoice && newChoice !== MESSAGES.OPTION_SKIP;

  if (!useExisting && !useNew) {
    new Notice(MESSAGES.ERROR_NO_SELECTION);
    return null;
  }

  // Process existing import selection
  if (useExisting) {
    // Extract config id from the display string "id → project_folder"
    const configId = existingChoice.split(" → ")[0];
    const storedConfig = savedConfigs.find((c) => c.id === configId);

    if (!storedConfig) {
      new Notice(MESSAGES.ERROR_CONFIG_NOT_FOUND(configId));
      return null;
    }

    // Find the CSV file
    let csvFile = null;
    const csvPath = storedConfig.csv_path;

    if (csvPath) {
      csvFile = app.vault.getAbstractFileByPath(csvPath);
    }

    // If not found by stored path, try to find by name
    if (!csvFile) {
      csvFile = csvFiles.find(
        (f) => getBasenameFromPath(f.path) === storedConfig.id
      );
    }

    if (!csvFile) {
      new Notice(
        MESSAGES.ERROR_CONFIG_CSV_NOT_FOUND(csvPath || `${storedConfig.id}.csv`)
      );
      return null;
    }

    // Read CSV content
    let csvContent;
    try {
      csvContent = await app.vault.adapter.read(csvFile.path);
    } catch (err) {
      console.error("CSV read error:", err);
      new Notice(MESSAGES.ERROR_CSV_READ_FAILED(csvFile.path));
      return null;
    }

    const detectedDelimiter =
      storedConfig.detected_delimiter || detectDelimiter(csvContent);

    return {
      csvFile,
      csvBaseName: storedConfig.id,
      csvContent,
      detectedDelimiter,
      storedConfig,
      useQuickStart: true,
    };
  }

  // Process new import selection
  if (useNew) {
    const csvFile = app.vault.getAbstractFileByPath(newChoice);

    if (!csvFile) {
      new Notice(MESSAGES.ERROR_FILE_NOT_FOUND(newChoice));
      return null;
    }

    const csvBaseName = getBasenameFromPath(csvFile.path);

    // Read CSV content
    let csvContent;
    try {
      csvContent = await app.vault.adapter.read(csvFile.path);
    } catch (err) {
      console.error("CSV read error:", err);
      new Notice(MESSAGES.ERROR_CSV_READ_FAILED(csvFile.path));
      return null;
    }

    const detectedDelimiter = detectDelimiter(csvContent);

    // Check for existing configuration
    const configFilePath = `${CONFIG.CONFIG_FOLDER}/${csvBaseName}.json`;
    const storedConfig = await loadStoredConfig(app, configFilePath);

    return {
      csvFile,
      csvBaseName,
      csvContent,
      detectedDelimiter,
      storedConfig,
      useQuickStart: false,
    };
  }

  return null;
}

/**
 * Loads all saved configurations from the config folder.
 * @param {Object} app - Obsidian App instance
 * @returns {Promise<StoredConfig[]>} Array of saved configurations
 */
async function loadAllSavedConfigs(app) {
  const configs = [];

  const configFolder = app.vault.getAbstractFileByPath(CONFIG.CONFIG_FOLDER);
  if (!configFolder || !("children" in configFolder)) {
    return configs;
  }

  for (const file of configFolder.children) {
    if (file.extension !== "json") continue;

    try {
      const content = await app.vault.adapter.read(file.path);
      const config = JSON.parse(content);
      if (config.id && config.columns) {
        configs.push(config);
      }
    } catch (err) {
      console.error(`Failed to load config ${file.path}:`, err);
    }
  }

  // Sort by id
  configs.sort((a, b) => a.id.localeCompare(b.id));

  return configs;
}

/**
 * Gets import configuration (from storage or user input).
 * @param {Object} app - Obsidian App instance
 * @param {Object} qa - QuickAdd API
 * @param {string} csvBaseName - CSV base name
 * @param {string} csvPath - Path to CSV file
 * @param {string} csvContent - Raw CSV content
 * @param {string} detectedDelimiter - Auto-detected delimiter
 * @param {StoredConfig|null} storedConfig - Previously stored configuration
 * @param {boolean} useQuickStart - Whether to use quick-start mode
 * @returns {Promise<Object|null>} Import configuration or null if cancelled
 */
async function getImportConfiguration(
  app,
  qa,
  csvBaseName,
  csvPath,
  csvContent,
  detectedDelimiter,
  storedConfig,
  useQuickStart
) {
  // Quick-start mode: only ask for dry-run
  if (useQuickStart && storedConfig) {
    let dryRunChoice;
    try {
      dryRunChoice = await qa.requestInputs([
        {
          id: "dry_run",
          label: MESSAGES.LABEL_DRY_RUN,
          type: "dropdown",
          options: [MESSAGES.OPTION_NO, MESSAGES.OPTION_YES],
          defaultValue: MESSAGES.OPTION_NO,
        },
      ]);
    } catch (e) {
      console.error("Dry-run choice error:", e);
      return null;
    }

    return {
      targetFolder: storedConfig.target_folder,
      projectFolder: storedConfig.project_folder,
      overwrite: storedConfig.overwrite,
      hasHeaderRow: storedConfig.has_header_row,
      dryRun: dryRunChoice?.dry_run === MESSAGES.OPTION_YES,
      clearFolder: storedConfig.clear_folder || false,
      delimiter: storedConfig.detected_delimiter || detectedDelimiter,
      titleTemplate: storedConfig.title_template,
      columnMappings: storedConfig.columns,
      bodyTemplatePath: storedConfig.body_template_path,
      csvPath,
    };
  }

  // Check if stored config can be reused
  const canReuse = canReuseConfig(storedConfig, csvContent, detectedDelimiter);

  if (canReuse) {
    // Ask user whether to use stored configuration
    let modeChoice;
    try {
      modeChoice = await qa.requestInputs([
        {
          id: "config_mode",
          label: MESSAGES.LABEL_CONFIG_MODE(csvBaseName),
          type: "dropdown",
          options: [MESSAGES.OPTION_USE_SAVED, MESSAGES.OPTION_REDEFINE],
          defaultValue: MESSAGES.OPTION_USE_SAVED,
        },
      ]);
    } catch (e) {
      console.error("Config choice error:", e);
      new Notice(MESSAGES.CANCELLED_MAPPING_CHOICE);
      return null;
    }

    if (modeChoice?.config_mode === MESSAGES.OPTION_USE_SAVED) {
      // Only ask for dry-run when reusing config
      let dryRunChoice;
      try {
        dryRunChoice = await qa.requestInputs([
          {
            id: "dry_run",
            label: MESSAGES.LABEL_DRY_RUN,
            type: "dropdown",
            options: [MESSAGES.OPTION_NO, MESSAGES.OPTION_YES],
            defaultValue: MESSAGES.OPTION_NO,
          },
        ]);
      } catch (e) {
        console.error("Dry-run choice error:", e);
        return null;
      }

      return {
        targetFolder: storedConfig.target_folder,
        projectFolder: storedConfig.project_folder,
        overwrite: storedConfig.overwrite,
        hasHeaderRow: storedConfig.has_header_row,
        dryRun: dryRunChoice?.dry_run === MESSAGES.OPTION_YES,
        clearFolder: storedConfig.clear_folder || false,
        delimiter: storedConfig.detected_delimiter || detectedDelimiter,
        titleTemplate: storedConfig.title_template,
        columnMappings: storedConfig.columns,
        bodyTemplatePath: storedConfig.body_template_path,
        csvPath,
      };
    }
  }

  // Get fresh configuration from user
  return await requestFullConfiguration(
    app,
    qa,
    csvBaseName,
    csvPath,
    csvContent,
    detectedDelimiter
  );
}

/**
 * Requests full configuration from user.
 * @param {Object} app - Obsidian App instance
 * @param {Object} qa - QuickAdd API
 * @param {string} csvBaseName - CSV base name
 * @param {string} csvPath - Path to CSV file
 * @param {string} csvContent - Raw CSV content
 * @param {string} detectedDelimiter - Auto-detected delimiter
 * @returns {Promise<Object|null>} Configuration or null if cancelled
 */
async function requestFullConfiguration(
  app,
  qa,
  csvBaseName,
  csvPath,
  csvContent,
  detectedDelimiter
) {
  // Get available markdown files for body template selection
  const mdFiles = app.vault
    .getFiles()
    .filter((f) => f.extension === "md")
    .map((f) => f.path);
  const templateOptions = [MESSAGES.OPTION_NO_TEMPLATE, ...mdFiles];

  // Base configuration
  let baseConfig;
  try {
    baseConfig = await qa.requestInputs([
      {
        id: "target_folder",
        label: MESSAGES.LABEL_TARGET_FOLDER,
        type: "text",
        defaultValue: CONFIG.DEFAULT_TARGET_FOLDER,
        placeholder: MESSAGES.LABEL_TARGET_PLACEHOLDER,
      },
      {
        id: "project_folder",
        label: MESSAGES.LABEL_PROJECT_FOLDER,
        type: "text",
        defaultValue: csvBaseName,
        placeholder: MESSAGES.LABEL_PROJECT_PLACEHOLDER,
      },
      {
        id: "overwrite",
        label: MESSAGES.LABEL_OVERWRITE,
        type: "dropdown",
        options: [MESSAGES.OPTION_NO, MESSAGES.OPTION_YES],
        defaultValue: MESSAGES.OPTION_NO,
      },
      {
        id: "has_header_row",
        label: MESSAGES.LABEL_HEADER_ROW,
        type: "dropdown",
        options: [MESSAGES.OPTION_YES, MESSAGES.OPTION_NO],
        defaultValue: MESSAGES.OPTION_YES,
      },
      {
        id: "body_template",
        label: MESSAGES.LABEL_BODY_TEMPLATE,
        type: "suggester",
        options: templateOptions,
        placeholder: MESSAGES.LABEL_BODY_TEMPLATE_PLACEHOLDER,
      },
      {
        id: "clear_folder",
        label: MESSAGES.LABEL_CLEAR_FOLDER,
        type: "dropdown",
        options: [MESSAGES.OPTION_NO, MESSAGES.OPTION_YES],
        defaultValue: MESSAGES.OPTION_NO,
        description: MESSAGES.LABEL_CLEAR_FOLDER_DESCRIPTION,
      },
      {
        id: "dry_run",
        label: MESSAGES.LABEL_DRY_RUN,
        type: "dropdown",
        options: [MESSAGES.OPTION_NO, MESSAGES.OPTION_YES],
        defaultValue: MESSAGES.OPTION_NO,
      },
    ]);
  } catch (e) {
    console.error("Base configuration error:", e);
    new Notice(MESSAGES.CANCELLED_BASE_CONFIG);
    return null;
  }

  if (!baseConfig) {
    new Notice(MESSAGES.CANCELLED_BASE_CONFIG);
    return null;
  }

  const targetFolder = (baseConfig.target_folder ?? "").toString().trim();
  if (!targetFolder) {
    new Notice(MESSAGES.ERROR_NO_TARGET_FOLDER);
    return null;
  }

  const hasHeaderRow = baseConfig.has_header_row === MESSAGES.OPTION_YES;
  const bodyTemplatePath =
    baseConfig.body_template === MESSAGES.OPTION_NO_TEMPLATE
      ? null
      : baseConfig.body_template;

  // Parse CSV to get headers for mapping
  const { headers, rows } = parseCSV(
    csvContent,
    hasHeaderRow,
    detectedDelimiter
  );

  if (!headers.length) {
    new Notice(MESSAGES.ERROR_NO_DATA);
    return null;
  }

  // Column mapping configuration
  const mappingResult = await requestMappingFromUser(qa, headers, rows);
  if (!mappingResult) return null;

  const projectFolderRaw = (baseConfig.project_folder ?? csvBaseName)
    .toString()
    .trim();

  const config = {
    targetFolder: normalizePath(targetFolder),
    projectFolder:
      projectFolderRaw.length > 0 ? projectFolderRaw : csvBaseName,
    overwrite: baseConfig.overwrite === MESSAGES.OPTION_YES,
    hasHeaderRow,
    dryRun: baseConfig.dry_run === MESSAGES.OPTION_YES,
    clearFolder: baseConfig.clear_folder === MESSAGES.OPTION_YES,
    delimiter: detectedDelimiter,
    titleTemplate: mappingResult.titleTemplate,
    columnMappings: mappingResult.columnMappings,
    bodyTemplatePath,
    csvPath,
  };

  // Offer to save configuration
  await offerToSaveConfig(app, qa, csvBaseName, headers, config);

  return config;
}

/**
 * Checks if stored config can be reused with current CSV.
 * @param {StoredConfig|null} storedConfig - Stored configuration
 * @param {string} csvContent - Current CSV content
 * @param {string} detectedDelimiter - Detected delimiter
 * @returns {boolean} Whether config can be reused
 */
function canReuseConfig(storedConfig, csvContent, detectedDelimiter) {
  if (!storedConfig || !Array.isArray(storedConfig.columns)) {
    return false;
  }

  // Parse first row to check headers
  const delimiter = storedConfig.detected_delimiter || detectedDelimiter;
  const hasHeaderRow =
    storedConfig.has_header_row !== undefined
      ? storedConfig.has_header_row
      : true;

  const { headers } = parseCSV(csvContent, hasHeaderRow, delimiter);
  const storedHeaders = storedConfig.headers || [];

  return (
    storedHeaders.length === headers.length &&
    storedHeaders.every((h, i) => h === headers[i])
  );
}

/**
 * Loads stored configuration from file.
 * @param {Object} app - Obsidian App instance
 * @param {string} configFilePath - Path to config file
 * @returns {Promise<StoredConfig|null>} Stored config or null
 */
async function loadStoredConfig(app, configFilePath) {
  const configFile = app.vault.getAbstractFileByPath(configFilePath);
  if (!configFile) return null;

  try {
    const json = await app.vault.adapter.read(configFilePath);
    return JSON.parse(json);
  } catch (err) {
    console.error("Failed to read stored config:", err);
    return null;
  }
}

/**
 * Offers to save configuration for future reuse.
 * @param {Object} app - Obsidian App instance
 * @param {Object} qa - QuickAdd API
 * @param {string} configId - Configuration identifier
 * @param {string[]} headers - CSV headers
 * @param {Object} config - Import configuration
 */
async function offerToSaveConfig(app, qa, configId, headers, config) {
  try {
    const shouldSave = await qa.yesNoPrompt(
      MESSAGES.LABEL_SAVE_CONFIG,
      MESSAGES.LABEL_CONFIG_ID(configId)
    );

    if (shouldSave) {
      const configToStore = {
        id: configId,
        headers,
        title_template: config.titleTemplate,
        columns: config.columnMappings.map((m) => ({
          header: m.header,
          property: m.property,
          include: m.include,
          example: m.example,
        })),
        target_folder: config.targetFolder,
        project_folder: config.projectFolder,
        overwrite: config.overwrite,
        has_header_row: config.hasHeaderRow,
        clear_folder: config.clearFolder,
        body_template_path: config.bodyTemplatePath,
        detected_delimiter: config.delimiter,
        csv_path: config.csvPath,
      };

      const configFilePath = `${CONFIG.CONFIG_FOLDER}/${configId}.json`;
      await ensureFolderExists(app, CONFIG.CONFIG_FOLDER);
      await app.vault.adapter.write(
        configFilePath,
        JSON.stringify(configToStore, null, 2)
      );

      new Notice(MESSAGES.NOTICE_CONFIG_SAVED);
    }
  } catch (err) {
    console.error("Failed to save config:", err);
  }
}

/**
 * Requests mapping configuration from user.
 * @param {Object} qa - QuickAdd API
 * @param {string[]} headers - CSV headers
 * @param {Object[]} rows - CSV data rows
 * @returns {Promise<Object|null>} Mapping configuration or null if cancelled
 */
async function requestMappingFromUser(qa, headers, rows) {
  const initialMappings = buildInitialMappings(headers, rows);
  const defaultTemplate = getDefaultTitleTemplate(headers);

  const inputs = [
    {
      id: "title_template",
      label: MESSAGES.LABEL_TITLE_TEMPLATE,
      type: "text",
      defaultValue: defaultTemplate,
      description: MESSAGES.LABEL_TITLE_DESCRIPTION,
    },
    ...initialMappings.map((m, idx) => ({
      id: `map_${idx}`,
      label: MESSAGES.LABEL_COLUMN_MAPPING(m.header),
      type: "text",
      defaultValue: m.property,
      description: m.example
        ? MESSAGES.LABEL_COLUMN_DESCRIPTION_WITH_EXAMPLE(m.example)
        : MESSAGES.LABEL_COLUMN_DESCRIPTION,
    })),
  ];

  let values;
  try {
    values = await qa.requestInputs(inputs);
  } catch (e) {
    console.error("File configuration error:", e);
    new Notice(MESSAGES.CANCELLED_FILE_CONFIG);
    return null;
  }

  const titleTemplate = (values.title_template || defaultTemplate).toString();

  const columnMappings = initialMappings.map((m, idx) => {
    const raw = values[`map_${idx}`];
    const trimmed = (raw ?? "").toString().trim();

    return {
      ...m,
      include: trimmed.length > 0,
      property: trimmed || m.property,
    };
  });

  return { titleTemplate, columnMappings };
}

/**
 * Loads body template from file.
 * @param {Object} app - Obsidian App instance
 * @param {string} templatePath - Path to template file
 * @returns {Promise<string|null>} Template content or null
 */
async function loadBodyTemplate(app, templatePath) {
  try {
    return await app.vault.adapter.read(templatePath);
  } catch (err) {
    console.error("Template read error:", err);
    new Notice(MESSAGES.ERROR_TEMPLATE_READ(templatePath));
    return null;
  }
}

/**
 * Ensures target and project folders exist.
 * @param {Object} app - Obsidian App instance
 * @param {string} targetFolder - Normalized target folder path
 * @param {string} projectFolderName - Project folder name
 * @returns {Promise<Object|null>} Folder paths or null on error
 */
async function ensureTargetFolders(app, targetFolder, projectFolderName) {
  const projectFolderSlug = slugifyPathSegment(projectFolderName);
  const fullProjectPath = normalizePath(`${targetFolder}/${projectFolderSlug}`);
  const logsPath = normalizePath(`${targetFolder}/${projectFolderSlug}/logs`);

  try {
    await ensureFolderExists(app, targetFolder);
    await ensureFolderExists(app, fullProjectPath);
    await ensureFolderExists(app, logsPath);

    return {
      target: targetFolder,
      project: fullProjectPath,
    };
  } catch (err) {
    console.error("Folder creation error:", err);
    new Notice(MESSAGES.ERROR_FOLDER_CREATE_FAILED(String(err)));
    return null;
  }
}

/**
 * Asks the user whether the project folder should be cleared before import.
 * @returns {Promise<boolean|null>} true = clear, false = keep, null = user cancelled
 */
async function confirmClearFolder(app, qa, projectFolderPath) {
  const folderLabel = projectFolderPath || "/";

  try {
    const choice = await qa.suggester(
      [
        `🧹 Yes – clear folder "${folderLabel}" before import`,
        `❌ No – keep existing files`,
      ],
      ["yes", "no"]
    );

    if (!choice) return null;
    return choice === "yes";
  } catch (e) {
    console.error("Folder clear confirmation failed:", e);
    return null;
  }
}


/**
 * Validates template placeholders against available headers.
 * @param {string} template - Title template
 * @param {string[]} headers - Available CSV headers
 * @returns {string[]} Array of unknown placeholder names
 */
function validateTemplate(template, headers) {
  const placeholders = extractPlaceholders(template);
  const availableKeys = new Set([...headers, "file_index"]);

  return placeholders.filter((p) => !availableKeys.has(p));
}

/**
 * Extracts placeholder names from a template string.
 * @param {string} template - Template string
 * @returns {string[]} Array of placeholder names
 */
function extractPlaceholders(template) {
  const regex = /{{\s*([^}]+)\s*}}/g;
  const placeholders = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    placeholders.push(match[1].trim());
  }

  return placeholders;
}

/**
 * Executes the import process with progress tracking.
 * @param {Object} options - Import options
 */
async function executeImport(options) {
  const {
    app,
    csvFile,
    rows,
    headers,
    importConfig,
    folders,
    bodyTemplate,
    templateWarnings,
    shouldClearFolder, 
    createProgressOverlay,
  } = options;

  const totalItems = rows.length;

  // Initialize progress overlay
  const progress = createProgressOverlay("CSV Import");
  progress.setTitle(`CSV Import – ${csvFile.name}`);
  progress.setTotals({ itemsTotal: totalItems });

  // Collect log entries
  const logEntries = [];
  const logWrapper = createLogWrapper(progress, logEntries);

  // -----------------------------------------------------------------------
  // Phase A: Folder leeren (optional)
  // -----------------------------------------------------------------------
  let clearedFileCount = 0;
  if (shouldClearFolder && !importConfig.dryRun) {
    progress.setStatus(MESSAGES.STATUS_CLEARING_FOLDER);
    clearedFileCount = await clearFolderWithProgress(
      app,
      folders.project,
      progress,
      logWrapper
    );

    if (clearedFileCount > 0) {
      logWrapper.log(
        MESSAGES.LOG_FOLDER_CLEARED(clearedFileCount),
        "warning"
      );
    } else {
      logWrapper.log(
        MESSAGES.LOG_FOLDER_ALREADY_EMPTY?.(folders.project) ??
          `Target folder "${folders.project}" is already empty.`,
        "info"
      );
    }
  }

  // -----------------------------------------------------------------------
  // Phase B: Konfiguration & Import
  // -----------------------------------------------------------------------

  // Log configuration
  logImportConfiguration(logWrapper, {
    folders,
    importConfig,
    headers,
    templateWarnings,
    csvFile,
  });

  // Execute import loop
  const stats = await importRows({
    app,
    rows,
    progress,
    logWrapper,
    importConfig,
    bodyTemplate,
    projectFolder: folders.project,
  });

  // Log summary
  logImportSummary(logWrapper, stats, totalItems, importConfig.dryRun);

  // Create log file and base file (only if not dry-run)
  let baseFilePath = null;
  if (!importConfig.dryRun) {
    progress.setStatus(MESSAGES.STATUS_WRITING_LOG);

    const timestamp = formatTimestamp(new Date());
    const logFileName = `_import-log-${timestamp}.md`;
    const logFilePath = `${folders.project}/logs/${logFileName}`;

    await createImportLogFile(app, logFilePath, {
      csvFile,
      importConfig,
      headers,
      stats,
      logEntries,
    });
    logWrapper.log(MESSAGES.LOG_IMPORT_LOG_CREATED(logFilePath), "info");

    progress.setStatus(MESSAGES.STATUS_WRITING_BASE);

		const columnMappings = importConfig.columnMappings || [];
		const defaultProps = ["file.ctime"];
		const baseProperties = [
		  ...defaultProps,
		  ...columnMappings
		    .filter(m => m && m.include)
		    .map(m => (m.property || m.header || "").trim())
		    .filter(p => !!p),
		].filter((p, idx, arr) => arr.indexOf(p) === idx);
  
    baseFilePath = await createBaseFile(app, folders.project, true, baseProperties);
    logWrapper.log(MESSAGES.LOG_BASE_FILE_CREATED(baseFilePath), "info");
  }

  progress.setStatus(MESSAGES.STATUS_COMPLETE);

  // Show final notice
  if (importConfig.dryRun) {
    new Notice(
      MESSAGES.NOTICE_DRY_RUN_COMPLETE(
        stats.created,
        stats.overwritten,
        stats.skipped
      )
    );
  } else {
    new Notice(
      MESSAGES.NOTICE_COMPLETE(
        stats.created,
        stats.overwritten,
        stats.skipped,
        stats.failed
      )
    );
  }

  // Reveal the base file in navigator (only if not dry-run and not cancelled)
  if (baseFilePath && !progress.isCancelled() && !importConfig.dryRun) {
    progress.setStatus(MESSAGES.STATUS_OPENING_RESULT);
    await delay(500);
  }

  await delay(300);
  progress.close();

  // Open the base file after closing progress
  if (baseFilePath && !importConfig.dryRun) {
    await revealFileInNavigator(app, baseFilePath);
  }
}

// =============================================================================
// HELPER FUNCTIONS - LOG & OUTPUT FILES
// =============================================================================

/**
 * Creates a wrapper that logs to both progress overlay and log entries array.
 * @param {Object} progress - Progress overlay instance
 * @param {LogEntry[]} logEntries - Array to collect log entries
 * @returns {Object} Log wrapper with log method
 */
function createLogWrapper(progress, logEntries) {
  return {
    log: (message, level = "info") => {
      progress.log(message, level);
      logEntries.push({
        message,
        level,
        timestamp: Date.now(),
      });
    },
  };
}

/**
 * Creates the import log markdown file.
 * @param {Object} app - Obsidian App instance
 * @param {string} filePath - Path for the log file
 * @param {Object} data - Import data for the log
 */
async function createImportLogFile(app, filePath, data) {
  const { csvFile, importConfig, headers, stats, logEntries } = data;

  const lines = [
    "---",
    "type: import-log",
    `source: "${csvFile.path}"`,
    `imported: ${new Date().toISOString()}`,
    `total: ${stats.created + stats.overwritten + stats.skipped + stats.failed}`,
    `created: ${stats.created}`,
    `overwritten: ${stats.overwritten}`,
    `skipped: ${stats.skipped}`,
    `failed: ${stats.failed}`,
    `duration_ms: ${stats.duration}`,
    "---",
    "",
    "# CSV Import Log",
    "",
    "## Configuration",
    "",
    `- **Source CSV**: \`${csvFile.path}\``,
    `- **Target folder**: \`${importConfig.targetFolder}\``,
    `- **Project folder**: \`${importConfig.projectFolder}\``,
    `- **Delimiter**: \`${importConfig.delimiter === "\t" ? "TAB" : importConfig.delimiter}\``,
    `- **Overwrite mode**: ${importConfig.overwrite ? "yes" : "no"}`,
    `- **Clear folder**: ${importConfig.clearFolder ? "yes" : "no"}`,
    `- **Body template**: ${importConfig.bodyTemplatePath || "(default)"}`,
    "",
    "## Column Mapping",
    "",
    "| CSV Column | YAML Property | Included |",
    "|------------|---------------|----------|",
  ];

  for (const m of importConfig.columnMappings) {
    const included = m.include ? "✅" : "❌";
    lines.push(`| ${m.header} | ${m.property} | ${included} |`);
  }

  lines.push("");
  lines.push("## Import Log");
  lines.push("");
  lines.push("```");

  for (const entry of logEntries) {
    const levelIcon = getLevelIcon(entry.level);
    lines.push(`${levelIcon} ${entry.message}`);
  }

  lines.push("```");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total rows | ${stats.created + stats.overwritten + stats.skipped + stats.failed} |`);
  lines.push(`| Created | ${stats.created} |`);
  lines.push(`| Overwritten | ${stats.overwritten} |`);
  lines.push(`| Skipped | ${stats.skipped} |`);
  lines.push(`| Failed | ${stats.failed} |`);
  lines.push(`| Duration | ${formatDuration(stats.duration)} |`);

  const content = lines.join("\n");

  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}

/**
 * Gets icon for log level.
 * @param {string} level - Log level
 * @returns {string} Icon character
 */
function getLevelIcon(level) {
  switch (level) {
    case "success":
      return "✅";
    case "warning":
      return "⚠️";
    case "error":
      return "❌";
    default:
      return "ℹ️";
  }
}

/**
 * Builds the content for a .base file (Obsidian Bases view).
 * @param {string} folderPath - Folder path to filter
 * @param {string[]} properties - List of frontmatter properties to show as columns
 * @param {string} [sortProperty] - Optional default sort property
 * @returns {string} Base file content (YAML)
 */
function buildBaseFileContent(folderPath, properties = [], sortProperty) {
  const safePath = String(folderPath || "").replace(/"/g, '\\"');

  const cleanedProps = Array.from(
    new Set(
      (properties || [])
        .map(String)
        .map((p) => p.trim())
        .filter(Boolean)
        .filter((p) => p !== "file.name")
    )
  );

  const orderLines = [
    "      - file.name",
    ...cleanedProps.map((prop) => `      - ${prop}`),
  ];

  const sortBy = sortProperty || cleanedProps[0] || "file.name";

  const lines = [
    "filters:",
    "  and:",
    `    - file.inFolder(\"${safePath}\")`,
    '    - file.ext == "md"',
    "    - '!file.name.startsWith(\"_\")'",
    "views:",
    "  - type: table",
    "    name: Imported Files",
    "    order:",
    ...orderLines,
    "    sort:",
    `      - property: ${sortBy}`,
    "        direction: DESC",
  ];

  return lines.join("\n") + "\n";
}


/**
 * Creates or overwrites the .base file for a folder.
 * @param {App} app - Obsidian App instance
 * @param {string} baseFolder - Target folder path
 * @param {boolean} [overwrite=true] - Whether to overwrite existing file
 * @param {string[]} [properties=[]] - Properties to show in the Base view
 * @returns {Promise<string>} Path to the base file
 */
async function createBaseFile(app, baseFolder, overwrite = true, properties = []) {
  if (!baseFolder) {
    throw new Error("createBaseFile: baseFolder is required");
  }

  const normalizedFolder = baseFolder.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalizedFolder.split("/");
  const folderName = parts.pop() || "index";
  const parentPath = parts.join("/");

  const baseFilePath = parentPath
    ? `${parentPath}/${folderName}.base`
    : `${folderName}.base`;

  const content = buildBaseFileContent(normalizedFolder, properties);

  const existing = app.vault.getAbstractFileByPath(baseFilePath);

  if (existing) {
    if (!overwrite) {
      return baseFilePath;
    }
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(baseFilePath, content);
  }

  return baseFilePath;
}


/**
 * Formats a date as timestamp string for filenames.
 * @param {Date} date - Date to format
 * @returns {string} Formatted timestamp (YYYYMMDD-HHmmss)
 */
function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

// =============================================================================
// HELPER FUNCTIONS - IMPORT EXECUTION
// =============================================================================

/**
 * Logs import configuration to progress overlay.
 * @param {Object} logWrapper - Log wrapper instance
 * @param {Object} config - Configuration to log
 */
function logImportConfiguration(logWrapper, config) {
  const { folders, importConfig, headers, templateWarnings, csvFile } = config;

  logWrapper.log(`📥 Source CSV: ${csvFile.path}`, "info");
  logWrapper.log(MESSAGES.LOG_TARGET_FOLDER(folders.target), "info");
  logWrapper.log(MESSAGES.LOG_PROJECT_FOLDER(folders.project), "info");
  logWrapper.log(MESSAGES.LOG_OVERWRITE_MODE(importConfig.overwrite), "info");
  logWrapper.log(MESSAGES.LOG_HEADER_ROW(importConfig.hasHeaderRow), "info");
  logWrapper.log(MESSAGES.LOG_DRY_RUN(importConfig.dryRun), "info");
  logWrapper.log(MESSAGES.LOG_DELIMITER(importConfig.delimiter), "info");
  logWrapper.log(
    MESSAGES.LOG_BODY_TEMPLATE(importConfig.bodyTemplatePath),
    "info"
  );
  logWrapper.log(
    MESSAGES.LOG_CLEAR_FOLDER(importConfig.clearFolder),
    "info"
  );
  logWrapper.log(MESSAGES.LOG_COLUMNS(headers.join(", ")), "info");

  // Log template warnings if any
  if (templateWarnings.length > 0) {
    logWrapper.log(
      MESSAGES.LOG_TEMPLATE_WARNING(templateWarnings),
      "warning"
    );
  }

  logWrapper.log(MESSAGES.LOG_MAPPING_HEADER, "info");

  for (const m of importConfig.columnMappings) {
    if (m.include) {
      logWrapper.log(
        MESSAGES.LOG_MAPPING_ACTIVE(m.header, m.property, m.example),
        "info"
      );
    } else {
      logWrapper.log(MESSAGES.LOG_MAPPING_SKIPPED(m.header), "warning");
    }
  }
}

/**
 * Imports all rows with progress tracking.
 * @param {Object} options - Import options
 * @returns {Promise<ImportStats>} Import statistics
 */
async function importRows(options) {
  const {
    app,
    rows,
    progress,
    logWrapper,
    importConfig,
    bodyTemplate,
    projectFolder,
  } = options;

  const stats = {
    created: 0,
    overwritten: 0,
    skipped: 0,
    failed: 0,
    duration: 0,
  };

  const importStart = Date.now();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const rowNumber = index + 1;

    if (progress.isCancelled()) {
      logWrapper.log(MESSAGES.CANCELLED_BY_USER, "warning");
      break;
    }

    try {
      await importSingleRow({
        app,
        row,
        rowNumber,
        progress,
        logWrapper,
        importConfig,
        bodyTemplate,
        projectFolder,
        stats,
      });
    } catch (err) {
      console.error(`Row ${rowNumber} error:`, err);
      stats.failed++;
      logWrapper.log(
        MESSAGES.ERROR_ROW_IMPORT(rowNumber, String(err)),
        "error"
      );
    }

    progress.setProcessedItems(rowNumber);
  }

  stats.duration = Date.now() - importStart;
  return stats;
}

/**
 * Imports a single row.
 * @param {Object} options - Import options for single row
 */
async function importSingleRow(options) {
  const {
    app,
    row,
    rowNumber,
    progress,
    logWrapper,
    importConfig,
    bodyTemplate,
    projectFolder,
    stats,
  } = options;

  const { titleTemplate, columnMappings, overwrite, dryRun } = importConfig;

  // Generate title from template
  const titleRaw = applyTemplate(titleTemplate, {
    ...row,
    file_index: String(rowNumber),
  }).trim();

  const title = titleRaw || `Row ${rowNumber}`;
  const fileName = slugifyTitle(title) + ".md";
  const filePath = `${projectFolder}/${fileName}`;

  progress.setStatus(MESSAGES.STATUS_IMPORTING(rowNumber, title));

  const existing = app.vault.getAbstractFileByPath(filePath);

  // Handle dry-run mode
  if (dryRun) {
    if (existing && !overwrite) {
      stats.skipped++;
      logWrapper.log(MESSAGES.FILE_WOULD_SKIP(fileName), "info");
    } else if (existing && overwrite) {
      stats.overwritten++;
      logWrapper.log(MESSAGES.FILE_WOULD_OVERWRITE(fileName), "info");
    } else {
      stats.created++;
      logWrapper.log(MESSAGES.FILE_WOULD_CREATE(fileName), "info");
    }
    return;
  }

  // Handle existing file (skip if no overwrite)
  if (existing && !overwrite) {
    stats.skipped++;
    logWrapper.log(MESSAGES.FILE_SKIPPED(fileName), "info");
    return;
  }

  // Build file content
  const content = buildNoteContent(
    row,
    rowNumber,
    columnMappings,
    bodyTemplate
  );

  // Write file
  if (existing && overwrite) {
    await app.vault.modify(existing, content);
    stats.overwritten++;
    logWrapper.log(MESSAGES.FILE_OVERWRITTEN(fileName), "success");
  } else if (!existing) {
    await app.vault.create(filePath, content);
    stats.created++;
    logWrapper.log(MESSAGES.FILE_CREATED(fileName), "success");
  } else {
    stats.skipped++;
    logWrapper.log(MESSAGES.FILE_WRITE_ERROR(fileName), "warning");
  }
}

/**
 * Builds note content with frontmatter and body.
 * @param {Object} row - CSV row data
 * @param {number} rowNumber - Row number (1-indexed)
 * @param {ColumnMapping[]} columnMappings - Column mappings
 * @param {string|null} bodyTemplate - Optional body template
 * @returns {string} Complete note content
 */
function buildNoteContent(row, rowNumber, columnMappings, bodyTemplate) {
  const frontmatter = buildFrontmatterFromMapping(row, columnMappings);

  let body;
  if (bodyTemplate) {
    // Apply template with row data
    body = applyTemplate(bodyTemplate, {
      ...row,
      file_index: String(rowNumber),
    });
  } else {
    // Default: Include raw data as JSON for debugging
    body = ["```json", JSON.stringify(row, null, 2), "```"].join("\n");
  }

  return frontmatter + "\n\n" + body;
}

/**
 * Logs import summary to progress overlay.
 * @param {Object} logWrapper - Log wrapper instance
 * @param {ImportStats} stats - Import statistics
 * @param {number} totalItems - Total items processed
 * @param {boolean} dryRun - Whether this was a dry run
 */
function logImportSummary(logWrapper, stats, totalItems, dryRun) {
  logWrapper.log(MESSAGES.SUMMARY_HEADER, "info");
  logWrapper.log(MESSAGES.SUMMARY_TOTAL(totalItems), "info");
  logWrapper.log(MESSAGES.SUMMARY_CREATED(stats.created), "success");
  logWrapper.log(MESSAGES.SUMMARY_OVERWRITTEN(stats.overwritten), "info");
  logWrapper.log(MESSAGES.SUMMARY_SKIPPED(stats.skipped), "warning");
  logWrapper.log(MESSAGES.SUMMARY_FAILED(stats.failed), "error");
  logWrapper.log(
    MESSAGES.SUMMARY_DURATION(formatDuration(stats.duration)),
    "info"
  );

  if (dryRun) {
    logWrapper.log(MESSAGES.SUMMARY_DRY_RUN_NOTE, "info");
  }
}

// =============================================================================
// HELPER FUNCTIONS - CSV PARSING
// =============================================================================

/**
 * Detects the delimiter used in CSV content.
 * Analyzes first few rows to find consistent delimiter.
 * @param {string} content - Raw CSV content
 * @returns {string} Detected delimiter
 */
function detectDelimiter(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const sampleLines = lines.slice(0, CONFIG.DELIMITER_DETECTION_ROWS);

  if (sampleLines.length === 0) {
    return ","; // Default fallback
  }

  // Count occurrences of each delimiter in each line
  const delimiterScores = {};

  for (const delimiter of CONFIG.SUPPORTED_DELIMITERS) {
    const counts = sampleLines.map((line) =>
      countDelimiterOccurrences(line, delimiter)
    );

    // Check if delimiter produces consistent column counts
    const uniqueCounts = [...new Set(counts)];

    if (uniqueCounts.length === 1 && uniqueCounts[0] > 0) {
      // Perfect consistency - all lines have same number of delimiters
      delimiterScores[delimiter] = {
        consistency: 1,
        avgCount: uniqueCounts[0],
      };
    } else if (counts.every((c) => c > 0)) {
      // All lines have at least one occurrence
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance =
        counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) /
        counts.length;
      delimiterScores[delimiter] = {
        consistency: 1 / (1 + variance),
        avgCount,
      };
    }
  }

  // Find best delimiter (highest consistency, then highest count)
  let bestDelimiter = ",";
  let bestScore = { consistency: 0, avgCount: 0 };

  for (const [delimiter, score] of Object.entries(delimiterScores)) {
    if (
      score.consistency > bestScore.consistency ||
      (score.consistency === bestScore.consistency &&
        score.avgCount > bestScore.avgCount)
    ) {
      bestDelimiter = delimiter;
      bestScore = score;
    }
  }

  return bestDelimiter;
}

/**
 * Counts delimiter occurrences in a line, respecting quoted values.
 * @param {string} line - CSV line
 * @param {string} delimiter - Delimiter to count
 * @returns {number} Number of delimiter occurrences
 */
function countDelimiterOccurrences(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

/**
 * Parses CSV content into headers and rows.
 * @param {string} content - Raw CSV content
 * @param {boolean} hasHeaderRow - Whether first row is headers
 * @param {string} delimiter - Column delimiter
 * @returns {{headers: string[], rows: Object[]}} Parsed CSV data
 */
function parseCSV(content, hasHeaderRow, delimiter = ",") {
  const lines = splitCSVLines(content);
  if (!lines.length) return { headers: [], rows: [] };

  let headers = [];
  let startIndex = 0;

  if (hasHeaderRow) {
    headers = parseCSVLine(lines[0], delimiter);
    startIndex = 1;
  } else {
    const firstRowValues = parseCSVLine(lines[0], delimiter);
    headers = firstRowValues.map((_, index) => `Column ${index + 1}`);
    startIndex = 0;
  }

  const rows = [];

  for (let i = startIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter);
    if (!values.length) continue;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Splits CSV content into lines, handling quoted values with newlines.
 * @param {string} content - Raw CSV content
 * @returns {string[]} Array of CSV lines
 */
function splitCSVLines(content) {
  const lines = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      currentLine += char;
      if (inQuotes && nextChar === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "\n" && !inQuotes) {
      if (currentLine.trim().length > 0) lines.push(currentLine);
      currentLine = "";
    } else if (char === "\r" && nextChar === "\n" && !inQuotes) {
      if (currentLine.trim().length > 0) lines.push(currentLine);
      currentLine = "";
      i++;
    } else if (char === "\r" && !inQuotes) {
      if (currentLine.trim().length > 0) lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }

  if (currentLine.trim().length > 0) lines.push(currentLine);

  return lines;
}

/**
 * Parses a single CSV line into values.
 * @param {string} line - CSV line
 * @param {string} delimiter - Column delimiter
 * @returns {string[]} Array of values
 */
function parseCSVLine(line, delimiter = ",") {
  const values = [];
  let currentValue = "";
  let inQuotes = false;
  let startOfField = true;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && startOfField) {
      inQuotes = true;
      startOfField = false;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        currentValue += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = "";
      startOfField = true;
    } else {
      currentValue += char;
      startOfField = false;
    }
  }

  values.push(currentValue.trim());
  return values;
}

// =============================================================================
// HELPER FUNCTIONS - MAPPING
// =============================================================================

/**
 * Gets default title template based on headers.
 * @param {string[]} headers - CSV headers
 * @returns {string} Default title template
 */
function getDefaultTitleTemplate(headers) {
  return headers.length > 0 ? `{{${headers[0]}}}` : "{{file_index}}";
}

/**
 * Builds initial column mappings from headers and sample data.
 * @param {string[]} headers - CSV headers
 * @param {Object[]} rows - CSV data rows
 * @returns {ColumnMapping[]} Initial column mappings
 */
function buildInitialMappings(headers, rows) {
  return headers.map((header) => ({
    header,
    property: sanitizeYAMLKey(header),
    example: findExampleValue(rows, header),
    include: true,
  }));
}

/**
 * Finds first non-empty example value for a column.
 * @param {Object[]} rows - CSV data rows
 * @param {string} header - Column header
 * @returns {string} Example value or empty string
 */
function findExampleValue(rows, header) {
  for (const row of rows) {
    const value = row[header];
    if (value != null && String(value).trim().length > 0) {
      const str = String(value);
      return str.length > 50 ? str.substring(0, 47) + "..." : str;
    }
  }
  return "";
}

// =============================================================================
// HELPER FUNCTIONS - STRING & PATH UTILITIES
// =============================================================================

/**
 * Applies template substitution.
 * @param {string} template - Template string with {{placeholders}}
 * @param {Object} data - Data object for substitution
 * @returns {string} Processed string
 */
function applyTemplate(template, data) {
  if (!template) return "";
  return template.replace(/{{\s*([^}]+)\s*}}/g, (match, key) => {
    const k = String(key).trim();
    return data[k] ?? "";
  });
}

/**
 * Builds YAML frontmatter from row data and mappings.
 * @param {Object} row - CSV row data
 * @param {ColumnMapping[]} columnMappings - Column mappings
 * @returns {string} YAML frontmatter block
 */
function buildFrontmatterFromMapping(row, columnMappings) {
  const lines = ["---"];

  for (const m of columnMappings) {
    if (!m.include) continue;

    const key = (m.property ?? "").toString().trim();
    if (!key) continue;

    const rawValue = row[m.header];
    const yamlValue = formatYAMLValue(rawValue);

    lines.push(`${key}: ${yamlValue}`);
  }

  lines.push("---");
  return lines.join("\n");
}

/**
 * Sanitizes a string for use as a YAML key.
 * @param {string} key - Original key
 * @returns {string} Sanitized key
 */
function sanitizeYAMLKey(key) {
  return key
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * Formats a value for YAML output.
 * @param {*} value - Value to format
 * @returns {string} YAML-safe value
 */
function formatYAMLValue(value) {
  if (value == null) return '""';
  const str = String(value);
  if (/[:#{}[\],&*?|>]|^\s|\s$|^['"]/.test(str) || str === "") {
    return JSON.stringify(str);
  }
  return str;
}

/**
 * Extracts basename from a file path.
 * @param {string} path - File path
 * @returns {string} Base name without extension
 */
function getBasenameFromPath(path) {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const last = parts[parts.length - 1] || "";
  const dotIndex = last.lastIndexOf(".");
  return dotIndex > 0 ? last.substring(0, dotIndex) : last;
}

/**
 * Normalizes a file path (Windows → POSIX style).
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(path) {
  if (!path) return "";
  return path
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

/**
 * Makes a string safe for use as an Obsidian file/folder name.
 * - Lässt Dinge wie "00 - XYZ" bewusst durch.
 * - Entfernt nur wirklich problematische Zeichen (v.a. Windows: < > : " / \ | ? *).
 * - Normalisiert Whitespace auf einfache Leerzeichen.
 * - Entfernt führende/trailing Punkte/Leerzeichen (Windows mag das nicht).
 *
 * @param {string} str
 * @param {string} fallback Name, falls am Ende nichts Sinnvolles übrig bleibt
 * @returns {string}
 */
function toObsidianSafeName(str, fallback) {
  if (!str || !str.toString().trim()) return fallback;

  let s = str.toString();

  // Unicode normalisieren & Akzentzeichen entfernen (optional, aber meist ganz nett)
  s = s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  // Verbotene Zeichen (Windows) entfernen/ersetzen:
  // < > : " / \ | ? *
  s = s.replace(/[<>:"/\\|?*]/g, " ");

  // Whitespace normalisieren: mehrere Spaces/Tabs/Zeilenumbrüche → ein Space
  s = s.replace(/\s+/g, " ").trim();

  // Führende/trailing Punkte/Spaces entfernen (Windows-Dateinamen)
  s = s.replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");

  // Falls nach allem nichts mehr übrig ist: Fallback
  return s || fallback;
}

/**
 * Slugifies a string for use as a path segment (Obsidian folder / subfolder).
 * @param {string} str - String to clean
 * @returns {string} Obsidian-safe path segment
 */
function slugifyPathSegment(str) {
  return toObsidianSafeName(str, "project");
}

/**
 * Slugifies a title for use as a filename (ohne Extension).
 * @param {string} str - Title to clean
 * @returns {string} Filename-safe slug
 */
function slugifyTitle(str) {
  return toObsidianSafeName(str, "untitled");
}

/**
 * Ensures a folder exists, creating it if necessary.
 * @param {Object} app - Obsidian App instance
 * @param {string} folderPath - Folder path to ensure
 * @returns {Promise<Object>} Folder object
 */
async function ensureFolderExists(app, folderPath) {
  const normalized = normalizePath(folderPath);
  let folder = app.vault.getAbstractFileByPath(normalized);

  if (folder) {
    if (!("children" in folder)) {
      throw new Error(MESSAGES.ERROR_PATH_NOT_FOLDER(normalized));
    }
    return folder;
  }

  await app.vault.createFolder(normalized);
  folder = app.vault.getAbstractFileByPath(normalized);

  if (!folder) {
    throw new Error(MESSAGES.ERROR_FOLDER_CREATION_FAILED(normalized));
  }

  return folder;
}

/**
 * Formats a duration in milliseconds to human-readable string.
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;

  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min < 60) return `${min}m ${rest}s`;

  const h = Math.floor(min / 60);
  const mRest = min % 60;
  return `${h}h ${mRest}m`;
}

/**
 * Creates a promise that resolves after a specified delay.
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reveals a file in the Obsidian file navigator and opens it.
 * @param {Object} app - Obsidian App instance
 * @param {string} filePath - Path to the file to reveal
 */
async function revealFileInNavigator(app, filePath) {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    console.warn(`Cannot reveal file, not found: ${filePath}`);
    return;
  }

  try {
    // Reveal in file explorer
    const fileExplorer = app.workspace.getLeavesOfType("file-explorer")[0];
    if (fileExplorer?.view?.revealInFolder) {
      await fileExplorer.view.revealInFolder(file);
    }

    // Open the file in a new leaf
    await app.workspace.getLeaf(false).openFile(file);
  } catch (err) {
    console.error("Error revealing file:", err);
  }
}

/**
 * Clears markdown files in the given folder,
 * updating the progress overlay and logging each step.
 *
 * @param {App} app
 * @param {string} folderPath
 * @param {Object} progress - progress overlay instance
 * @param {Object} logWrapper - logger created by createLogWrapper
 * @returns {Promise<number>} number of deleted files
 */
async function clearFolderWithProgress(app, folderPath, progress, logWrapper) {
  const folder = app.vault.getAbstractFileByPath(folderPath);

  if (
    !folder ||
    typeof folder !== "object" ||
    !Array.isArray(folder.children)
  ) {
    logWrapper.log(
      `Target folder "${folderPath}" not found or is not a folder. Skipping clear step.`,
      "error"
    );
    return 0;
  }

  const isFile = (entry) =>
    entry &&
    typeof entry === "object" &&
    Object.prototype.hasOwnProperty.call(entry, "extension");

  const isFolder = (entry) =>
    entry &&
    typeof entry === "object" &&
    Array.isArray(entry.children);

  const filesToDelete = folder.children.filter(
    (child) => isFile(child) && child.extension === "md"
  );

  if (filesToDelete.length === 0) {
    logWrapper.log(
      `Target folder "${folderPath}" is already empty (no .md files).`,
      "info"
    );
    return 0;
  }

  const total = filesToDelete.length;
  let deleted = 0;

  for (const file of filesToDelete) {
    const current = deleted + 1;
    progress.setStatus(
      `Clearing folder… (${current}/${total}) – ${file.name}`
    );

    try {
      await app.vault.delete(file);
      deleted++;
      logWrapper.log(`Deleted file: ${file.path}`, "debug");
    } catch (err) {
      console.error("Error deleting file:", file.path, err);
      logWrapper.log(
        `Error deleting file: ${file.path} – ${err?.message ?? err}`,
        "error"
      );
    }
  }

  return deleted;
}


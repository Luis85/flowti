/**
 * Canvas Importer for Obsidian (QuickAdd Script)
 * 
 * Imports items from a Canvas file and creates structured notes.
 * Supports saving and loading import templates.
 * 
 * Requires: Modal Forms plugin, QuickAdd plugin
 */
module.exports = async (params) => {

  // ============================================================
  // CONFIGURATION & CONSTANTS
  // ============================================================

  const CONFIG = {
    paths: {
      core:      "var/scripts/canvas-importer/canvas-import-core.js",
      progress:  "var/scripts/utilities/import-progress-modal.js",
      baseFile:  "var/scripts/canvas-importer/canvas-import-basefile.js",
      logger:    "var/scripts/canvas-importer/canvas-import-logger.js",
      notes:     "var/scripts/canvas-importer/canvas-import-notes.js",
      canvas:    "var/scripts/canvas-importer/canvas-import-canvas.js",
      templates: "var/scripts/canvas-importer/templates.json"
    },
    defaults: {
      importMode:   "folder",
      hierarchy:    "product",
      overwrite:    false,
      tasks:        false,
      saveEmpty:    false,
      createBase:   true,
      createCanvas: true,
      debug:        false
    },
    timing: {
      overlayCloseDelay: 500,
      emptyImportDelay:  800
    },
    requiredPlugins: ["modalforms", "quickadd"],
    forms: {
      entryPoint: "canvas-importer-entry",
      config:     "canvas-importer",
      saveTemplate: "canvas-importer-save-template"
    }
  };

  const MESSAGES = {
    errors: {
      missingPlugins:   "Modal Forms and QuickAdd plugins are required for this script.",
      noCanvasFiles:    "No canvas files found...",
      fileNotFound:     "File not found!",
      importFailed:     (name, msg) => `❌ Canvas import "${name}" failed: ${msg}`,
      moduleLoadFailed: (name) => `Failed to load module: ${name}`,
      templateLoadFailed: "Failed to load templates",
      templateSaveFailed: "Failed to save template"
    },
    status: {
      readingCanvas:   (debug) => debug ? "Reading Canvas (dry run)" : "Reading Canvas",
      creatingNotes:   (debug) => debug ? "Simulating notes (dry run)" : "Creating notes for items",
      creatingSummary: (debug) => debug ? "Simulating note creation (dry run)" : "Creating summary note",
      creatingIndex:   (debug) => debug ? "Simulating index (dry run)" : "Creating index",
      buildingCanvas:  (debug) => debug ? "Simulating canvas (dry run)" : "Building canvas",
      importComplete:  (debug) => debug ? "✅ Dry run complete" : "✅ Import complete",
      importCancelled: "Import cancelled",
      importFailed:    "❌ Import failed",
      nothingToImport: "Nothing to import",
      opening:         (label) => `📂 Opening ${label}...`
    },
    templates: {
      saved:   (name) => `✅ Template "${name}" saved`,
      deleted: (name) => `🗑️ Template "${name}" deleted`,
      loaded:  (name) => `📋 Template "${name}" loaded`
    }
  };

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  /**
   * Safely loads a module from the vault, with error handling
   */
  const loadModule = async (relativePath, exportNames) => {
    try {
      const url = app.vault.adapter.getResourcePath(relativePath);
      const module = await import(url);
      
      if (!exportNames) {
        return module;
      }
      
      const missing = exportNames.filter(name => typeof module[name] !== "function");
      if (missing.length > 0) {
        console.warn(`Module ${relativePath} missing exports: ${missing.join(", ")}`);
      }
      
      return module;
    } catch (error) {
      console.error(MESSAGES.errors.moduleLoadFailed(relativePath), error);
      throw new Error(MESSAGES.errors.moduleLoadFailed(relativePath));
    }
  };

  /**
   * Validates that required plugins are available
   */
  const validatePlugins = (requiredPlugins) => {
    const plugins = {};
    const missing = [];
    
    for (const pluginId of requiredPlugins) {
      const plugin = app.plugins.plugins[pluginId];
      if (!plugin) {
        missing.push(pluginId);
      } else {
        plugins[pluginId] = plugin;
      }
    }
    
    if (missing.length > 0) {
      return { valid: false, missing, plugins: null };
    }
    
    return { valid: true, missing: [], plugins };
  };

  /**
   * Extracts the actual value from a ResultValue object
   */
  const unwrapResultValue = (resultValue) => {
    if (resultValue && typeof resultValue === "object" && "value" in resultValue) {
      return resultValue.value;
    }
    return resultValue;
  };

  /**
   * Safely extracts a field value from form results
   */
  const getFieldSafe = (result, fieldName, defaultValue = null) => {
    try {
      if (!result) {
        return defaultValue;
      }
      
      let rawValue = result[fieldName];
      
      if (rawValue === undefined && typeof result.getValue === "function") {
        rawValue = result.getValue(fieldName);
      }
      
      const value = unwrapResultValue(rawValue);
      
      return value !== undefined && value !== null ? value : defaultValue;
    } catch (error) {
      console.warn(`Failed to get field "${fieldName}":`, error);
      return defaultValue;
    }
  };

  /**
   * Creates a safe step executor that handles errors gracefully
   */
  const createSafeExecutor = (progress, importStats) => {
    return async (label, fn, options = {}) => {
      const { rethrow = false, onError = null } = options;
      
      try {
        return await fn();
      } catch (error) {
        console.error(`${label} error:`, error);
        
        safeCall(() => progress?.log?.(`⚠️ ${label} failed: ${error.message}`, "error"));
        
        if (isDuplicateError(error)) {
          importStats.duplicates = (importStats.duplicates || 0) + 1;
          safeCall(() => progress?.log?.(
            `↪️ Skipped existing file (duplicates: ${importStats.duplicates})`,
            "warning"
          ));
        }
        
        if (typeof onError === "function") {
          safeCall(() => onError(error));
        }
        
        if (rethrow) {
          throw error;
        }
        
        return null;
      }
    };
  };

  /**
   * Checks if an error indicates a duplicate/existing file
   */
  const isDuplicateError = (error) => {
    if (!error?.message) return false;
    const msg = error.message.toLowerCase();
    return msg.includes("already exists") || msg.includes("duplicate");
  };

  /**
   * Safely executes a function, ignoring any errors
   */
  const safeCall = (fn) => {
    try {
      return fn();
    } catch (_) {
      return undefined;
    }
  };

  /**
   * Delays execution for a specified duration
   */
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Calculates import units and steps for progress tracking
   */
  const calculateProgressMetrics = (filteredCount, importMode, createBaseFlag, createCanvasFlag) => {
    let totalUnits = 1;
    let steps = 1;

    if (importMode === "folder") {
      totalUnits += filteredCount;
      steps += 1;
      
      if (createBaseFlag) {
        totalUnits += 1;
        steps += 1;
      }
      if (createCanvasFlag) {
        totalUnits += 1;
        steps += 1;
      }
    } else {
      totalUnits += 1;
      steps += 1;
    }

    return { totalUnits, steps };
  };

  /**
   * Builds the final notice message based on import results
   */
  const buildNoticeMessage = (options) => {
    const {
      name,
      cancelled,
      debugFlag,
      createdCount,
      filteredCount,
      totalItems,
      skippedCount,
      duplicates,
      modeLabel
    } = options;

    if (cancelled) {
      return `⚠️ Canvas import "${name}" was cancelled – ` +
        `${createdCount} files created (logical) from ${filteredCount}/${totalItems} items, ` +
        `duplicates: ${duplicates}, ` +
        `${debugFlag ? "dry run" : "mode: " + modeLabel}.`;
    }
    
    if (debugFlag) {
      return `🧪 Dry run for canvas "${name}" finished – ` +
        `${filteredCount}/${totalItems} items considered, ` +
        `${createdCount} files would be created, ` +
        `${duplicates} duplicates, mode: ${modeLabel}.`;
    }
    
    return `✅ Canvas import "${name}" finished – ` +
      `${createdCount} files created (${filteredCount}/${totalItems} items considered, ` +
      `${skippedCount} items not turned into files, ` +
      `duplicates: ${duplicates}, mode: ${modeLabel}).`;
  };

  // ============================================================
  // TEMPLATE MANAGEMENT
  // ============================================================

  /**
   * Loads all saved templates from the templates file
   * @returns {Object} - { templates: Array, error: string|null }
   */
  const loadTemplates = async () => {
    try {
      const templatesFile = app.vault.getAbstractFileByPath(CONFIG.paths.templates);
      
      if (!templatesFile) {
        // No templates file yet - return empty array
        return { templates: [], error: null };
      }
      
      const content = await app.vault.read(templatesFile);
      const data = JSON.parse(content);
      
      // Ensure we have an array
      const templates = Array.isArray(data.templates) ? data.templates : [];
      
      return { templates, error: null };
    } catch (error) {
      console.error("Failed to load templates:", error);
      return { templates: [], error: error.message };
    }
  };

  /**
   * Saves the templates array to the templates file
   * @param {Array} templates - Array of template objects
   * @returns {boolean} - Success status
   */
  const saveTemplates = async (templates) => {
    try {
      const content = JSON.stringify({ 
        version: 1,
        updated: new Date().toISOString(),
        templates 
      }, null, 2);
      
      const templatesFile = app.vault.getAbstractFileByPath(CONFIG.paths.templates);
      
      if (templatesFile) {
        await app.vault.modify(templatesFile, content);
      } else {
        // Ensure directory exists
        const dir = CONFIG.paths.templates.substring(0, CONFIG.paths.templates.lastIndexOf("/"));
        const dirExists = app.vault.getAbstractFileByPath(dir);
        if (!dirExists) {
          await app.vault.createFolder(dir);
        }
        await app.vault.create(CONFIG.paths.templates, content);
      }
      
      return true;
    } catch (error) {
      console.error("Failed to save templates:", error);
      return false;
    }
  };

  /**
   * Adds or updates a template
   * @param {Object} template - Template object with name and config
   * @returns {boolean} - Success status
   */
  const saveTemplate = async (template) => {
    const { templates } = await loadTemplates();
    
    // Check if template with same name exists
    const existingIndex = templates.findIndex(t => t.name === template.name);
    
    if (existingIndex >= 0) {
      // Update existing
      templates[existingIndex] = {
        ...template,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Add new
      templates.push({
        ...template,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return saveTemplates(templates);
  };

  /**
   * Deletes a template by name
   * @param {string} templateName - Name of the template to delete
   * @returns {boolean} - Success status
   */
  const deleteTemplate = async (templateName) => {
    const { templates } = await loadTemplates();
    const filtered = templates.filter(t => t.name !== templateName);
    
    if (filtered.length === templates.length) {
      // Template not found
      return false;
    }
    
    return saveTemplates(filtered);
  };

  /**
   * Gets a template by name
   * @param {string} templateName - Name of the template
   * @returns {Object|null} - Template object or null
   */
  const getTemplate = async (templateName) => {
    const { templates } = await loadTemplates();
    return templates.find(t => t.name === templateName) || null;
  };

  /**
   * Updates an existing template with new configuration values
   * @param {string} templateName - Name of the template to update
   * @param {string} canvasPath - Current canvas path
   * @param {Object} formConfig - Current form configuration
   * @returns {boolean} - Success status
   */
  const updateTemplateConfig = async (templateName, canvasPath, formConfig) => {
    const { templates } = await loadTemplates();
    const templateIndex = templates.findIndex(t => t.name === templateName);
    
    if (templateIndex < 0) {
      return false;
    }
    
    // Update the template with current config
    templates[templateIndex] = {
      ...templates[templateIndex],
      canvasPath: canvasPath || templates[templateIndex].canvasPath,
      config: {
        folder:       formConfig.folder || "",
        importMode:   formConfig.importMode,
        hierarchy:    formConfig.hierarchy,
        overwrite:    formConfig.overwriteFlag,
        tasks:        formConfig.tasksFlag,
        saveEmpty:    !formConfig.skipEmptyFlag,
        createBase:   formConfig.createBaseFlag,
        createCanvas: formConfig.createCanvasFlag
      },
      updatedAt: new Date().toISOString()
    };
    
    return saveTemplates(templates);
  };

  /**
   * Creates a template object from the current form configuration
   * Note: createBase and createCanvas are set to false by default for templates
   * since these files don't need to be recreated on every import
   */
  const createTemplateFromConfig = (name, description, canvasPath, formConfig) => {
    return {
      name,
      description: description || "",
      canvasPath: canvasPath || "",
      config: {
        folder:       formConfig.folder || "",
        importMode:   formConfig.importMode,
        hierarchy:    formConfig.hierarchy,
        overwrite:    formConfig.overwriteFlag,
        tasks:        formConfig.tasksFlag,
        saveEmpty:    !formConfig.skipEmptyFlag,
        createBase:   false,  // Default false for templates - don't recreate every time
        createCanvas: false   // Default false for templates - don't recreate every time
      }
    };
  };

  /**
   * Converts a template to form default values
   */
  const templateToFormDefaults = (template, canvasBasename) => {
    const config = template.config || {};
    return {
      name:          canvasBasename,
      folder:        config.folder || "",
      import_mode:   config.importMode || CONFIG.defaults.importMode,
      hierarchy:     config.hierarchy || CONFIG.defaults.hierarchy,
      overwrite:     config.overwrite ?? CONFIG.defaults.overwrite,
      tasks:         config.tasks ?? CONFIG.defaults.tasks,
      save_empty:    config.saveEmpty ?? CONFIG.defaults.saveEmpty,
      create_base:   config.createBase ?? CONFIG.defaults.createBase,
      create_canvas: config.createCanvas ?? CONFIG.defaults.createCanvas,
      debug:         CONFIG.defaults.debug
    };
  };

  // ============================================================
  // ENTRY POINT DIALOG
  // ============================================================

  /**
   * Shows the initial entry point dialog with template selection or new canvas
   * @returns {Object|null} - { mode: 'template'|'new', template?, canvasPath? }
   */
  const showEntryPointDialog = async (quickAddApi, modalForm, canvasFiles, templates) => {
    const canvasPaths = canvasFiles.map(f => f.path);
    
    // Build template options for suggester
    const templateOptions = templates.map(t => t.description 
      ? `${t.name} → ${t.description}`
      : t.name
    );
    
    // Single request with both options
    let selection;
    try {
      selection = await quickAddApi.requestInputs([
        {
          id: "existing_template",
          label: "Vorlage verwenden",
          type: "suggester",
          options: templateOptions,
          placeholder: "Gespeicherte Vorlage auswählen"
        },
        {
          id: "new_canvas",
          label: "Neuer Import",
          type: "suggester",
          options: canvasPaths,
          placeholder: "Canvas Datei auswählen"
        }
      ]);
    } catch (e) {
      console.error("Entry selection error:", e);
      return null;
    }

    if (!selection) {
      return null;
    }

    const existingChoice = selection.existing_template;
    const newChoice = selection.new_canvas;

    // Determine which option was selected (existing takes priority if both selected)
    const useExisting = existingChoice && existingChoice.trim().length > 0;
    const useNew = newChoice && newChoice.trim().length > 0;

    if (!useExisting && !useNew) {
      new Notice("Bitte wähle eine Vorlage oder eine Canvas Datei.");
      return null;
    }

    // Process existing template selection
    if (useExisting) {
      // Extract template name from display string "Name → Description" or "Name"
      const templateName = existingChoice.split(" → ")[0].trim();
      
      const template = await getTemplate(templateName);
      if (!template) {
        new Notice(`Vorlage "${templateName}" nicht gefunden.`);
        return null;
      }

      // Template has a stored canvas path - ask user if they want to use it or select new
      let canvasPath = template.canvasPath;
      
      // If template has no canvas path or file doesn't exist, ask for canvas
      const storedCanvasExists = canvasPath && app.vault.getAbstractFileByPath(canvasPath);
      
      if (!storedCanvasExists) {
        // Need to select a canvas file
        const canvasSelection = await quickAddApi.requestInputs([
          {
            id: "canvas_select",
            label: "Canvas Datei auswählen",
            type: "suggester",
            options: canvasPaths,
            placeholder: "Pfad zur Canvas Datei"
          }
        ]);

        if (!canvasSelection?.canvas_select) {
          return null;
        }
        canvasPath = canvasSelection.canvas_select;
      }

      new Notice(MESSAGES.templates.loaded(templateName));
      return {
        mode: "template",
        template,
        canvasPath
      };
    }

    // Process new import selection
    if (useNew) {
      return {
        mode: "new",
        template: null,
        canvasPath: newChoice
      };
    }

    return null;
  };

  /**
   * Prompts user to save current config as template
   */
  const promptSaveTemplate = async (quickAddApi, canvasPath, formConfig) => {
    const saveResult = await quickAddApi.requestInputs([
      {
        id: "save_as_template",
        label: "Save this configuration as a template?",
        type: "dropdown",
        options: ["No", "Yes"],
        placeholder: "Save as template?"
      },
      {
        id: "template_name",
        label: "Template Name",
        type: "text",
        placeholder: "e.g., My Project Import"
      },
      {
        id: "template_description",
        label: "Description (optional)",
        type: "text",
        placeholder: "Brief description of this template"
      }
    ]);

    if (!saveResult || saveResult.save_as_template !== "Yes") {
      return;
    }

    const templateName = saveResult.template_name?.trim();
    if (!templateName) {
      new Notice("Template name is required.");
      return;
    }

    const template = createTemplateFromConfig(
      templateName,
      saveResult.template_description || "",
      canvasPath,
      formConfig
    );

    const success = await saveTemplate(template);
    if (success) {
      new Notice(MESSAGES.templates.saved(templateName));
    } else {
      new Notice(MESSAGES.errors.templateSaveFailed);
    }
  };

  // ============================================================
  // IMPORT STEP HANDLERS
  // ============================================================

  /**
   * Handles folder-mode import (creates individual note files)
   */
  const handleFolderImport = async (context) => {
    const {
      filteredItems,
      importOptions,
      progress,
      importStats,
      safeStep,
      modules
    } = context;

    const { createNotesAsFolder } = modules.notes;
    const { createBaseFile } = modules.baseFile;
    const { createCanvasFile } = modules.canvas;

    const {
      folder,
      name,
      canvasPath,
      hierarchy,
      tasksFlag,
      overwriteFlag,
      debugFlag,
      createBaseFlag,
      createCanvasFlag,
      originalEdges,
      jsonObj
    } = importOptions;

    let stepIndex = 2;
    let revealPath = null;
    let revealLabel = null;
    let filePathById = {};

    // Calculate baseFolder from input parameters (independent of import result)
    // This mirrors the logic in createNotesAsFolder
    const slugifyForPath = (str) => {
      if (!str) return "import";
      return str
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[<>:"/\\|?*]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[.\s]+/, "")
        .replace(/[.\s]+$/, "") || "import";
    };
    
    const projectSlug = slugifyForPath(name);
    const baseFolder = folder 
      ? `${folder}/${projectSlug}`.replace(/\/+/g, "/")
      : projectSlug;

    // Pre-calculate expected base file path
    const normalizedFolder = baseFolder.replace(/\\/g, "/").replace(/\/+$/, "");
    const folderParts = normalizedFolder.split("/");
    const folderName = folderParts[folderParts.length - 1] || "index";
    
    // Base file is INSIDE the baseFolder, named after the folder
    const expectedBasePath = `${normalizedFolder}/${folderName}.base`;
    const expectedCanvasPath = `${normalizedFolder}/${name}.canvas`;

    // Debug log paths
    if (debugFlag) {
      console.log("[Canvas Importer] baseFolder:", baseFolder);
      console.log("[Canvas Importer] expectedBasePath:", expectedBasePath);
      console.log("[Canvas Importer] expectedCanvasPath:", expectedCanvasPath);
    }

    // Step: Create item notes
    progress.setStepIndex(stepIndex, debugFlag 
      ? "Simulating item notes..." 
      : "Creating item notes...");
    progress.setStatus(MESSAGES.status.creatingNotes(debugFlag));

    const importResult = await safeStep(
      "Creating item notes",
      () => createNotesAsFolder(
        filteredItems,
        {
          folder,
          name,
          canvasPath,
          hierarchy,
          tasks: tasksFlag,
          overwrite: overwriteFlag,
          debug: debugFlag
        },
        progress,
        importStats
      )
    );

    if (importResult) {
      filePathById = importResult.filePathById || {};
    }

    // Step: Create base index file
    if (createBaseFlag && baseFolder) {
      stepIndex++;
      progress.setStepIndex(stepIndex, debugFlag 
        ? "Simulating base index..." 
        : "Creating base index file...");
      progress.setStatus(MESSAGES.status.creatingIndex(debugFlag));

      const baseFilePath = await safeStep(
        "Creating base index file",
        () => createBaseFile(baseFolder, overwriteFlag, debugFlag)
      );

      if (baseFilePath) {
        progress.log(
          debugFlag ? "[DRY RUN] Base file would be created" : "+ Base file",
          debugFlag ? "info" : "success"
        );
        if (!debugFlag) progress.advance(1);
        revealPath = baseFilePath;
        revealLabel = "base index";
      }
    }

    // Step: Create linked canvas
    if (createCanvasFlag && baseFolder) {
      stepIndex++;
      progress.setStepIndex(stepIndex, debugFlag 
        ? "Simulating linked canvas..." 
        : "Creating linked canvas...");
      progress.setStatus(MESSAGES.status.buildingCanvas(debugFlag));

      const canvasFilePath = await safeStep(
        "Creating linked canvas",
        () => createCanvasFile(
          baseFolder,
          name,
          jsonObj.nodes,
          originalEdges,
          filePathById,
          overwriteFlag,
          debugFlag
        )
      );

      if (canvasFilePath) {
        progress.log(
          debugFlag ? "[DRY RUN] Canvas file would be created" : "+ Canvas file",
          debugFlag ? "info" : "success"
        );
        if (!debugFlag) progress.advance(1);

        if (!revealPath) {
          revealPath = canvasFilePath;
          revealLabel = "linked canvas";
        }
      }
    }

    // Fallback: Check for existing base file or canvas, then first note
    if (!revealPath && !debugFlag) {
      // Try existing base file first
      const existingBaseFile = app.vault.getAbstractFileByPath(expectedBasePath);
      if (existingBaseFile) {
        revealPath = expectedBasePath;
        revealLabel = "base index";
        progress.log(`📂 Found existing base file: ${expectedBasePath}`, "info");
      }
      
      // Try existing canvas file
      if (!revealPath) {
        const existingCanvasFile = app.vault.getAbstractFileByPath(expectedCanvasPath);
        if (existingCanvasFile) {
          revealPath = expectedCanvasPath;
          revealLabel = "linked canvas";
          progress.log(`📂 Found existing canvas: ${expectedCanvasPath}`, "info");
        }
      }
      
      // Last fallback: first imported note
      if (!revealPath && filteredItems.length > 0 && Object.keys(filePathById).length > 0) {
        const firstId = filteredItems[0].id;
        if (filePathById[firstId]) {
          revealPath = filePathById[firstId];
          revealLabel = "first note";
        }
      }
    }

    return {
      importResult,
      baseFolder,
      filePathById,
      revealPath,
      revealLabel,
      stepIndex
    };
  };

  /**
   * Handles file-mode import (creates single summary file)
   */
  const handleFileImport = async (context) => {
    const {
      filteredItems,
      importOptions,
      progress,
      importStats,
      safeStep,
      modules
    } = context;

    const { createNotesAsSingleFile } = modules.notes;
    const {
      folder,
      name,
      canvasPath,
      tasksFlag,
      overwriteFlag,
      debugFlag
    } = importOptions;

    progress.setStepIndex(2, debugFlag 
      ? "Simulating summary note..." 
      : "Creating summary note...");
    progress.setStatus(MESSAGES.status.creatingSummary(debugFlag));

    const importResult = await safeStep(
      "Creating summary note",
      () => createNotesAsSingleFile(
        filteredItems,
        {
          folder,
          name,
          canvasPath,
          tasks: tasksFlag,
          overwrite: overwriteFlag,
          debug: debugFlag
        },
        progress,
        importStats
      )
    );

    let revealPath = null;
    let revealLabel = null;

    if (importResult?.filePath) {
      revealPath = importResult.filePath;
      revealLabel = debugFlag ? "simulated summary" : "summary note";
    }

    return {
      importResult,
      baseFolder: null,
      filePathById: {},
      revealPath,
      revealLabel,
      stepIndex: 2
    };
  };

  // ============================================================
  // MAIN EXECUTION
  // ============================================================

  // Validate required plugins
  const pluginValidation = validatePlugins(CONFIG.requiredPlugins);
  if (!pluginValidation.valid) {
    new Notice(MESSAGES.errors.missingPlugins);
    return;
  }

  const modalForm = pluginValidation.plugins.modalforms.api;
  const quickAddApi = pluginValidation.plugins.quickadd.api;

  // Find canvas files
  const canvasFiles = app.vault.getFiles().filter(f => f.extension === "canvas");
  if (canvasFiles.length === 0) {
    new Notice(MESSAGES.errors.noCanvasFiles);
    return;
  }

  // Load existing templates
  const { templates, error: templateError } = await loadTemplates();
  if (templateError) {
    console.warn("Template loading warning:", templateError);
  }

  // Show entry point dialog
  const entrySelection = await showEntryPointDialog(
    quickAddApi,
    modalForm,
    canvasFiles,
    templates
  );

  if (!entrySelection) {
    return;
  }

  const { mode: entryMode, template: selectedTemplate, canvasPath: selectedCanvasPath } = entrySelection;

  // Get the canvas file
  const abstractFile = app.vault.getAbstractFileByPath(selectedCanvasPath);
  if (!abstractFile) {
    new Notice(MESSAGES.errors.fileNotFound);
    return;
  }

  // Build form defaults based on template or defaults
  let formDefaults;
  if (entryMode === "template" && selectedTemplate) {
    formDefaults = templateToFormDefaults(selectedTemplate, abstractFile.basename);
  } else {
    formDefaults = {
      name: abstractFile.basename,
      folder: "",
      import_mode: CONFIG.defaults.importMode,
      hierarchy: CONFIG.defaults.hierarchy,
      overwrite: CONFIG.defaults.overwrite,
      tasks: CONFIG.defaults.tasks,
      save_empty: CONFIG.defaults.saveEmpty,
      create_base: CONFIG.defaults.createBase,
      create_canvas: CONFIG.defaults.createCanvas,
      debug: CONFIG.defaults.debug
    };
  }

  // Show configuration form
  const result = await modalForm.openForm(CONFIG.forms.config, { values: formDefaults });
  
  // Check if form was cancelled
  const resultStatus = unwrapResultValue(result.status) ?? result.status;
  if (resultStatus === "cancelled") {
    return;
  }

  // Extract form values with safe fallbacks
  const formConfig = {
    folder:          getFieldSafe(result, "folder", ""),
    name:            getFieldSafe(result, "name", abstractFile.basename) || abstractFile.basename,
    importMode:      getFieldSafe(result, "import_mode", CONFIG.defaults.importMode),
    hierarchy:       getFieldSafe(result, "hierarchy", CONFIG.defaults.hierarchy),
    overwriteFlag:   getFieldSafe(result, "overwrite", CONFIG.defaults.overwrite),
    tasksFlag:       getFieldSafe(result, "tasks", CONFIG.defaults.tasks),
    skipEmptyFlag:   !getFieldSafe(result, "save_empty", CONFIG.defaults.saveEmpty),
    createBaseFlag:  getFieldSafe(result, "create_base", CONFIG.defaults.createBase),
    createCanvasFlag: getFieldSafe(result, "create_canvas", CONFIG.defaults.createCanvas),
    debugFlag:       getFieldSafe(result, "debug", CONFIG.defaults.debug)
  };

  // Debug: Log extracted values to console for troubleshooting
  if (formConfig.debugFlag) {
    console.log("[Canvas Importer] Entry mode:", entryMode);
    console.log("[Canvas Importer] Selected template:", selectedTemplate);
    console.log("[Canvas Importer] Extracted form config:", formConfig);
    console.log("[Canvas Importer] Raw result object:", result);
  }

  // Prompt to save as template (only for new imports or if config changed)
  if (entryMode === "new") {
    await promptSaveTemplate(quickAddApi, selectedCanvasPath, formConfig);
  }

  // Alias for convenience
  const { name, debugFlag } = formConfig;

  // Initialize tracking
  const importStart = Date.now();
  const importStats = { duplicates: 0 };

  // State variables
  let progress = null;
  let shouldReveal = false;
  let finalRevealPath = null;
  let finalRevealLabel = null;

  try {
    // Load all required modules
    const modules = {
      canvas:   await loadModule(CONFIG.paths.canvas, ["createCanvasFile"]),
      notes:    await loadModule(CONFIG.paths.notes, ["createNotesAsFolder", "createNotesAsSingleFile"]),
      logger:   await loadModule(CONFIG.paths.logger, ["writeImportLog"]),
      baseFile: await loadModule(CONFIG.paths.baseFile, ["createBaseFile"]),
      progress: await loadModule(CONFIG.paths.progress, ["createProgressOverlay"]),
      core:     await loadModule(CONFIG.paths.core, [
        "extractLegendMapping",
        "buildItemsWithRelations",
        "filterItemsForImport",
        "getField",
        "revealFileInNavigator",
        "slugifyTitle"
      ])
    };

    const {
      extractLegendMapping,
      buildItemsWithRelations,
      filterItemsForImport,
      revealFileInNavigator,
      slugifyTitle
    } = modules.core;

    const { createProgressOverlay } = modules.progress;
    const { writeImportLog } = modules.logger;

    // Create progress overlay
    progress = createProgressOverlay(name);
    
    // Create safe executor with current progress and stats
    const safeStep = createSafeExecutor(progress, importStats);

    // --------------------------------------------------
    // Step 1: Parse Canvas
    // --------------------------------------------------
    progress.setStatus(MESSAGES.status.readingCanvas(debugFlag));
    progress.setStepIndex(1, "Parsing canvas file...");

    const raw = await app.vault.read(abstractFile);
    
    let jsonObj;
    try {
      jsonObj = JSON.parse(raw);
    } catch (parseError) {
      throw new Error(`Invalid canvas JSON: ${parseError.message}`);
    }

    progress.log(`Parsed canvas: ${abstractFile.basename}`, "success");

    // Extract legend and build items
    const legendMap = extractLegendMapping(jsonObj);
    if (legendMap) {
      progress.log(`Legend mappings: ${Object.keys(legendMap).length}`, "info");
    }

    const items = buildItemsWithRelations(jsonObj, legendMap);
    const originalEdges = jsonObj.edges || [];

    progress.log(`Found ${items.length} items, ${originalEdges.length} edges`, "info");

    // Filter items for import
    const filteredItems = filterItemsForImport(items, formConfig.skipEmptyFlag);
    const totalItems = items.length;
    const filteredCount = filteredItems.length;
    const configSkipped = totalItems - filteredCount;

    progress.log(
      `Importing ${filteredCount} items (${configSkipped} skipped by config/empty/file)`,
      "info"
    );

    // Calculate progress metrics
    const { totalUnits, steps } = calculateProgressMetrics(
      filteredCount,
      formConfig.importMode,
      formConfig.createBaseFlag,
      formConfig.createCanvasFlag
    );

    progress.setTotalUnits(totalUnits);
    progress.setSteps(steps);
    progress.setTotals({ itemsTotal: filteredCount });
    progress.advance(1); // Parsing complete

    // Handle empty import
    if (filteredItems.length === 0) {
      progress.setStatus(MESSAGES.status.nothingToImport);
      progress.log("No items to import after filtering.", "warning");
      await delay(CONFIG.timing.emptyImportDelay);
      progress.setStepIndex(steps, "Done");
      new Notice(`ℹ️ Canvas import "${name}": no items to import.`);
      return;
    }

    // --------------------------------------------------
    // Step 2+: Execute Import
    // --------------------------------------------------
    const importOptions = {
      ...formConfig,
      canvasPath: selectedCanvasPath,
      originalEdges,
      jsonObj
    };

    const importContext = {
      filteredItems,
      importOptions,
      progress,
      importStats,
      safeStep,
      modules
    };

    // Execute appropriate import mode
    const importResult = formConfig.importMode === "file"
      ? await handleFileImport(importContext)
      : await handleFolderImport(importContext);

    // Store reveal info for finally block
    finalRevealPath = importResult.revealPath;
    finalRevealLabel = importResult.revealLabel;

    // --------------------------------------------------
    // Finalization
    // --------------------------------------------------
    const importEnd = Date.now();
    const durationMs = importEnd - importStart;
    const createdCount = importResult.importResult?.createdCount || 0;
    const skippedCount = totalItems - createdCount;
    const logEntries = progress.getLogEntries();
    const cancelled = progress.getState().cancelled;

    // Write import log (logger handles path building with timestamp)
    await safeStep(
      "Writing import log",
      () => writeImportLog({
        name,
        canvasFileBaseName: abstractFile.basename,
        importMode: formConfig.importMode,
        hierarchy: formConfig.hierarchy,
        tasksFlag: formConfig.tasksFlag,
        skipEmptyFlag: formConfig.skipEmptyFlag,
        createBaseFlag: formConfig.createBaseFlag,
        createCanvasFlag: formConfig.createCanvasFlag,
        totalItems,
        filteredItems: filteredCount,
        createdFiles: createdCount,
        skippedItems: skippedCount,
        duplicates: importStats.duplicates || 0,
        importStart,
        importEnd,
        durationMs,
        dryRun: !!debugFlag,
        logEntries,
        baseFolder: importResult.baseFolder || formConfig.folder,
        summaryFilePath: formConfig.importMode === "file" && importResult.importResult 
          ? importResult.importResult.filePath 
          : null,
        debugFlag,
        progress,
        slugifyTitle
      })
    );

    // Log final statistics
    progress.log(
      `ℹ Files created (logical): ${createdCount} (Total items: ${totalItems}, ` +
      `filtered: ${filteredCount}, duplicates: ${importStats.duplicates || 0})`,
      "success"
    );

    // Update template with current config if we used one
    if (entryMode === "template" && selectedTemplate && !cancelled && !debugFlag) {
      const updateSuccess = await updateTemplateConfig(
        selectedTemplate.name,
        selectedCanvasPath,
        formConfig
      );
      if (updateSuccess) {
        progress.log(`📋 Template "${selectedTemplate.name}" updated with current config`, "info");
      }
    }

    // Set final status
    const finalStatus = cancelled
      ? MESSAGES.status.importCancelled
      : MESSAGES.status.importComplete(debugFlag);
    
    progress.setStatus(finalStatus);
    progress.setStepIndex(steps, "Done");

    if (!debugFlag) {
      progress.setProcessedItems(filteredCount);
    }

    // Show completion notice
    const modeLabel = formConfig.importMode === "folder" 
      ? "folder import" 
      : "single summary note";

    const noticeText = buildNoticeMessage({
      name,
      cancelled,
      debugFlag,
      createdCount,
      filteredCount,
      totalItems,
      skippedCount,
      duplicates: importStats.duplicates || 0,
      modeLabel
    });

    new Notice(noticeText);

    // Prepare to reveal result file
    if (finalRevealPath && !cancelled && !debugFlag) {
      const label = finalRevealLabel || "result";
      progress.setStatus(MESSAGES.status.opening(label));
      progress.setStepIndex(steps, `Opening ${label}`);
      shouldReveal = true;
    }

  } catch (error) {
    console.error("Canvas import error:", error);
    
    safeCall(() => {
      if (progress) {
        progress.setStatus(MESSAGES.status.importFailed);
        progress.log(`Error: ${error.message}`, "error");
      }
    });
    
    new Notice(MESSAGES.errors.importFailed(name, error.message));
    
  } finally {
    // Always close progress overlay
    if (progress) {
      await delay(CONFIG.timing.overlayCloseDelay);
      safeCall(() => progress.close());
    }

    // Reveal file after overlay is closed
    if (shouldReveal && finalRevealPath && !formConfig.debugFlag) {
      try {
        const { revealFileInNavigator } = await loadModule(CONFIG.paths.core, ["revealFileInNavigator"]);
        await revealFileInNavigator(finalRevealPath);
      } catch (e) {
        console.error("Failed to reveal file in navigator:", e);
      }
    }
  }
};
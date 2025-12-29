const CONFIG = {
  MAX_SLUG_LENGTH: 80,
  DEFAULT_STATUS: "new",
  DEFAULT_TYPE: "Node",
  DEFAULT_FOLDER_NAME: "canvas",
  DEFAULT_SINGLE_FILE_NAME: "canvas-import",
  UNTITLED: "Untitled",
  MAX_DUPLICATE_COUNTER: 1000
};

const MSG = {
  // General
  ERROR: "Error",
  INVALID_ITEM_DATA: "Invalid item data.",
  
  // Logger
  LOGGER_ERROR: "🔴 Logger error:",
  
  // Folder operations
  VAULT_NOT_AVAILABLE: "🚫 Vault not available",
  FOLDER_CREATE_ERROR: "📁❌ Failed to create folder '{path}': {error}",
  FILE_WRITE_ERROR: "📄❌ Failed to write '{path}': {error}",
  
  // Import process
  NO_ITEMS_TO_IMPORT: "📭 No items to import",
  ROOT_FOLDER: "📂 Root folder: {path}",
  ROOT_FOLDER_DRY: "📂 Root folder: {path} (dry run)",
  BASE_FOLDER_CREATE_ERROR: "📁❌ Could not create base folder: {path}",
  FOLDER_CREATE_FAILED: "📁❌ Could not create folder: {path}",
  IMPORT_CANCELLED: "🛑 Import cancelled",
  SKIP_INVALID_ITEM: "⚠️ Skipping invalid item: {preview}",
  SKIP_NO_SLUG: "⚠️ Skipping item without slug: {id}",
  ITEM_PROCESS_ERROR: "❌ Error processing '{slug}': {error}",
  SUMMARY_CREATE_ERROR: "❌ Error creating summary: {error}",
  
  // File operations - Dry run
  DRY_RUN_MODIFY: "🔄 [DRY RUN] ⟳ {name}",
  DRY_RUN_CREATE: "📝 [DRY RUN] + {name}",
  DRY_RUN_DUPLICATE: "📝 [DRY RUN] ⊕ duplicate {name}",
  DRY_RUN_SUMMARY_MODIFY: "🔄 [DRY RUN] ⟳ summary: {path}",
  DRY_RUN_SUMMARY_CREATE: "📝 [DRY RUN] + summary: {path}",
  DRY_RUN_SUMMARY_DUPLICATE: "📝 [DRY RUN] ⊕ duplicate summary ({path})",
  
  // File operations - Actual
  FILE_MODIFIED: "🔄 ⟳ {name}",
  FILE_CREATED: "✅ + {name}",
  FILE_DUPLICATE: "⚠️ ⊕ duplicate {name}",
  FILE_EXISTS: "⚠️ File already exists: {path}",
  FILE_ERROR: "❌ Error for {name}: {action}",
  SUMMARY_MODIFIED: "🔄 ⟳ summary: {path}",
  SUMMARY_CREATED: "✅ + summary: {path}",
  SUMMARY_DUPLICATE: "⚠️ ⊕ duplicate summary ({path})",
  SUMMARY_ERROR: "❌ Error creating: {action}",
  
  // Content labels
  LABEL_TYPE: "Type",
  LABEL_STATUS: "Status",
  LABEL_PARENT: "Parent",
  LABEL_UP: "Up",
  LABEL_DOWN: "Down",
  LABEL_PREV: "Prev",
  LABEL_NEXT: "Next",
  LABEL_LINKS: "Links",
  LABEL_TASK_OVERVIEW: "Task Overview",
  LABEL_GENERAL: "General",
  LABEL_CANVAS_IMPORT: "Canvas Import"
};

// ---------- Message Formatter ----------

/**
 * Formats a message template with placeholders
 * @param {string} template - Message template with {placeholder} syntax
 * @param {Object} params - Key-value pairs for replacement
 * @returns {string} Formatted message
 */
function formatMsg(template, params = {}) {
  if (!template) return "";
  
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value ?? "");
  }
  return result;
}

// ---------- Type Configuration ----------

const TYPE_ORDER = Object.freeze({
  // Flowchart Types (highest priority)
  Event: 1,
  Gateway: 2,
  Subprocess: 3,
  Data: 4,
  Document: 5,
  Database: 6,
  Terminator: 7,
  // Product Hierarchy
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
});

const TYPE_FOLDER_MAP = Object.freeze({
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
});

// ---------- Logger Wrapper ----------

/**
 * Safe logger wrapper for consistent logging
 */
function createLogger(progress) {
  const noop = () => {};
  
  if (!progress) {
    return {
      log: noop,
      info: noop,
      success: noop,
      warning: noop,
      error: noop,
      setProgress: noop,
      setProcessed: noop,
      advance: noop,
      isCancelled: () => false
    };
  }

  return {
    log: (msg, level = "info") => {
      try {
        if (typeof progress.log === "function") {
          progress.log(msg, level);
        }
      } catch (e) {
        console.error(MSG.LOGGER_ERROR, e);
      }
    },
    info: (msg) => progress.log?.(msg, "info"),
    success: (msg) => progress.log?.(msg, "success"),
    warning: (msg) => progress.log?.(msg, "warning"),
    error: (msg) => progress.log?.(msg, "error"),
    setProgress: (current, total) => {
      try {
        if (typeof progress.setItemProgress === "function") {
          progress.setItemProgress(current, total);
        }
      } catch (e) { /* ignore */ }
    },
    setProcessed: (count) => {
      try {
        if (typeof progress.setProcessedItems === "function") {
          progress.setProcessedItems(count);
        }
      } catch (e) { /* ignore */ }
    },
    advance: (n = 1) => {
      try {
        if (typeof progress.advance === "function") {
          progress.advance(n);
        }
      } catch (e) { /* ignore */ }
    },
    isCancelled: () => {
      try {
        return typeof progress.isCancelled === "function" && progress.isCancelled();
      } catch (e) {
        return false;
      }
    }
  };
}

// ---------- Validation Helpers ----------

/**
 * Checks if a value is a non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks if a value is an array (even if empty)
 */
function isArray(value) {
  return Array.isArray(value);
}

/**
 * Safe array access - always returns an array
 */
function ensureArray(value) {
  if (isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

/**
 * Validates an item and returns normalized version
 */
function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  // ID is required
  if (!item.id) {
    return null;
  }

  return {
    id: String(item.id),
    title: item.title || "",
    type: item.type || CONFIG.DEFAULT_TYPE,
    originalType: item.originalType || item.type || CONFIG.DEFAULT_TYPE,
    status: item.status || CONFIG.DEFAULT_STATUS,
    parent: item.parent || null,
    parentId: item.parentId || null,
    color: item.color || null,
    shape: item.shape || null,
    up: ensureArray(item.up),
    down: ensureArray(item.down),
    prev: ensureArray(item.prev),
    next: ensureArray(item.next)
  };
}

/**
 * Validates and normalizes options
 */
function normalizeOptions(options) {
  const opts = options || {};
  
  return {
    folder: typeof opts.folder === "string" ? opts.folder.trim() : "",
    name: typeof opts.name === "string" ? opts.name.trim() : "",
    canvasPath: typeof opts.canvasPath === "string" ? opts.canvasPath : "",
    hierarchy: opts.hierarchy || "flat",
    tasks: Boolean(opts.tasks),
    overwrite: Boolean(opts.overwrite),
    debug: Boolean(opts.debug)
  };
}

// ---------- String Utilities ----------

/**
 * Creates a safe filename from a title
 */
function slugifyTitle(title, maxLength) {
  const max = typeof maxLength === "number" && maxLength > 0 
    ? maxLength 
    : CONFIG.MAX_SLUG_LENGTH;

  if (!isNonEmptyString(title)) {
    return CONFIG.UNTITLED.toLowerCase();
  }

  let slug = title
    .replace(/^#+\s*/, "")               // Remove markdown headers
    .trim()
    .replace(/[\/\\:\*\?"<>\|#]/g, " ")  // Invalid characters (incl. #)
    .replace(/\.+$/g, "")                // Remove trailing dots
    .replace(/\s+/g, " ")                // Normalize multiple spaces
    .trim();

  if (!slug) {
    return CONFIG.UNTITLED.toLowerCase();
  }

  if (slug.length > max) {
    slug = slug.slice(0, max);
    // Try to break at word boundary
    const lastSpace = slug.lastIndexOf(" ");
    if (lastSpace > max * 0.5) {
      slug = slug.slice(0, lastSpace);
    }
    slug = slug.trim();
  }

  return slug || CONFIG.UNTITLED.toLowerCase();
}

/**
 * Escapes a string for YAML (double quotes)
 */
function escapeYamlString(value) {
  if (value == null) return "";
  
  const str = typeof value === "string" ? value : String(value);
  
  return str
    .replace(/\\/g, "\\\\")   // Backslashes first
    .replace(/"/g, '\\"')     // Then quotes
    .replace(/\n/g, "\\n")    // Newlines
    .replace(/\r/g, "\\r")    // Carriage returns
    .replace(/\t/g, "\\t");   // Tabs
}

/**
 * Parses title and body from raw text
 */
function parseTitleAndBody(raw) {
  const text = typeof raw === "string" ? raw.trim() : "";
  
  if (!text) {
    return { title: CONFIG.UNTITLED, body: "" };
  }

  const lines = text.split("\n");
  const firstNonEmptyIdx = lines.findIndex(l => l.trim().length > 0);
  
  if (firstNonEmptyIdx === -1) {
    return { title: text.slice(0, 100) || CONFIG.UNTITLED, body: "" };
  }

  let firstLine = lines[firstNonEmptyIdx].trim();

  // Cleanup first line
  firstLine = firstLine
    .replace(/^#+\s*/, "")                    // Markdown header
    .replace(/\*\*(.+?)\*\*/g, "$1")          // Bold markup
    .replace(/\*(.+?)\*/g, "$1")              // Italic markup
    .replace(/__(.+?)__/g, "$1")              // Bold (underscores)
    .replace(/_(.+?)_/g, "$1")                // Italic (underscores)
    .replace(/^[^\p{L}\p{N}]+/u, "")          // Leading special characters
    .trim();

  if (!firstLine) {
    firstLine = text.slice(0, 100) || CONFIG.UNTITLED;
  }

  // Body from remaining lines
  const bodyLines = lines.slice(firstNonEmptyIdx + 1);
  const body = bodyLines.join("\n").trim();

  return { title: firstLine, body };
}

// ---------- Filesystem Helpers ----------

/**
 * Checks if app.vault is available
 */
function hasVault() {
  return typeof app !== "undefined" 
    && app 
    && typeof app.vault === "object"
    && app.vault !== null;
}

/**
 * Gets the active file path or empty string
 */
function getActiveFilePath() {
  try {
    if (!hasVault()) return "";
    const activeFile = app.workspace?.getActiveFile?.();
    return activeFile?.parent?.path || "";
  } catch (e) {
    return "";
  }
}

/**
 * Creates a folder path recursively (with error handling)
 */
async function ensureFolder(path, logger) {
  if (!isNonEmptyString(path)) return true;
  if (!hasVault()) {
    logger?.error?.(MSG.VAULT_NOT_AVAILABLE);
    return false;
  }

  try {
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) return true;

    const parts = path.split("/").filter(p => p.length > 0);
    let current = "";

    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      
      const folderExists = app.vault.getAbstractFileByPath(current);
      if (!folderExists) {
        await app.vault.createFolder(current);
      }
    }
    
    return true;
  } catch (error) {
    logger?.error?.(formatMsg(MSG.FOLDER_CREATE_ERROR, { 
      path, 
      error: error.message || error 
    }));
    return false;
  }
}

/**
 * Determines target folder for an item based on hierarchy
 */
async function getTargetFolder(baseFolder, hierarchy, item, logger) {
  if (hierarchy !== "product") {
    return baseFolder;
  }

  const itemType = item?.type || CONFIG.DEFAULT_TYPE;
  const subFolder = TYPE_FOLDER_MAP[itemType] || "Other";
  const target = baseFolder ? `${baseFolder}/${subFolder}` : subFolder;
  
  await ensureFolder(target, logger);
  return target;
}

/**
 * Creates or updates a file
 */
async function writeFile(path, content, overwrite, logger) {
  if (!hasVault()) {
    logger?.error?.(MSG.VAULT_NOT_AVAILABLE);
    return { success: false, action: "error" };
  }

  try {
    const existing = app.vault.getAbstractFileByPath(path);
    
    if (existing) {
      if (overwrite) {
        await app.vault.modify(existing, content);
        return { success: true, action: "modified" };
      } else {
        return { success: false, action: "exists" };
      }
    } else {
      await app.vault.create(path, content);
      return { success: true, action: "created" };
    }
  } catch (error) {
    logger?.error?.(formatMsg(MSG.FILE_WRITE_ERROR, { 
      path, 
      error: error.message || error 
    }));
    return { success: false, action: "error", error };
  }
}

/**
 * Finds a unique file path (with counter suffix if needed)
 */
function findUniquePath(basePath, extension, usedPaths) {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  let candidatePath = `${basePath}${ext}`;
  let counter = 1;
  let isDuplicate = false;

  while (
    (hasVault() && app.vault.getAbstractFileByPath(candidatePath)) ||
    usedPaths?.has?.(candidatePath)
  ) {
    isDuplicate = true;
    candidatePath = `${basePath} ${counter}${ext}`;
    counter++;
    
    // Safety limit to prevent infinite loops
    if (counter > CONFIG.MAX_DUPLICATE_COUNTER) {
      candidatePath = `${basePath} ${Date.now()}${ext}`;
      break;
    }
  }

  usedPaths?.add?.(candidatePath);
  
  return { path: candidatePath, isDuplicate };
}

// ---------- Link Building ----------

/**
 * Factory for link builder with preconfigured meta lookup
 * @param {Object} metaById - Meta information by item ID
 * @param {Function} linkFormat - Optional custom link formatter
 * @returns {Function} Link builder function
 */
function createLinkBuilder(metaById, linkFormat) {
  /**
   * Creates links from a list of IDs
   * @param {Array} ids - Array of item IDs
   * @returns {Array} Array of Markdown links
   */
  return function makeLinks(ids) {
    if (!isArray(ids) || ids.length === 0) {
      return [];
    }

    const seenIds = new Set();
    const links = [];

    for (const id of ids) {
      // Skip null/undefined and duplicates
      if (id == null || seenIds.has(id)) continue;
      seenIds.add(id);

      const meta = metaById?.[id];
      if (!meta) continue;

      let link;
      if (typeof linkFormat === "function") {
        link = linkFormat(meta, id);
      } else if (meta.slug) {
        // Standard: Wikilink with slug as filename
        link = `[[${meta.slug}|${meta.title}]]`;
      } else {
        link = `[[${meta.title}]]`;
      }
      
      if (link) links.push(link);
    }

    return links;
  };
}

// ---------- Content Builders ----------

/**
 * Builds frontmatter YAML from an object
 */
function buildFrontmatter(data) {
  let fm = "---\n";
  
  for (const [key, value] of Object.entries(data)) {
    // Skip null, undefined, empty strings and empty arrays
    if (value == null) continue;
    if (value === "") continue;
    if (isArray(value) && value.length === 0) continue;

    if (isArray(value)) {
      fm += `${key}:\n`;
      for (const v of value) {
        fm += `  - "${escapeYamlString(v)}"\n`;
      }
    } else {
      fm += `${key}: "${escapeYamlString(value)}"\n`;
    }
  }
  
  fm += "---\n\n";
  return fm;
}

/**
 * Builds the content of a single note
 */
function buildNoteContent(item, options) {
  const { canvasPath, tasks, noteMetaById, isDuplicate } = options;

  const normalizedItem = normalizeItem(item);
  if (!normalizedItem) {
    return `---\ntitle: "${MSG.ERROR}"\n---\n\n# ${MSG.ERROR}\n\n${MSG.INVALID_ITEM_DATA}\n`;
  }

  const meta = noteMetaById?.[normalizedItem.id] || parseTitleAndBody(normalizedItem.title);
  const makeLinks = createLinkBuilder(noteMetaById);

  // Tags
  const tags = [];
  if (tasks) tags.push("task");
  tags.push(`type/${normalizedItem.type.toLowerCase()}`);
  if (isDuplicate) tags.push("duplicate");

  // Links
  const upLinks = makeLinks(normalizedItem.up);
  const downLinks = makeLinks(normalizedItem.down);
  const prevLinks = makeLinks(normalizedItem.prev);
  const nextLinks = makeLinks(normalizedItem.next);

  // Frontmatter
  const fmData = {
    title: meta.title,
    status: normalizedItem.status,
    id: normalizedItem.id,
    parent: normalizedItem.parent ? `[[${normalizedItem.parent}]]` : null,
    parent_id: normalizedItem.parentId,
    type: normalizedItem.type,
    original_type: normalizedItem.originalType,
    color: normalizedItem.color,
    shape: normalizedItem.shape,
    up: upLinks,
    down: downLinks,
    prev: prevLinks,
    next: nextLinks,
    source: canvasPath ? `[[${canvasPath}]]` : null,
    tags: tags
  };

  const fm = buildFrontmatter(fmData);

  // Body
  let body = `# ${meta.title}\n\n`;
  
  if (meta.body) {
    body += meta.body + "\n";
  }

  // Link Section
  const linkLines = [];
  if (upLinks.length) linkLines.push(`- **${MSG.LABEL_UP}**: ${upLinks.join(", ")}`);
  if (downLinks.length) linkLines.push(`- **${MSG.LABEL_DOWN}**: ${downLinks.join(", ")}`);
  if (prevLinks.length) linkLines.push(`- **${MSG.LABEL_PREV}**: ${prevLinks.join(", ")}`);
  if (nextLinks.length) linkLines.push(`- **${MSG.LABEL_NEXT}**: ${nextLinks.join(", ")}`);

  if (linkLines.length > 0) {
    body += `\n---\n\n## ${MSG.LABEL_LINKS}\n\n${linkLines.join("\n")}\n`;
  }

  return fm + body;
}

/**
 * Builds the content for a single-file summary
 */
function buildSingleFileContent(items, options) {
  const { canvasPath, tasks, fileBaseName } = options;

  // Tags
  const tags = [];
  if (tasks) tags.push("task");
  tags.push("canvas-import");

  // Frontmatter
  const fmData = {
    title: `${MSG.LABEL_CANVAS_IMPORT} - ${fileBaseName}`,
    status: CONFIG.DEFAULT_STATUS,
    source: canvasPath ? `[[${canvasPath}]]` : null,
    tags: tags
  };
  const fm = buildFrontmatter(fmData);

  // Prepare meta for all items
  const metaById = {};
  for (const item of items) {
    const normalized = normalizeItem(item);
    if (!normalized) continue;
    
    const rawTitle = normalized.title || `${normalized.type} - ${normalized.id}`;
    metaById[normalized.id] = parseTitleAndBody(rawTitle);
  }

  // Link builder for internal heading links
  const makeLinks = createLinkBuilder(metaById, (meta) => {
    return `[[${fileBaseName}#${meta.title}|${meta.title}]]`;
  });

  let body = "";

  // Task Overview (if enabled)
  if (tasks) {
    body += `## ${MSG.LABEL_TASK_OVERVIEW}\n\n`;
    
    const sortedItems = [...items]
      .map(normalizeItem)
      .filter(Boolean)
      .sort((a, b) => {
        const typeOrderA = TYPE_ORDER[a.type] ?? 99;
        const typeOrderB = TYPE_ORDER[b.type] ?? 99;
        if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
        
        const titleA = metaById[a.id]?.title || "";
        const titleB = metaById[b.id]?.title || "";
        return titleA.localeCompare(titleB);
      });

    for (const item of sortedItems) {
      const meta = metaById[item.id];
      if (!meta) continue;
      body += `- [ ] **${item.type}**: [[${fileBaseName}#${meta.title}|${meta.title}]]\n`;
    }
    
    body += "\n---\n\n";
  }

  // Group by parent
  const groupsByParent = new Map();
  
  for (const item of items) {
    const normalized = normalizeItem(item);
    if (!normalized) continue;
    
    const parentKey = normalized.parent || MSG.LABEL_GENERAL;
    
    if (!groupsByParent.has(parentKey)) {
      groupsByParent.set(parentKey, []);
    }
    groupsByParent.get(parentKey).push(normalized);
  }

  // Sorted output of groups
  const sortedParentKeys = [...groupsByParent.keys()].sort((a, b) => {
    // "General" always first
    if (a === MSG.LABEL_GENERAL) return -1;
    if (b === MSG.LABEL_GENERAL) return 1;
    return a.localeCompare(b);
  });

  for (const parentKey of sortedParentKeys) {
    const groupItems = groupsByParent.get(parentKey);
    
    // Sort items within group
    groupItems.sort((a, b) => {
      const typeOrderA = TYPE_ORDER[a.type] ?? 99;
      const typeOrderB = TYPE_ORDER[b.type] ?? 99;
      if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
      
      const titleA = metaById[a.id]?.title || "";
      const titleB = metaById[b.id]?.title || "";
      return titleA.localeCompare(titleB);
    });

    body += `## ${parentKey}\n\n`;

    for (const item of groupItems) {
      const meta = metaById[item.id];
      if (!meta) continue;

      const upLinks = makeLinks(item.up);
      const downLinks = makeLinks(item.down);
      const prevLinks = makeLinks(item.prev);
      const nextLinks = makeLinks(item.next);

      body += `### ${meta.title}\n\n`;
      body += `- **${MSG.LABEL_TYPE}**: ${item.type}\n`;
      body += `- **${MSG.LABEL_STATUS}**: ${item.status}\n`;
      
      if (item.parent) body += `- **${MSG.LABEL_PARENT}**: ${item.parent}\n`;
      if (upLinks.length) body += `- **${MSG.LABEL_UP}**: ${upLinks.join(", ")}\n`;
      if (downLinks.length) body += `- **${MSG.LABEL_DOWN}**: ${downLinks.join(", ")}\n`;
      if (prevLinks.length) body += `- **${MSG.LABEL_PREV}**: ${prevLinks.join(", ")}\n`;
      if (nextLinks.length) body += `- **${MSG.LABEL_NEXT}**: ${nextLinks.join(", ")}\n`;

      if (meta.body) {
        body += `\n${meta.body}\n`;
      }

      body += "\n---\n\n";
    }
  }

  return fm + body.trim();
}

// ---------- Main Export Functions ----------

/**
 * Creates notes as separate files in a folder
 */
export async function createNotesAsFolder(items, options, progress, importStats) {
  const logger = createLogger(progress);
  const opts = normalizeOptions(options);
  
  // Validation
  if (!isArray(items) || items.length === 0) {
    logger.warning(MSG.NO_ITEMS_TO_IMPORT);
    return { createdCount: 0, baseFolder: "", filePathById: {}, processedItems: 0 };
  }

  // Determine root folder
  let rootFolder = opts.folder || getActiveFilePath();
  
  const nameSlug = slugifyTitle(opts.name || CONFIG.DEFAULT_FOLDER_NAME);
  const baseFolder = rootFolder ? `${rootFolder}/${nameSlug}` : nameSlug;

  // Create folder (except in debug mode)
  if (!opts.debug) {
    const folderCreated = await ensureFolder(baseFolder, logger);
    if (!folderCreated) {
      logger.error(formatMsg(MSG.BASE_FOLDER_CREATE_ERROR, { path: baseFolder }));
      return { createdCount: 0, baseFolder, filePathById: {}, processedItems: 0 };
    }
  }

  logger.info(formatMsg(opts.debug ? MSG.ROOT_FOLDER_DRY : MSG.ROOT_FOLDER, { path: baseFolder }));

  // Prepare meta information for all items
  const noteMetaById = {};
  const validItems = [];
  
  for (const item of items) {
    const normalized = normalizeItem(item);
    if (!normalized) {
      logger.warning(formatMsg(MSG.SKIP_INVALID_ITEM, { 
        preview: JSON.stringify(item).slice(0, 100) 
      }));
      continue;
    }
    
    validItems.push(normalized);
    
    const rawTitle = normalized.title || `${normalized.type} - ${normalized.id}`;
    const { title, body } = parseTitleAndBody(rawTitle);
    const slug = slugifyTitle(title);
    
    noteMetaById[normalized.id] = { title, body, slug };
  }

  const usedPaths = new Set();
  const filePathById = {};
  let createdFiles = 0;
  let processedItems = 0;
  const total = validItems.length;

  // Process items
  for (let i = 0; i < validItems.length; i++) {
    // Cancel check
    if (logger.isCancelled()) {
      logger.warning(MSG.IMPORT_CANCELLED);
      break;
    }

    const item = validItems[i];
    const meta = noteMetaById[item.id];
    
    processedItems++;
    logger.setProgress(processedItems, total);
    logger.setProcessed(processedItems);

    if (!meta?.slug) {
      logger.warning(formatMsg(MSG.SKIP_NO_SLUG, { id: item.id }));
      continue;
    }

    try {
      // Determine target folder
      const itemFolder = await getTargetFolder(baseFolder, opts.hierarchy, item, logger);
      const basePathNoExt = `${itemFolder}/${meta.slug}`;

      if (opts.overwrite) {
        // Overwrite mode: directly overwrite
        const filePath = `${basePathNoExt}.md`;
        const content = buildNoteContent(item, {
          canvasPath: opts.canvasPath,
          tasks: opts.tasks,
          noteMetaById,
          isDuplicate: false
        });

        if (opts.debug) {
          const exists = hasVault() && app.vault.getAbstractFileByPath(filePath);
          logger.log(
            formatMsg(exists ? MSG.DRY_RUN_MODIFY : MSG.DRY_RUN_CREATE, { name: meta.slug }),
            exists ? "warning" : "info"
          );
        } else {
          const result = await writeFile(filePath, content, true, logger);
          
          if (result.success) {
            logger.log(
              formatMsg(result.action === "modified" ? MSG.FILE_MODIFIED : MSG.FILE_CREATED, { name: meta.slug }),
              result.action === "modified" ? "warning" : "success"
            );
            createdFiles++;
          } else {
            logger.error(formatMsg(MSG.FILE_ERROR, { name: meta.slug, action: result.action }));
          }
        }
        
        filePathById[item.id] = filePath;
        
      } else {
        // No overwrite: find unique path
        const { path: filePath, isDuplicate } = findUniquePath(basePathNoExt, "md", usedPaths);
        
        const content = buildNoteContent(item, {
          canvasPath: opts.canvasPath,
          tasks: opts.tasks,
          noteMetaById,
          isDuplicate
        });

        if (opts.debug) {
          logger.log(
            formatMsg(isDuplicate ? MSG.DRY_RUN_DUPLICATE : MSG.DRY_RUN_CREATE, { name: meta.slug }),
            isDuplicate ? "warning" : "info"
          );
        } else {
          const result = await writeFile(filePath, content, false, logger);
          
          if (result.success) {
            logger.log(
              formatMsg(isDuplicate ? MSG.FILE_DUPLICATE : MSG.FILE_CREATED, { name: meta.slug }),
              isDuplicate ? "warning" : "success"
            );
            createdFiles++;
          } else if (result.action === "exists") {
            // Should not happen due to findUniquePath, but just in case
            logger.warning(formatMsg(MSG.FILE_EXISTS, { path: filePath }));
          } else {
            logger.error(formatMsg(MSG.FILE_ERROR, { name: meta.slug, action: result.action }));
          }
        }

        if (isDuplicate && importStats) {
          importStats.duplicates = (importStats.duplicates || 0) + 1;
        }

        filePathById[item.id] = filePath;
      }

      if (!opts.debug) {
        logger.advance(1);
      }
      
    } catch (error) {
      logger.error(formatMsg(MSG.ITEM_PROCESS_ERROR, { 
        slug: meta.slug, 
        error: error.message || error 
      }));
    }
  }

  return {
    createdCount: createdFiles,
    baseFolder,
    filePathById,
    processedItems
  };
}

/**
 * Creates a single summary file
 */
export async function createNotesAsSingleFile(items, options, progress, importStats) {
  const logger = createLogger(progress);
  const opts = normalizeOptions(options);

  // Validation
  if (!isArray(items) || items.length === 0) {
    logger.warning(MSG.NO_ITEMS_TO_IMPORT);
    return { createdCount: 0, filePath: "" };
  }

  // Determine root folder
  let rootFolder = opts.folder || getActiveFilePath();

  // Create folder (except in debug mode)
  if (!opts.debug && rootFolder) {
    const folderCreated = await ensureFolder(rootFolder, logger);
    if (!folderCreated) {
      logger.error(formatMsg(MSG.FOLDER_CREATE_FAILED, { path: rootFolder }));
      return { createdCount: 0, filePath: "" };
    }
  }

  const nameSlug = slugifyTitle(opts.name || CONFIG.DEFAULT_SINGLE_FILE_NAME);
  const basePathNoExt = rootFolder ? `${rootFolder}/${nameSlug}` : nameSlug;

  try {
    // Create file content
    const content = buildSingleFileContent(items, {
      canvasPath: opts.canvasPath,
      tasks: opts.tasks,
      fileBaseName: nameSlug
    });

    let filePath;
    let isDuplicate = false;

    if (opts.overwrite) {
      // Overwrite mode
      filePath = `${basePathNoExt}.md`;
      
      if (opts.debug) {
        const exists = hasVault() && app.vault.getAbstractFileByPath(filePath);
        logger.log(
          formatMsg(exists ? MSG.DRY_RUN_SUMMARY_MODIFY : MSG.DRY_RUN_SUMMARY_CREATE, { path: filePath }),
          exists ? "warning" : "info"
        );
      } else {
        const result = await writeFile(filePath, content, true, logger);
        
        if (result.success) {
          logger.log(
            formatMsg(result.action === "modified" ? MSG.SUMMARY_MODIFIED : MSG.SUMMARY_CREATED, { path: filePath }),
            result.action === "modified" ? "warning" : "success"
          );
        } else {
          logger.error(formatMsg(MSG.SUMMARY_ERROR, { action: result.action }));
          return { createdCount: 0, filePath: "" };
        }
      }
    } else {
      // No overwrite: find unique path
      const unique = findUniquePath(basePathNoExt, "md", new Set());
      filePath = unique.path;
      isDuplicate = unique.isDuplicate;

      if (opts.debug) {
        logger.log(
          formatMsg(isDuplicate ? MSG.DRY_RUN_SUMMARY_DUPLICATE : MSG.DRY_RUN_SUMMARY_CREATE, { path: filePath }),
          isDuplicate ? "warning" : "info"
        );
      } else {
        const result = await writeFile(filePath, content, false, logger);
        
        if (result.success) {
          logger.log(
            formatMsg(isDuplicate ? MSG.SUMMARY_DUPLICATE : MSG.SUMMARY_CREATED, { path: filePath }),
            isDuplicate ? "warning" : "success"
          );
        } else {
          logger.error(formatMsg(MSG.SUMMARY_ERROR, { action: result.action }));
          return { createdCount: 0, filePath: "" };
        }
      }

      if (isDuplicate && importStats) {
        importStats.duplicates = (importStats.duplicates || 0) + 1;
      }
    }

    if (!opts.debug) {
      logger.advance(1);
      logger.setProcessed(items.length);
    }

    return {
      createdCount: 1,
      filePath
    };
    
  } catch (error) {
    logger.error(formatMsg(MSG.SUMMARY_CREATE_ERROR, { error: error.message || error }));
    return { createdCount: 0, filePath: "" };
  }
}
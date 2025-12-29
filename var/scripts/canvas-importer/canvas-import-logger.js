/**
 * Canvas Import Logger
 * 
 * Writes structured import logs to the project's logs folder.
 */

function escapeYamlString(value) {
  if (value == null) return "";
  if (typeof value !== "string") value = String(value);
  return value.replace(/"/g, '\\"');
}

function formatDurationMs(ms) {
  if (ms == null || isNaN(ms)) return "";
  const totalSeconds = Math.floor(ms / 1000);
  const msRemainder = ms % 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  if (seconds || (!hours && !mins)) parts.push(`${seconds}s`);
  if (!hours && !mins && seconds === 0) parts.push(`${msRemainder}ms`);

  return parts.join(" ");
}

/**
 * Formats a timestamp for use in filenames (filesystem-safe)
 * Example: 2024-01-15_143052
 */
function formatTimestampForFilename(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date();
  }
  const pad = (n) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`;
}

/**
 * Sanitizes a string for use in filenames
 */
function sanitizeFilename(name, maxLength = 50) {
  if (!name) return "unnamed";
  return name
    .replace(/[\\/:*?"<>|]/g, "-")  // Remove invalid filename chars
    .replace(/\s+/g, "-")            // Replace spaces with dashes
    .replace(/-+/g, "-")             // Collapse multiple dashes
    .replace(/^-|-$/g, "")           // Trim leading/trailing dashes
    .substring(0, maxLength);
}

/**
 * Ensures a folder exists in the vault, creating it recursively if needed
 */
async function ensureFolderExists(folderPath) {
  if (!folderPath) return;
  
  const existingFolder = app.vault.getAbstractFileByPath(folderPath);
  if (existingFolder) return;
  
  // Create parent folders if needed
  const parts = folderPath.split("/");
  let currentPath = "";
  
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(currentPath);
    if (!existing) {
      try {
        await app.vault.createFolder(currentPath);
      } catch (e) {
        // Folder might have been created by another process
        if (!e.message?.includes("already exists")) {
          throw e;
        }
      }
    }
  }
}

export function buildImportLogMarkdown(context, logEntries) {
  const {
    name,
    canvasFile,
    importMode,
    hierarchy,
    tasksFlag,
    skipEmptyFlag,
    createBaseFlag,
    createCanvasFlag,
    totalItems,
    filteredItems,
    createdFiles,
    skippedItems,
    duplicates,
    startedAt,
    finishedAt,
    durationMs,
    dryRun,
    // New fields
    logFilePath
  } = context;

  const durationHuman = formatDurationMs(durationMs);

  let md = "---\n";
  md += `type: "canvas_import_log"\n`;
  md += `name: "${escapeYamlString(name)}"\n`;
  md += `canvas_file: "${escapeYamlString(canvasFile)}"\n`;
  md += `mode: "${importMode}"\n`;
  md += `hierarchy: "${hierarchy}"\n`;
  md += `tasks: ${tasksFlag ? "true" : "false"}\n`;
  md += `skip_empty: ${skipEmptyFlag ? "true" : "false"}\n`;
  md += `create_base: ${createBaseFlag ? "true" : "false"}\n`;
  md += `create_canvas: ${createCanvasFlag ? "true" : "false"}\n`;
  md += `dry_run: ${dryRun ? "true" : "false"}\n`;
  md += `total_items: ${totalItems}\n`;
  md += `filtered_items: ${filteredItems}\n`;
  md += `created_files: ${createdFiles}\n`;
  md += `skipped_items: ${skippedItems}\n`;
  md += `duplicates: ${duplicates}\n`;
  md += `started_at: "${startedAt}"\n`;
  md += `finished_at: "${finishedAt}"\n`;
  md += `duration_ms: ${durationMs}\n`;
  if (logFilePath) {
    md += `log_file: "${escapeYamlString(logFilePath)}"\n`;
  }
  md += "---\n\n";

  md += `# Canvas Import Log – ${escapeYamlString(name)}\n\n`;
  md += `- 🧩 Canvas: [[${canvasFile}.canvas|${canvasFile}]]\n`;
  md += `- 📁 Mode: ${importMode === "folder" ? "Folder (one note per item)" : "Single summary note"}\n`;
  md += `- 🏗️ Hierarchy: \`${hierarchy}\`\n`;
  md += `- ✅ Tasks: ${tasksFlag ? "Yes" : "No"}\n`;
  md += `- ⚪ Skip empty items: ${skipEmptyFlag ? "Yes" : "No"}\n`;
  if (importMode === "folder") {
    md += `- 📚 Base file: ${createBaseFlag ? "Yes" : "No"}\n`;
    md += `- 🧵 Linked canvas: ${createCanvasFlag ? "Yes" : "No"}\n`;
  }
  md += `- 🧪 Dry run: ${dryRun ? "Yes (debug mode)" : "No"}\n`;
  md += `- 🕒 Started: ${startedAt}\n`;
  md += `- 🕓 Finished: ${finishedAt}\n`;
  md += `- ⏱ Duration: ${durationHuman} (${durationMs} ms)\n`;

  md += `\n## Statistics\n\n`;
  md += `| Metric | Value |\n| --- | ---: |\n`;
  md += `| Total items on canvas | ${totalItems} |\n`;
  md += `| Items considered for import | ${filteredItems} |\n`;
  md += `| Files created/updated | ${createdFiles} |\n`;
  md += `| Items not turned into files | ${skippedItems} |\n`;
  md += `| Duplicate notes | ${duplicates} |\n`;

  if (logEntries && logEntries.length) {
    md += `\n## Messages\n\n`;
    md += "```text\n";
    const emojiMap = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌"
    };

    for (const entry of logEntries) {
      const level = (entry.type || "info").toLowerCase();
      const upper = level.toUpperCase();
      const emoji = emojiMap[level] || "•";
      const lineTs = entry.timestamp || "";
      md += `${emoji} [${lineTs}] [${upper}] ${entry.message}\n`;
    }
    md += "```\n";
  }

  return md;
}

/**
 * Builds the log file path with timestamp
 * 
 * @param {object} opts
 * @returns {{ logFolder: string, logFileName: string, logFilePath: string }}
 */
export function buildLogFilePath(opts) {
  const {
    name,
    canvasFileBaseName,
    baseFolder,
    importStart,
    slugifyTitle
  } = opts;

  const safeName = name || canvasFileBaseName || "import";
  const nameSlug = slugifyTitle 
    ? slugifyTitle(safeName) 
    : sanitizeFilename(safeName);
  
  const timestamp = formatTimestampForFilename(new Date(importStart));
  const logFileName = `import-log_${nameSlug}_${timestamp}.md`;
  
  // Log folder is always "logs" subfolder of the project/base folder
  const logFolder = baseFolder ? `${baseFolder}/logs` : "logs";
  const logFilePath = `${logFolder}/${logFileName}`;

  return { logFolder, logFileName, logFilePath };
}

/**
 * Schreibt den Import-Log in den logs-Ordner des Projekts.
 *
 * @param {object} opts
 *  - name, canvasFileBaseName, importMode, hierarchy, tasksFlag, skipEmptyFlag,
 *    createBaseFlag, createCanvasFlag, totalItems, filteredItems, createdFiles,
 *    skippedItems, duplicates, importStart, importEnd, durationMs, dryRun,
 *    logEntries, baseFolder, summaryFilePath, debugFlag, progress, slugifyTitle,
 *    logFolder, logFileName, logFilePath (optional - will be computed if not provided)
 */
export async function writeImportLog(opts) {
  const {
    name,
    canvasFileBaseName,
    importMode,
    hierarchy,
    tasksFlag,
    skipEmptyFlag,
    createBaseFlag,
    createCanvasFlag,
    totalItems,
    filteredItems,
    createdFiles,
    skippedItems,
    duplicates,
    importStart,
    importEnd,
    durationMs,
    dryRun,
    logEntries,
    baseFolder,
    summaryFilePath,
    debugFlag,
    progress,
    slugifyTitle
  } = opts;

  // Use provided log path or compute it
  let { logFolder, logFileName, logFilePath } = opts;
  
  if (!logFilePath) {
    const computed = buildLogFilePath({
      name,
      canvasFileBaseName,
      baseFolder,
      importStart,
      slugifyTitle
    });
    logFolder = computed.logFolder;
    logFileName = computed.logFileName;
    logFilePath = computed.logFilePath;
  }

  const logContext = {
    name,
    canvasFile: canvasFileBaseName,
    importMode,
    hierarchy,
    tasksFlag,
    skipEmptyFlag,
    createBaseFlag,
    createCanvasFlag,
    totalItems,
    filteredItems,
    createdFiles,
    skippedItems,
    duplicates,
    startedAt: new Date(importStart).toISOString(),
    finishedAt: new Date(importEnd).toISOString(),
    durationMs,
    dryRun,
    logFilePath
  };

  const logMarkdown = buildImportLogMarkdown(logContext, logEntries);

  try {
    if (debugFlag) {
      progress?.log?.(
        `[DRY RUN] Import log would be written to: ${logFilePath}`,
        "info"
      );
      return logFilePath;
    }

    // Ensure logs folder exists
    await ensureFolderExists(logFolder);

    // Write or update the log file
    const existingLog = app.vault.getAbstractFileByPath(logFilePath);
    if (existingLog) {
      await app.vault.modify(existingLog, logMarkdown);
      progress?.log?.(`🧾 Import log updated: ${logFileName}`, "info");
    } else {
      await app.vault.create(logFilePath, logMarkdown);
      progress?.log?.(`🧾 Import log created: ${logFileName}`, "info");
    }

    // For "file" mode, also append to summary if it exists
    if (importMode === "file" && summaryFilePath) {
      try {
        const summaryFile = app.vault.getAbstractFileByPath(summaryFilePath);
        if (summaryFile) {
          const previous = await app.vault.read(summaryFile);
          const logLink = `\n\n---\n\n> 📄 Full import log: [[${logFilePath}|${logFileName}]]\n`;
          await app.vault.modify(summaryFile, previous + logLink);
          progress?.log?.(`🔗 Log link added to summary note`, "info");
        }
      } catch (summaryError) {
        console.warn("Could not append log link to summary:", summaryError);
      }
    }

    return logFilePath;

  } catch (logError) {
    console.error("Failed to write import log:", logError);
    progress?.log?.(
      `⚠️ Failed to write import log: ${logError.message}`,
      "warning"
    );
    return null;
  }
}
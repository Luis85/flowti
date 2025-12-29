export function buildBaseFileContent(folderPath) {
  // zur Sicherheit Quotes im Pfad escapen
  const safePath = String(folderPath || "").replace(/"/g, '\\"');

  const lines = [
    "filters:",
    "  and:",
    `    - file.inFolder(\"${safePath}\")`,
    "    - file.ext == \"md\"",
    "views:",
    "  - type: table",
    "    name: Imported Files",
    "    groupBy:",
    "      property: type",
    "      direction: ASC",
    "    order:",
    "      - file.name",
    "      - status",
    "      - type",
    "      - parent",
    "      - up",
    "      - down",
    "      - prev",
    "      - next",
    "      - original_type",
    "      - color",
    "      - shape",
    "      - source",
    "      - tags"
  ];

  return lines.join("\n") + "\n";
}

/**
 * Erstellt oder überschreibt die .base-Datei für einen Ordner.
 *
 * @param {string} baseFolder   Zielordner (z.B. "var/test/Canvas Importer Test")
 * @param {boolean} overwrite   Vorhandene Base-Datei überschreiben?
 * @param {boolean} debug       Nur loggen, nichts schreiben
 * @returns {Promise<string>}   Pfad zur Base-Datei
 */
export async function createBaseFile(baseFolder, overwrite = false, debug = false) {
  const folderName = (baseFolder || "").split("/").pop() || "index";
  const baseFilePath = `${baseFolder}/${folderName}.base`;
  const content = buildBaseFileContent(baseFolder);

  if (debug) {
    console.log("[DRY RUN] base file would be:", baseFilePath);
    console.log(content);
    return baseFilePath;
  }

  const existing = app.vault.getAbstractFileByPath(baseFilePath);

  if (existing) {
    if (overwrite) {
      await app.vault.modify(existing, content);
      console.log("Overwritten base file:", baseFilePath);
    } else {
      console.log("Base file already exists, skipping:", baseFilePath);
    }
  } else {
    await app.vault.create(baseFilePath, content);
    console.log("Created base file:", baseFilePath);
  }

  return baseFilePath;
}

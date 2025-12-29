// ---------- Utils ----------

function generateId() {
  const chars = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function slugifyTitle(title, maxLength = 80) {
  if (!title) return "untitled";

  let slug = title
    .replace(/^#+\s*/, "")
    .trim()
    .replace(/[\/\\:\*\?"<>\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!slug) slug = "untitled";

  if (slug.length > maxLength) {
    slug = slug.slice(0, maxLength);
    slug = slug.replace(/\s+\S*$/, "").trim();
    if (!slug) slug = "untitled";
  }

  return slug;
}

// ---------- Canvas-Rebuild ----------

export function buildCanvasFromItems(originalNodes, originalEdges, filePathById) {
  const nodes = [];
  const edges = [];
  const idMapping = {};

  for (const originalNode of originalNodes || []) {
    const newId = generateId();
    idMapping[originalNode.id] = newId;

    // Gruppen & bereits vorhandene File-Nodes werden „durchgeschleift“
    if (originalNode.type === "group" || originalNode.type === "file") {
      nodes.push({
        ...originalNode,
        id: newId
      });
      continue;
    }

    // Wenn wir für diesen Node eine Note erzeugt haben → als File-Node verlinken
    const filePath = filePathById?.[originalNode.id];
    if (filePath) {
      nodes.push({
        id: newId,
        type: "file",
        file: filePath,
        color: originalNode.color,
        x: originalNode.x,
        y: originalNode.y,
        width: originalNode.width,
        height: originalNode.height
      });
      continue;
    }

    // Fallback: Node einfach kopieren (neue ID)
    nodes.push({
      ...originalNode,
      id: newId
    });
  }

  for (const edge of originalEdges || []) {
    const newFromId = idMapping[edge.fromNode];
    const newToId = idMapping[edge.toNode];
    if (!newFromId || !newToId) continue;

    edges.push({
      id: generateId(),
      fromNode: newFromId,
      fromSide: edge.fromSide,
      toNode: newToId,
      toSide: edge.toSide,
      ...(edge.fromEnd && { fromEnd: edge.fromEnd }),
      ...(edge.toEnd && { toEnd: edge.toEnd }),
      ...(edge.color && { color: edge.color }),
      ...(edge.label && { label: edge.label }),
      ...(edge.styleAttributes && { styleAttributes: edge.styleAttributes })
    });
  }

  return { nodes, edges };
}

/**
 * Erstellt (oder überschreibt) eine Canvas-Datei, die die importierten Notes
 * als File-Nodes referenziert.
 *
 * @param {string} baseFolder
 * @param {string} name
 * @param {Array} originalNodes
 * @param {Array} originalEdges
 * @param {Object} filePathById
 * @param {boolean} overwrite
 * @param {boolean} debug
 * @returns {Promise<string>} Pfad zur Canvas-Datei
 */
export async function createCanvasFile(
  baseFolder,
  name,
  originalNodes,
  originalEdges,
  filePathById,
  overwrite = false,
  debug = false
) {
  const canvasData = buildCanvasFromItems(originalNodes, originalEdges, filePathById);
  const nameSlug = slugifyTitle(name || "canvas");
  const baseCanvasPath = `${baseFolder}/${nameSlug}.canvas`;
  const content = JSON.stringify(canvasData, null, 2);

  if (debug) {
    console.log("[DRY RUN] canvas file", baseCanvasPath);
    return baseCanvasPath;
  }

  let finalPath = baseCanvasPath;
  const existing = app.vault.getAbstractFileByPath(baseCanvasPath);

  if (existing) {
    if (overwrite) {
      await app.vault.modify(existing, content);
      console.log("Overwritten canvas file:", baseCanvasPath);
    } else {
      let counter = 1;
      let candidatePath = baseCanvasPath;
      while (app.vault.getAbstractFileByPath(candidatePath)) {
        candidatePath = `${baseFolder}/${nameSlug} ${counter}.canvas`;
        counter++;
      }
      await app.vault.create(candidatePath, content);
      console.log("Created canvas file:", candidatePath);
      finalPath = candidatePath;
    }
  } else {
    await app.vault.create(baseCanvasPath, content);
    console.log("Created canvas file:", baseCanvasPath);
  }

  return finalPath;
}

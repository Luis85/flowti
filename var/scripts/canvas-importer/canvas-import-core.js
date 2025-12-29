// ---------- Konstanten ----------

export const DEFAULT_COLOR_MAP = {
  "1": "Issue",       // red
  "2": "Epic",        // orange
  "3": "Task",        // yellow
  "4": "Test",        // green
  "5": "Deliverable", // blue
  "6": "Feature"      // purple
};

// ---------- Utilities (rein) ----------

export function toPascalCase(str) {
  if (!str) return "";
  return str
    .trim()
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

export function slugifyTitle(title, maxLength = 80) {
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

// ---------- Legend & Typ-Mapping ----------

export function findLegendGroup(nodes) {
  return (nodes || []).find(
    n =>
      n.type === "group" &&
      n.label &&
      typeof n.label === "string" &&
      n.label.toLowerCase() === "legend"
  );
}

export function isNodeInsideGroup(node, group) {
  const nx = node.x;
  const ny = node.y;

  const gx1 = group.x;
  const gy1 = group.y;
  const gx2 = group.x + group.width;
  const gy2 = group.y + group.height;

  return nx >= gx1 && nx <= gx2 && ny >= gy1 && ny <= gy2;
}

export function extractLegendMapping(canvasJson) {
  const nodes = canvasJson.nodes || [];
  const legendGroup = findLegendGroup(nodes);
  if (!legendGroup) return null;

  const colorTypeMap = {};

  const legendNodes = nodes.filter(n => {
    if (n.type !== "text") return false;
    if (!n.text || !n.text.trim()) return false;
    return isNodeInsideGroup(n, legendGroup);
  });

  for (const node of legendNodes) {
    const text = node.text.trim();
    const color = node.color;
    if (color && text) {
      colorTypeMap[color] = toPascalCase(text);
    }
  }

  return Object.keys(colorTypeMap).length > 0 ? colorTypeMap : null;
}

export function mapNodeToType(node, legendColorMap = null) {
  // 1) Group ohne Farbe → "Group"
  if (node.type === "group" && !node.color) {
    return "Group";
  }

  // 2) Legend-Mapping hat Vorrang (color → type)
  if (legendColorMap && node.color && legendColorMap[node.color]) {
    return legendColorMap[node.color];
  }

  // 3) Shape-Mapping
  const shape = node.styleAttributes?.shape;
  if (shape) {
    const shapeTypeMap = {
      circle: "Event",
      diamond: "Gateway",
      parallelogram: "Data",
      document: "Document",
      database: "Database",
      "predefined-process": "Subprocess",
      pill: "Terminator"
    };
    if (shapeTypeMap[shape]) {
      return shapeTypeMap[shape];
    }
  }

  // 4) Default-Color-Mapping
  if (node.color && DEFAULT_COLOR_MAP[node.color]) {
    return DEFAULT_COLOR_MAP[node.color];
  }

  // 5) Fallback
  return "Node";
}

// ---------- Items & Relationen ----------

export function findParentGroupId(node, groups) {
  if (!node || !Array.isArray(groups)) return null;

  let parentId = null;
  let parentArea = Infinity;

  for (const g of groups) {
    if (!g) continue;

    // 1) Gruppe darf niemals ihr eigener Parent sein
    if (g.id === node.id) continue;

    // 2) Node muss im Bounding Box der Gruppe liegen
    if (!isNodeInsideGroup(node, g)) continue;

    const width  = typeof g.width  === "number" ? g.width  : 0;
    const height = typeof g.height === "number" ? g.height : 0;
    const area   = width * height;

    // 3) Kleinste umschließende Gruppe als Parent nehmen (für verschachtelte Groups)
    if (area > 0 && area < parentArea) {
      parentArea = area;
      parentId   = g.id;
    }
  }

  return parentId;
}

export function buildItemsWithRelations(canvasJson, legendColorMap = null) {
  const nodes = Array.isArray(canvasJson?.nodes) ? canvasJson.nodes : [];
  const edges = Array.isArray(canvasJson?.edges) ? canvasJson.edges : [];

  const legendGroup = findLegendGroup(nodes);

  // Groups für Parent-Suche: Legend-Gruppe explizit ausschließen
  const groups = nodes.filter(
    n => n.type === "group" && (!legendGroup || n.id !== legendGroup.id)
  );

  const items = nodes
    .filter(node => {
      // Legend + Text in der Legend ausfiltern (wie bisher)
      if (!legendGroup) return true;
      if (node.id === legendGroup.id) return false;
      if (node.type === "text" && isNodeInsideGroup(node, legendGroup)) {
        return false;
      }
      return true;
    })
    .map(node => {
      const type = mapNodeToType(node, legendColorMap);

      const rawTitle = node.text || node.label || `${type} - ${node.id}`;
      const title    = String(rawTitle).trim();

      const parentGroupId = findParentGroupId(node, groups);
      const parentGroup   = parentGroupId
        ? nodes.find(n => n.id === parentGroupId)
        : null;

      const rawParentTitle = parentGroup?.label ?? null;
      const parentTitle    = rawParentTitle
        ? String(rawParentTitle).trim()
        : null;

      const parentSlug = parentTitle
        ? slugifyTitle(parentTitle)
        : null;

      const isEmpty =
        (!node.text  || !String(node.text).trim()) &&
        (!node.label || !String(node.label).trim());

      const item = {
        id: node.id,
        title,
        status: "new",
        type,
        originalType: node.type,
        color: node.color ?? null,
        shape: node.styleAttributes?.shape ?? null,
        parentId: parentGroupId ?? null,
        parent: parentSlug,
        isEmpty,
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
        up: [],
        down: [],
        prev: [],
        next: []
      };

      // Zusätzliche Sicherheit: niemals Self-Parent
      if (item.parentId === item.id) {
        item.parentId = null;
        item.parent   = null;
      }

      return item;
    });

  const itemById = Object.fromEntries(items.map(i => [i.id, i]));

  // --- Edges in Relationen übersetzen ---
  for (const edge of edges) {
    const fromItem = itemById[edge.fromNode];
    const toItem   = itemById[edge.toNode];

    if (fromItem) {
      const fromSide = edge.fromSide;
      const toId     = edge.toNode;

      if (fromSide === "top")    fromItem.up.push(toId);
      else if (fromSide === "bottom") fromItem.down.push(toId);
      else if (fromSide === "left")   fromItem.prev.push(toId);
      else if (fromSide === "right")  fromItem.next.push(toId);
    }

    if (toItem) {
      const toSide = edge.toSide;
      const fromId = edge.fromNode;

      if (toSide === "top")    toItem.up.push(fromId);
      else if (toSide === "bottom") toItem.down.push(fromId);
      else if (toSide === "left")   toItem.prev.push(fromId);
      else if (toSide === "right")  toItem.next.push(fromId);
    }
  }

  // --- Relationen bereinigen ---
  for (const item of items) {
    const uniq = arr =>
      [...new Set(arr)]
        .filter(Boolean)          // kein null/undefined
        .filter(id => id !== item.id); // keine Self-Edges

    item.up   = uniq(item.up);
    item.down = uniq(item.down);
    item.prev = uniq(item.prev);
    item.next = uniq(item.next);
  }

  return items;
}


// ---------- Filter ----------

export function shouldSkipItem(item, skipEmpty) {
  if (item.originalType === "file") return true;
  if (skipEmpty && item.isEmpty) return true;
  return false;
}

export function filterItemsForImport(items, skipEmpty) {
  return (items || []).filter(item => !shouldSkipItem(item, skipEmpty));
}

// ---------- Misc Utilities (Obsidian) ----------

export async function revealFileInNavigator(path) {
  if (!path) return;
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) return;

  const leaf = app.workspace.getLeaf(false);
  if (leaf && leaf.openFile) {
    await leaf.openFile(file);
  }

  if (app.commands?.executeCommandById) {
    app.commands.executeCommandById("file-explorer:reveal-active-file");
  }
}

export function getField(result, key) {
  const field = result?.data?.[key];
  if (field && typeof field === "object" && "value" in field) {
    return field.value;
  }
  return field;
}

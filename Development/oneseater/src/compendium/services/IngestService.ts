import { Notice } from "obsidian";
import { DataCacheService } from "./DataCacheService";
import { EntityNoteService } from "./EntityNoteService";
import { resolveIngestContext } from "src/utils/helpers";

export type IngestResult = {
  cacheSaved: boolean;
  notesAttempted: boolean;
  notesWritten: number;
  warnings: string[];
  errors: string[];
};

export class IngestService {
  constructor(
    private cache: DataCacheService,
    private notes: EntityNoteService
  ) {}

  async ingest(cacheKey: string, rows: Record<string, any>[]): Promise<IngestResult> {
    const res: IngestResult = {
      cacheSaved: false,
      notesAttempted: false,
      notesWritten: 0,
      warnings: [],
      errors: [],
    };

    // 1) Cache: darf im Idealfall auch “best effort” sein, aber wenn das scheitert,
    //    sollen Notes trotzdem nicht blind weiterlaufen.
    try {
      await this.cache.saveToCache(cacheKey, rows);
      res.cacheSaved = true;
    } catch (e: any) {
      res.errors.push(`Cache save failed for '${cacheKey}': ${e?.message ?? String(e)}`);
      new Notice(`Ingest: Cache save failed (${cacheKey}). See console.`);
      console.error(e);
      return res; // hier abbrechen ist ok – ohne Cache fehlt dir die Grundlage
    }

    // 2) Notes: best effort, NIE hart abbrechen
    const ctx = resolveIngestContext(cacheKey);

    if (ctx.kind !== "entity" || !ctx.noteEntityKey) {
      res.warnings.push(`No entity notes generated for '${cacheKey}' (kind=${ctx.kind}).`);
      return res;
    }

    res.notesAttempted = true;

    try {
      await this.notes.upsertEntityNotes(ctx.noteEntityKey, rows);
    } catch (e: any) {
      // globaler fallback – falls Notes-Service doch noch irgendwo wirft
      res.errors.push(`Notes upsert failed for '${ctx.noteEntityKey}': ${e?.message ?? String(e)}`);
      new Notice(`Ingest: Notes failed (${ctx.noteEntityKey}). Continuing.`);
      console.error(e);
    }

    return res;
  }
}

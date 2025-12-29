/**
 * Generic Import Progress Overlay
 *
 * Usage:
 *   const progress = createProgressOverlay(importName);
 *
 * Public API (kept for backwards compatibility):
 *   progress.setTitle(title: string)
 *   progress.setStatus(text: string)
 *   progress.setSteps(count: number)
 *   progress.setStepIndex(index: number, label?: string)
 *   progress.setTotalUnits(count: number)
 *   progress.setTotals(obj: { itemsTotal?: number, [k: string]: any })
 *   progress.setItemProgress(current: number, total: number)
 *   progress.setProcessedItems(n: number)
 *   progress.advance(delta?: number)
 *   progress.log(message: string, level?: "info" | "success" | "warning" | "error")
 *   progress.isCancelled(): boolean
 *   progress.getState()
 *   progress.getLogEntries()
 *   progress.close()
 */

export function createProgressOverlay(importName) {
  // --------------------------------------------------
  // 1) DOM & Styles
  // --------------------------------------------------
  const overlay = document.createElement("div");
  overlay.id = "import-progress-overlay";
  overlay.innerHTML = `
    <div class="import-modal" tabindex="-1">
      <h2 class="import-heading">
        <span class="import-title"></span>
      </h2>

      <div class="import-status"></div>
      <div class="import-step"></div>

      <div class="import-progress-bar">
        <div class="import-progress-fill"></div>
      </div>

      <div class="import-progress-meta">
        <span class="import-progress-percent"></span>
        <span class="import-progress-count"></span>
        <span class="import-progress-time"></span>
      </div>

      <div class="import-log-container">
        <ul class="import-log-list"></ul>
      </div>

      <div class="import-footer">
        <button type="button" class="import-cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  // Inject styles once
  if (!document.getElementById("import-progress-styles")) {
    const style = document.createElement("style");
    style.id = "import-progress-styles";
    style.textContent = `
      #import-progress-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .import-modal {
        background: var(--background-primary);
        color: var(--text-normal);
        border-radius: 12px;
        padding: 16px 18px;
        width: min(640px, 100vw - 32px);
        max-height: min(80vh, 720px);
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 14px;
      }

      .import-modal:focus {
        outline: none;
      }

      .import-heading {
        font-size: 18px;
        margin: 0 0 2px;
        display: flex;
        align-items: baseline;
        gap: 6px;
      }

      .import-title {
        font-weight: 600;
      }

      .import-status {
        font-size: 13px;
        color: var(--text-muted);
        min-height: 18px;
      }

      .import-step {
        font-size: 12px;
        color: var(--text-muted);
        min-height: 16px;
      }

      .import-progress-bar {
        position: relative;
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: var(--background-modifier-border);
        overflow: hidden;
      }

      .import-progress-fill {
        position: absolute;
        inset: 0;
        width: 0%;
        border-radius: inherit;
        background: var(--interactive-accent);
        transition: width 0.15s ease-out;
      }

      .import-progress-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: var(--text-muted);
        justify-content: space-between;
      }

      .import-progress-percent,
      .import-progress-count,
      .import-progress-time {
        font-family: var(--font-monospace);
      }

      .import-log-container {
        flex: 1;
        min-height: 120px;
        max-height: 320px;
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        padding: 6px 8px;
        overflow: auto;
      }

      .import-log-list {
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: 12px;
      }

      .import-log-entry {
        display: flex;
        gap: 6px;
        align-items: flex-start;
        padding: 2px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      }

      .import-log-entry:last-child {
        border-bottom: none;
      }

      .import-log-time {
        font-family: var(--font-monospace);
        color: var(--text-faint);
        flex: 0 0 auto;
      }

      .import-log-level {
        text-transform: uppercase;
        font-size: 10px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 4px;
        flex: 0 0 auto;
      }

      .import-log-message {
        flex: 1 1 auto;
        word-break: break-word;
      }

      .import-log-level.info {
        background: rgba(128, 179, 255, 0.1);
        color: #7aa2f7;
      }

      .import-log-level.success {
        background: rgba(158, 206, 106, 0.1);
        color: #9ece6a;
      }

      .import-log-level.warning {
        background: rgba(235, 203, 139, 0.1);
        color: #e0af68;
      }

      .import-log-level.error {
        background: rgba(243, 139, 168, 0.1);
        color: #f7768e;
      }

      .import-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
      }

      .import-cancel-btn {
        padding: 4px 10px;
        font-size: 13px;
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-modifier-hover);
        color: var(--text-normal);
        cursor: pointer;
      }

      .import-cancel-btn:hover:not(:disabled) {
        background: var(--background-modifier-active-hover);
      }

      .import-cancel-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);

  // DOM refs
  const titleEl = overlay.querySelector(".import-title");
  const statusEl = overlay.querySelector(".import-status");
  const stepEl = overlay.querySelector(".import-step");
  const progressFillEl = overlay.querySelector(".import-progress-fill");
  const percentEl = overlay.querySelector(".import-progress-percent");
  const countEl = overlay.querySelector(".import-progress-count");
  const timeEl = overlay.querySelector(".import-progress-time");
  const logListEl = overlay.querySelector(".import-log-list");
  const logContainerEl = overlay.querySelector(".import-log-container");
  const cancelBtn = overlay.querySelector(".import-cancel-btn");

  // --------------------------------------------------
  // 2) State
  // --------------------------------------------------
  const startedAt = Date.now();

  const state = {
    importName: importName ?? "Import",
    status: "",
    totalSteps: 1,
    currentStep: 0,
    stepLabels: [],
    totalUnits: 0,        // generic units (e.g., total work)
    currentUnit: 0,       // generic progress
    itemsTotal: 0,        // total items (optional)
    itemsProcessed: 0,    // processed items (optional)
    cancelled: false,
    logEntries: [],
  };

  // --------------------------------------------------
  // 3) Rendering helpers
  // --------------------------------------------------
  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const pad = (n) => String(n).padStart(2, "0");
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
  }

  function renderTitle() {
    if (titleEl) {
      titleEl.textContent = state.importName || "Import";
    }
  }

  function renderStatus() {
    if (statusEl) {
      statusEl.textContent = state.status || "";
    }
  }

  function renderStep() {
    if (!stepEl) return;
    if (state.totalSteps <= 0 || state.currentStep <= 0) {
      stepEl.textContent = "";
      return;
    }

    const label =
      state.stepLabels[state.currentStep - 1] ??
      `Step ${state.currentStep} of ${state.totalSteps}`;
    stepEl.textContent = label;
  }

  function renderProgress() {
    // Decide which numbers to use:
    // Prefer itemsProcessed/itemsTotal if set, otherwise currentUnit/totalUnits
    const total =
      state.itemsTotal > 0 ? state.itemsTotal : state.totalUnits;
    const current =
      state.itemsTotal > 0 ? state.itemsProcessed : state.currentUnit;

    let percent = 0;
    if (total > 0) {
      percent = Math.max(0, Math.min(1, current / total));
    }

    if (progressFillEl) {
      progressFillEl.style.width = `${percent * 100}%`;
    }

    if (percentEl) {
      percentEl.textContent = total > 0 ? `${Math.round(percent * 100)}%` : "";
    }

    if (countEl) {
      if (total > 0) {
        const label =
          state.itemsTotal > 0 ? "items" : "units";
        countEl.textContent = `${current} / ${total} ${label}`;
      } else {
        countEl.textContent = "";
      }
    }

    if (timeEl) {
      const elapsedMs = Date.now() - startedAt;
      const elapsedStr = `Elapsed: ${formatDuration(elapsedMs)}`;

      let etaStr = "";
      if (total > 0 && current > 0 && current < total) {
        const rate = elapsedMs / current; // ms per item
        const remainingMs = rate * (total - current);
        etaStr = ` · ETA: ~${formatDuration(remainingMs)}`;
      }

      timeEl.textContent = elapsedStr + etaStr;
    }
  }

  function renderAll() {
    renderTitle();
    renderStatus();
    renderStep();
    renderProgress();
  }

  renderAll();

  // --------------------------------------------------
  // 4) Logging
  // --------------------------------------------------
  function log(message, level = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, level, message };

    state.logEntries.push(entry);

    if (!logListEl) return;

    const li = document.createElement("li");
    li.className = "import-log-entry";

    const timeSpan = document.createElement("span");
    timeSpan.className = "import-log-time";
    timeSpan.textContent = timestamp;

    const levelSpan = document.createElement("span");
    levelSpan.className = `import-log-level ${level}`;
    levelSpan.textContent = level.toUpperCase();

    const msgSpan = document.createElement("span");
    msgSpan.className = "import-log-message";
    msgSpan.textContent = message;

    li.appendChild(timeSpan);
    li.appendChild(levelSpan);
    li.appendChild(msgSpan);

    logListEl.appendChild(li);
    logContainerEl.scrollTop = logContainerEl.scrollHeight;
  }

  // --------------------------------------------------
  // 5) Cancel handling
  // --------------------------------------------------
  function cancel() {
    if (state.cancelled) return;
    state.cancelled = true;
    state.status = "Import cancelled.";
    renderStatus();
    log("Import was cancelled by the user.", "warning");
    if (cancelBtn) {
      cancelBtn.disabled = true;
      cancelBtn.textContent = "Cancelled";
    }
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => cancel());
  }

  const keyHandler = (evt) => {
    if (evt.key === "Escape") {
      cancel();
    }
  };
  document.addEventListener("keydown", keyHandler);

  // --------------------------------------------------
  // 6) Public API
  // --------------------------------------------------
  return {
    setTitle(title) {
      state.importName = title;
      renderTitle();
    },
    setStatus(text) {
      state.status = text ?? "";
      renderStatus();
    },
    setSteps(count) {
      const n = Math.max(0, Number(count) || 0);
      state.totalSteps = n;
      state.stepLabels = new Array(n).fill(null);
      renderStep();
    },
    setStepIndex(index, label) {
      const i = Math.max(1, Number(index) || 1);
      state.currentStep = i;
      if (label && state.stepLabels.length >= i) {
        state.stepLabels[i - 1] = label;
      }
      renderStep();
    },
    setTotalUnits(count) {
      state.totalUnits = Math.max(0, Number(count) || 0);
      renderProgress();
    },
    setTotals(obj) {
      if (!obj || typeof obj !== "object") return;
      if (typeof obj.itemsTotal === "number") {
        state.itemsTotal = Math.max(0, obj.itemsTotal);
      }
      renderProgress();
    },
    setItemProgress(current, total) {
      // Kept for compatibility; we only use itemsTotal/itemsProcessed
      state.itemsTotal = Math.max(0, Number(total) || 0);
      state.itemsProcessed = Math.max(0, Number(current) || 0);
      renderProgress();
    },
    setProcessedItems(n) {
      state.itemsProcessed = Math.max(0, Number(n) || 0);
      renderProgress();
    },
    advance(delta = 1) {
      const d = Number(delta) || 0;
      state.currentUnit = Math.max(0, state.currentUnit + d);
      renderProgress();
    },
    log,
    isCancelled() {
      return state.cancelled;
    },
    getState() {
      return { ...state, startedAt };
    },
    getLogEntries() {
      return [...state.logEntries];
    },
    close() {
      document.removeEventListener("keydown", keyHandler);
      overlay.remove();
      // Styles stay in place so future imports can reuse them.
    },
  };
}

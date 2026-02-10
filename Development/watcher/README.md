---
title: Foreign Folder Watcher
stage: development
---
# Foreign Folder Watcher

An Obsidian plugin for automatic synchronization of files between external folders and your vault.

## Features

- **Real-time Watching**: Monitors external folders for file changes using [chokidar](https://github.com/paulmillr/chokidar)
- **Bidirectional Sync**: Sync in both directions (source → vault, vault → source, or both)
- **Bulk Reconcile**: Full synchronization on startup or on-demand
- **Incremental Reconcile**: Only sync files changed since last reconcile (much faster for large folders)
- **Cloud Sync Compatibility**: Special handling for OneDrive, Dropbox & Co. (stability checks, temp file filtering)
- **Exclusion Patterns**: Exclude files and folders using glob patterns
- **Conflict Resolution**: Multiple strategies (overwrite, rename, skip, keep newer)
- **Dashboard**: Visual interface for monitoring and control with health indicators
- **Export / Import Mappings**: Share your folder mapping configuration as JSON — others can import it to set up their vault
- **Performance**: Parallel processing, intelligent caching, skip-unchanged optimization

## Installation

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/Luis85/flowti/releases)
2. Create the folder `.obsidian/plugins/foreign-folder-watcher/` in your vault
3. Copy the downloaded files into this folder
4. Enable the plugin in Obsidian under Settings → Community Plugins

---

## Quick Start

1. Open **Settings → Foreign Folder Watcher**
2. Click **"Add Folder Mapping"**
3. Select a **Source Folder** (external folder, e.g., `C:\Users\Name\OneDrive\Notes`)
4. Select a **Target Folder** (folder in vault, e.g., `imported/onedrive`)
5. Click **Save**

The plugin now monitors the external folder and automatically copies new/changed files to your vault.

---

## Configuration

### Folder Mappings

Each mapping defines a source-target relationship:

| Setting | Description |
|---------|-------------|
| **Description** | A name for this mapping (e.g., "OneDrive Notes") |
| **Source Folder** | Absolute path to the external folder (e.g., `C:\Users\Name\OneDrive\Notes`) |
| **Target Folder** | Relative path in vault (e.g., `imported/onedrive`) |
| **Watch Subfolders** | Include subdirectories |
| **File Extensions** | Filter for file types (empty = all) |
| **Exclude Patterns** | Patterns to exclude (see below) |
| **Sync Direction** | Direction of synchronization |
| **Conflict Resolution** | How to handle existing files |
| **Reconcile on Start** | Synchronize when plugin starts |
| **Enabled** | Enable/disable this mapping |

### Sync Direction

The plugin supports three sync modes:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Source → Vault** | Import from external folder to vault only | Consume files (default) |
| **Vault → Source** | Export from vault to external folder only | Publish files |
| **Bidirectional** | Sync in both directions | Full synchronization |

> **Note:** Deletion sync is opt-in. Set **Deletion Handling** to "Trash" per mapping to propagate deletes (files go to system trash or `.sync-trash/`).

### Conflict Resolution

When a file exists in both source and target:

| Strategy | Behavior |
|----------|----------|
| **Keep Newer** | The newer file (by modification date) wins |
| **Overwrite** | Source file always overwrites target |
| **Rename** | Conflict files are renamed (e.g., `file (conflict 2025-02-07).md`) |
| **Skip** | Existing files are never overwritten |

With bidirectional sync, you can set a separate conflict strategy for each direction.

### Exclusion Patterns

Under **"Exclude Patterns"** you can specify files and folders to exclude from sync:

```
node_modules
*.log
temp/**
.git
build/*
```

**Supported Wildcards:**

| Pattern | Meaning |
|---------|---------|
| `*` | Any characters (except `/`) |
| `**` | Any characters including path separators (recursive) |
| `?` | Single character |

**Examples:**

| Pattern | Excluded |
|---------|----------|
| `node_modules` | All `node_modules` folders at any depth |
| `*.log` | All `.log` files |
| `temp/**` | Everything in the `temp` folder |
| `*.tmp` | All temporary files |
| `build/*` | Direct contents of `build`, but not subfolders |
| `.git` | Git directory |

### Cloud Sync Settings

For OneDrive, Dropbox, and similar services:

| Setting | Description | Default |
|---------|-------------|---------|
| **Ignore OneDrive Temp Files** | Ignore temporary files (`~$`, `.tmp`, etc.) | On |
| **Verify File Stability** | Wait until file is fully synchronized | On |
| **Stability Checks** | Number of stability checks | 3 |
| **Stability Interval** | Time between checks (ms) | 500 |
| **Use Polling** | Use polling instead of native file watching | Off |
| **Polling Interval** | Polling interval (ms) | 300 |

**Recommended for cloud folders:**
- Enable `Use Polling` with 300-1000ms interval
- Enable `Verify File Stability`
- Enable `Ignore OneDrive Temp Files`

### Reconcile Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Sync on Start** | Global setting for reconcile on startup | On |
| **Incremental Reconcile** | Only sync files changed since last reconcile | On |
| **Parallelism** | Number of parallel workers (1-64) | 8 |
| **Fast Skip Unchanged** | Skip unchanged files (size + mtime) | On |
| **Progress Throttle** | UI update interval (ms) | 250 |
| **Notify on Mapping Done** | Show notification after each mapping completes | On |

---

## Usage

### Commands

Available via Command Palette (`Ctrl/Cmd + P`):

| Command | Description |
|---------|-------------|
| **File Watcher: Open Dashboard** | Open the dashboard |
| **File Watcher: Restart all watchers** | Restart all watchers |
| **File Watcher: Export folder mappings** | Export all mappings to a JSON file |
| **File Watcher: Import folder mappings** | Import mappings from a JSON file |

### Dashboard

Open the dashboard via:
- Command palette: "File Watcher: Open Dashboard"
- Click on status bar element

The dashboard shows:
- **Overview**: Global statistics, reconcile status, recent activity
- **Watchers**: Status and health of each mapping with start/stop/reconcile controls
- **Logs**: Filtered logs with search

#### Watcher Health Indicators

Each watcher displays a health status:
- **Healthy** (green): Running with recent activity
- **Idle** (gray): Running but no activity for 5+ minutes
- **Warning** (yellow): Queue backpressure (dropped jobs or high queue)
- **Error** (red): Error state

### Status Bar

The status bar shows:
- Number of active watchers
- Processed/Skipped/Error counters
- Reconcile progress (when active)

Click on the status bar to open the dashboard.

---

## Example Configurations

### Import OneDrive Notes

```
Description: OneDrive Notes
Source: C:\Users\Name\OneDrive\Notes
Target: imported/onedrive
Sync Direction: Source → Vault
File Extensions: .md, .txt
Conflict: Keep Newer
Watch Subfolders: Yes
Use Polling: Yes
```

### Export Obsidian Notes to Dropbox

```
Description: Publish to Dropbox
Source: C:\Users\Name\Dropbox\Public\Notes
Target: published
Sync Direction: Vault → Source
File Extensions: .md
Conflict: Overwrite
```

### Bidirectional Sync (Work & Home)

```
Description: Work Notes (Bidirectional)
Source: C:\Users\Name\OneDrive\Work
Target: work
Sync Direction: Bidirectional
Conflict (→Vault): Keep Newer
Conflict (→Source): Keep Newer
Exclude: node_modules, .git, *.log
```

---

## Sharing Mappings (Export / Import)

You can share your folder mapping configuration with others so they can set up their vault with the same sync structure.

### Export

1. Open **Settings → Foreign Folder Watcher**
2. Click **"Export"** (or use Command Palette: "File Watcher: Export folder mappings")
3. Choose a save location — can be anywhere on your machine, including outside the vault
4. A `.json` file is saved with all your mappings

**What gets exported:**
- Target folders, descriptions, sync direction, conflict resolution, file extensions, exclude patterns, and all other sync settings
- Source folders are **cleared** (paths are machine-specific and meaningless to others)
- All mappings are set to **disabled** in the export

### Import

1. Open **Settings → Foreign Folder Watcher**
2. Click **"Import"** (or use Command Palette: "File Watcher: Import folder mappings")
3. Select a `.json` mapping file — can be from anywhere on your machine
4. Imported mappings appear in your settings, **disabled** by default

**After importing:**
- Configure the **Source Folder** for each imported mapping (point to your local folders)
- **Enable** the mappings you want to activate
- Mappings with overlapping target folders are skipped automatically

### Export File Format

```json
{
  "version": 1,
  "exportedAt": "2026-02-10T12:00:00.000Z",
  "pluginVersion": "1.0.0",
  "mappings": [
    {
      "targetFolder": "imported/onedrive",
      "description": "OneDrive Notes",
      "sourceFolder": "",
      "enabled": false,
      "syncDirection": "source-only",
      "fileExtensions": [".md", ".txt"],
      "conflictResolution": "keepNewer",
      ...
    }
  ]
}
```

---

## Troubleshooting

### Files are not syncing

1. Check if the mapping is **enabled**
2. Check if the **file extension** is allowed
3. Check the **Exclude Patterns**
4. Open the **Sync Logs** for details

### "File changed" notice with bidirectional sync

The plugin has loop detection with a 5-second cooldown. With very slow cloud services, you may still see notifications - but the file will not be synced again.

### High CPU usage

- Reduce the number of monitored folders
- Enable `Use Polling` with a higher interval (1000+ ms)
- Use `Exclude Patterns` to exclude large folders

### Files missing after reconcile

- Check the **Conflict Resolution** setting
- With `Skip`, existing files are never overwritten
- Open the **Sync Logs** to see which files were skipped

### Plugin is unresponsive

1. Open the developer console (`Ctrl/Cmd + Shift + I`)
2. Look for error messages
3. Try **Restart all watchers** command

---

## Temporary Files (Auto-ignored)

The following file types are automatically ignored when "Ignore OneDrive Temp Files" is enabled:

- `~$document.docx` (Office lock files)
- `*.tmp`, `*.temp`
- `*.partial`, `*.crdownload`
- `*.swp` (Vim swap files)
- `thumbs.db`, `.DS_Store`, `desktop.ini`

---

## Architecture

```
src/
├── main.ts                 # Main plugin class
├── types.ts                # Core type definitions
├── utils.ts                # Utility functions (glob matching, etc.)
├── services/
│   ├── FileSyncService.ts  # Core synchronization logic
│   ├── ReconcileService.ts # Bulk reconcile orchestration
│   ├── SyncStateService.ts # Sync state persistence (incremental reconcile)
│   ├── StatsService.ts     # Statistics tracking
│   ├── StatusBarService.ts # Status bar display
│   ├── LogService.ts       # Logging with subscriptions
│   ├── NoticeService.ts    # User notifications
│   ├── FolderPickerService.ts # Native folder/file picker (Electron)
│   ├── MappingExportService.ts # Export/import mapping configurations
│   └── AsyncMutex.ts       # Thread safety (locks)
├── watcher/
│   ├── WatcherManager.ts   # Watcher lifecycle & health tracking
│   ├── MappingWatcher.ts   # Source → Vault watcher (external folder)
│   └── VaultWatcher.ts     # Vault → Source watcher (vault folder)
├── modals/
│   ├── DashboardModal.ts   # Main dashboard UI
│   ├── FolderMappingModal.ts # Mapping editor
│   └── ConfirmModal.ts     # Confirmation dialogs
├── settings/
│   ├── FileWatcherSettingTab.ts # Settings tab
│   └── types.ts             # Settings types
└── interfaces/
    └── IPluginContext.ts    # Service interfaces
```

## Development

### Prerequisites

- Node.js >= 16
- npm

### Setup

```bash
npm install
```

### Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
npm test       # Run tests
npm run docs   # Generate TypeDoc
```

### Tests

The project uses [Vitest](https://vitest.dev/) for unit tests:

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
npm run test:coverage # With coverage report
```

### Documentation

Generate TypeDoc documentation:

```bash
npm run docs
```

Documentation is generated in `docs/codebase/`.

## Known Limitations

- **Desktop-only**: The plugin only works on desktop (not mobile)

## License

MIT

## Author

Luis Mendez - [luis-mendez.de](https://luis-mendez.de)

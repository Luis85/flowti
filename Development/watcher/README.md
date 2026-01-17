# Foreign Folder Watcher

An Obsidian plugin for automatic synchronization of files from external folders into your vault.

## Features

- **Real-time Watching**: Monitors external folders for file changes using [chokidar](https://github.com/paulmillr/chokidar)
- **Bulk Reconcile**: Full synchronization on startup or on-demand
- **Incremental Reconcile**: Only sync files changed since last reconcile (much faster for large folders)
- **Cloud Sync Compatibility**: Special handling for OneDrive, Dropbox & Co. (stability checks, temp file filtering)
- **Conflict Resolution**: Multiple strategies (overwrite, rename, skip, keep newer)
- **Dashboard**: Visual interface for monitoring and control with health indicators
- **Performance**: Parallel processing, intelligent caching, skip-unchanged optimization

## Installation

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/Luis85/flowti/releases)
2. Create the folder `.obsidian/plugins/obsidian-folder-watcher/` in your vault
3. Copy the downloaded files into this folder
4. Enable the plugin in Obsidian under Settings → Community Plugins

## Configuration

### Folder Mappings

Each mapping defines a source-target relationship:

| Setting | Description |
|---------|-------------|
| **Source Folder** | Absolute path to the external folder (e.g., `C:\Users\Name\OneDrive\Notes`) |
| **Target Folder** | Relative path in vault (e.g., `imported/onedrive`) |
| **Watch Subfolders** | Include subdirectories |
| **File Extensions** | Filter for file types (empty = all) |
| **Conflict Resolution** | How to handle existing files |
| **Reconcile on Start** | Synchronize when plugin starts |

### Conflict Resolution

- **Overwrite**: Always overwrite existing files
- **Skip**: Never overwrite existing files
- **Rename**: Rename new file with timestamp
- **Keep Newer**: Only overwrite if source file is newer

### Cloud Sync Settings

For OneDrive, Dropbox, and similar services:

- **Ignore OneDrive Temp Files**: Ignore temporary files (`~$`, `.tmp`, etc.)
- **Verify File Stability**: Wait until file is fully synchronized
- **Stability Checks**: Number of stability checks
- **Stability Interval**: Time between checks (ms)

### Reconcile Settings

- **Sync on Start**: Global setting for reconcile on startup
- **Incremental Reconcile**: Only sync files changed since last reconcile (tracks mtime + size per file)
- **Parallelism**: Number of parallel workers (1-64)
- **Fast Skip Unchanged**: Skip unchanged files (size + mtime)
- **Progress Throttle**: UI update interval (ms)

## Usage

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

### Commands

| Command | Description |
|---------|-------------|
| `File Watcher: Open Dashboard` | Open dashboard |
| `File Watcher: Restart all watchers` | Restart all watchers |

### Status Bar

The status bar shows:
- Number of active watchers
- Processed/Skipped/Error counters
- Reconcile progress (when active)

Click on the status bar to open the dashboard.

## Architecture

```
src/
├── main.ts                 # Main plugin class
├── types.ts                # Core type definitions
├── utils.ts                # Utility functions
├── services/
│   ├── FileSyncService.ts  # Core synchronization logic
│   ├── ReconcileService.ts # Bulk reconcile orchestration
│   ├── SyncStateService.ts # Sync state persistence (incremental reconcile)
│   ├── StatsService.ts     # Statistics tracking
│   ├── StatusBarService.ts # Status bar display
│   ├── LogService.ts       # Logging with subscriptions
│   ├── NoticeService.ts    # User notifications
│   ├── FolderPickerService.ts # Native folder picker (Electron)
│   └── AsyncMutex.ts       # Thread safety (locks)
├── watcher/
│   ├── WatcherManager.ts   # Watcher lifecycle & health tracking
│   └── MappingWatcher.ts   # Individual folder watcher
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

#### Test Coverage Philosophy

The test suite focuses on **business logic and services** that can be tested in isolation:

| Tested | Not Tested |
|--------|------------|
| FileSyncService | Modals (DashboardModal, FolderMappingModal) |
| ReconcileService | Electron APIs (FolderPickerService) |
| StatsService | Obsidian UI components |
| StatusBarService | |
| LogService | |
| AsyncMutex / OperationLock | |
| WatcherManager | |
| MappingWatcher | |
| Settings validation | |

**Why modals are not tested:**
- Modals are pure presentation components that delegate to services
- They use Obsidian's Modal API which requires the full Obsidian runtime
- UI logic is kept minimal - modals only render data and call service methods
- Testing modals would require extensive mocking of Obsidian internals with little value

**Why Electron APIs are not tested:**
- FolderPickerService wraps Electron's `dialog.showOpenDialog()`
- Electron APIs require the desktop runtime environment
- The service is a thin wrapper with minimal logic

### Documentation

Generate TypeDoc documentation:

```bash
npm run docs
```

Documentation is generated in `docs/codebase/`.

## Known Limitations

- **Desktop-only**: The plugin only works on desktop (not mobile)
- **No Delete Sync**: Deleted files are not removed from the vault
- **No Bidirectional Sync**: Changes in the vault are not synced back

## License

MIT

## Author

Luis Mendez - [luis-mendez.de](https://luis-mendez.de)

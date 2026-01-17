# Foreign Folder Watcher

An Obsidian plugin for automatic synchronization of files from external folders into your vault.

## Features

- **Real-time Watching**: Monitors external folders for file changes using [chokidar](https://github.com/paulmillr/chokidar)
- **Bulk Reconcile**: Full synchronization on startup or on-demand
- **Cloud Sync Compatibility**: Special handling for OneDrive, Dropbox & Co. (stability checks, temp file filtering)
- **Conflict Resolution**: Multiple strategies (overwrite, rename, skip, keep newer)
- **Dashboard**: Visual interface for monitoring and control
- **Performance**: Parallel processing, intelligent caching, skip-unchanged optimization

## Installation

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/your-repo/releases)
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
- **Watchers**: Status of each mapping, start/stop/reconcile per mapping
- **Logs**: Filtered logs with search

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
├── services/
│   ├── FileSyncService.ts  # Core synchronization logic
│   ├── ReconcileService.ts # Bulk reconcile orchestration
│   ├── StatsService.ts     # Statistics tracking
│   ├── StatusBarService.ts # Status bar display
│   ├── LogService.ts       # Logging with subscriptions
│   └── AsyncMutex.ts       # Thread safety (locks)
├── watcher/
│   ├── WatcherManager.ts   # Watcher lifecycle
│   └── MappingWatcher.ts   # Individual folder watcher
├── modals/
│   ├── DashboardModal.ts   # Main dashboard
│   ├── FolderMappingModal.ts # Mapping editor
│   └── ConfirmModal.ts     # Confirmation dialogs
└── settings/
    ├── FileWatcherSettingTab.ts # Settings tab
    └── types.ts             # Settings types
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
- **No Delete Sync**: Deleted files are not removed from the vault
- **No Bidirectional Sync**: Changes in the vault are not synced back

## License

MIT

## Author

Luis Mendez - [luis-mendez.de](https://luis-mendez.de)

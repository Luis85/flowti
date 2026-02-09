---
parent: "[[03 - Resources/Documentation/Reference/Actors/User|User]]"
persona: User
domain: Flowti/System
title: Easy first-run installation
jtbd: When I first open a vault with the Flowti IBDE plugin, I want the system to guide me through setup so I can start working immediately without manual configuration.
journey: "[[#User Journey]]"
---

## Acceptance Criteria

- On first run the setup wizard opens automatically
- The wizard collects the user's display name
- The wizard shows a preview of all steps before executing them
- The wizard creates the user profile
- The wizard scaffolds the full IBDE folder structure (PARA + Connectivity + var)
- Each step shows live progress with status indicators
- The wizard displays a success summary on completion
- On subsequent launches the wizard does not appear again
- All steps are idempotent — safe to re-run without duplicating data
- The user can restart the wizard from Settings at any time
- The installer is extensible — new steps can be registered via the pipeline

## User Journey

### First Run

```
Plugin loads
  |
  v
InstallerService.load() -- reads persisted state
  |
  v
isInstalled() == false?
  | yes                          | no
  v                              v
Open InstallerWizardModal     Skip -- plugin ready
  |
  v
+------------------------------------------+
|  Page 1: Welcome                         |
|                                          |
|  "Welcome to Flowti IBDE"               |
|  [Your name: ___________]               |
|                              [Next ->]   |
+------------------------------------------+
  |
  v
+------------------------------------------+
|  Page 2: Review                          |
|                                          |
|  Installing as: <name>                   |
|                                          |
|  +- Create User Profile ---------------+|
|  |  <intro>                            ||
|  |  <description>                      ||
|  +-------------------------------------+|
|  +- Create Folder Structure ------------+|
|  |  <intro>                            ||
|  |  <description>                      ||
|  +-------------------------------------+|
|  +- Folders to create -----------------+|
|  |  00 - Connectivity                  ||
|  |  01 - Projects                      ||
|  |  02 - Areas                         ||
|  |  ...                                ||
|  +-------------------------------------+|
|                                          |
|  [<- Back]                    [Install]  |
+------------------------------------------+
  |
  v
+------------------------------------------+
|  Page 3: Progress                        |
|                                          |
|  "Installing..."                         |
|                                          |
|  > Create User Profile                   |
|  ... Create Folder Structure             |
|                                          |
|  (subscribes to installer.step.* events) |
+------------------------------------------+
  |
  v
+------------------------------------------+
|  Page 4: Complete                        |
|                                          |
|  "Setup Complete"                        |
|  Welcome, <name>! Your environment       |
|  is ready.                               |
|                                          |
|  > Create User Profile                   |
|  > Create Folder Structure               |
|                                          |
|                              [Close]     |
+------------------------------------------+
  |
  v
State persisted -- wizard won't show again
```

### Restart from Settings

```
User opens Settings -> Flowti
  |
  v
+------------------------------------------+
|  User profile                            |
|    Your name: [Alice        ]            |
|                                          |
|  Setup                                   |
|    Run setup wizard     [Restart setup]  |
|                                          |
|  General                                 |
|    Debug mode              [  toggle  ]  |
+------------------------------------------+
  |
  v  clicks "Restart setup"
  |
installerService.reset()
  |  clears persisted state
  v
InstallerWizardModal.open()
  |  same 4-page flow as first run
  v
Steps are idempotent:
  - UserCreationStep -> skips (user already exists)
  - FolderScaffoldStep -> skips existing folders
```

### Failure and Retry

```
During Page 3 (Progress):
  |
  v
Step fails (e.g. permission denied)
  |
  v
+------------------------------------------+
|  Page 4: Complete (failure)              |
|                                          |
|  "Setup Failed"                          |
|  Failed to create folder: 01 - Projects  |
|                                          |
|  [Retry]                     [Close]     |
+------------------------------------------+
  |
  v  clicks "Retry"
  |
Pipeline re-runs from the beginning
  - Completed steps are skipped (idempotent)
  - Failed step is retried
```

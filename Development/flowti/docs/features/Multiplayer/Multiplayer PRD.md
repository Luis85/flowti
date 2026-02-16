---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: idea
related_events: []
maturity: L0
business_value: 3
implementation_cost: 5
maintenance_cost: 5
discovery_cost: 5
design_cost: 4
test_cost: 5
priority: 0
---

# Feature: Multiplayer

> Architecture reference: [[Multiplayer]]

---

## 1. Problem Statement

Obsidian is a single-user application with no built-in support for real-time collaborative editing. Teams working in shared vaults must coordinate manually, risking conflicting edits, lost changes, and communication overhead.

- **Who is affected?** Teams or pairs who share an Obsidian vault (via Obsidian Sync, Git, or shared filesystems).
- **What breaks?** Concurrent edits to the same file can silently overwrite each other.
- **Why it matters:** Collaborative knowledge work requires real-time awareness of who is editing what, and safe conflict resolution.

---

## 2. Outcome

- **User can** see who else is active in the vault, which files they are editing, and receive real-time cursor/selection presence indicators.
- **System can** synchronize edits between participants using a conflict-free data structure and relay presence information.
- **Domain gains** a multiplayer layer that extends Flowti's event-driven architecture to multi-user scenarios.

---

## 3. Scope

### In Scope (vision)

- Presence awareness: who is online, which file they are viewing/editing
- Cursor and selection sharing in the editor
- Conflict-free merge for concurrent edits (CRDT or OT)
- Session management: join/leave a collaborative session

### Out of Scope

- Voice/video communication
- Chat messaging within Obsidian
- Obsidian Sync integration (transport layer is separate)
- Permission or role management
- Offline conflict resolution beyond basic CRDT merge

---

## 4. UX Entry Points

- **Status bar**: Presence indicator showing connected collaborators
- **Editor gutter**: Colored cursors and selection highlights per collaborator
- **Command palette**: `flowti:multiplayer-join`, `flowti:multiplayer-leave`

---

## 5. Functional Requirements

- [ ] Presence service broadcasts user identity and active file
- [ ] Editor decorations show remote cursors with user color/name
- [ ] Edits are merged conflict-free using CRDT or OT algorithm
- [ ] Session lifecycle: create, join, leave, destroy
- [ ] Transport layer abstracted (WebSocket, WebRTC, or relay server)
- [ ] Graceful degradation when connection is lost (offline mode)

---

## 6. Data Model Impact

Potential entities:

```
CollaborativeSession
  sessionId: string
  participants: Participant[]
  activeFile: string
  createdAt: string

Participant
  userId: string
  displayName: string
  color: string
  cursorPosition?: { line, ch }
  selection?: { from, to }
  lastSeen: string
```

---

## 7. Event Impact

### Produced (proposed)

- `multiplayer.session.created` — payload: `{ sessionId }`
- `multiplayer.participant.joined` — payload: `{ sessionId, userId }`
- `multiplayer.participant.left` — payload: `{ sessionId, userId }`
- `multiplayer.cursor.moved` — payload: `{ userId, file, position }`
- `multiplayer.edit.applied` — payload: `{ userId, file, operation }`

### Consumed

- `file.opened` — to broadcast active file changes
- `file.modified` — to detect local edits for synchronization

---

## 8. UI Layout Impact

- Status bar widget showing collaborator avatars/initials
- Editor decorations via CodeMirror 6 extensions (cursors, selections)
- No new views or tabs required in v1

---

## 9. Adapter Impact

```
MultiplayerAdapter (proposed)
├── createSession(): Promise<CollaborativeSession>
├── joinSession(sessionId): Promise<void>
├── leaveSession(): void
├── broadcastEdit(operation): void
├── broadcastCursor(position): void
└── onRemoteEvent(handler): void

TransportAdapter (interface)
├── connect(endpoint): Promise<void>
├── send(message): void
├── onMessage(handler): void
└── disconnect(): void
```

---

## 10. Non-Functional Requirements

- **Latency**: Cursor updates delivered within 100ms on local network
- **Consistency**: CRDT guarantees eventual consistency without data loss
- **Resilience**: Temporary disconnects do not lose local edits
- **Privacy**: No data leaves the local network unless explicitly configured

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Obsidian editor API limitations for decorations | Evaluate CodeMirror 6 extension API feasibility early |
| CRDT complexity for rich markdown | Start with plain text CRDT; extend to structured content later |
| Network infrastructure requirements | Support peer-to-peer (WebRTC) as zero-infrastructure option |
| Performance with large documents | Benchmark CRDT operations on 10k+ line files |

---

## 12. Acceptance Criteria

- [ ] Two users can join a collaborative session
- [ ] Each user sees the other's cursor position in real-time
- [ ] Concurrent edits to the same line merge without data loss
- [ ] Disconnected user can reconnect and sync changes
- [ ] Session cleanup occurs when all participants leave

---

## 13. Definition of Done

- [ ] Presence service implemented with EventBus integration
- [ ] CRDT or OT engine handles concurrent text edits
- [ ] Transport adapter implemented (at least one backend)
- [ ] Editor decorations render remote cursors and selections
- [ ] Unit tests cover merge scenarios and edge cases
- [ ] Integration test with two simulated participants
- [ ] `npm run build` passes

---
type:
tags:
---
## 1. Overview

### Feature Name

**Meeting Notes - Session Recording & Local AI Summary**

### Domain

Flowti – IBDE / Session Workspace

### Maturity Target

L1 → L2 (Foundational productivity capability)

### Objective

Enable users to record remote meetings locally inside Obsidian Sessions and generate structured Markdown summaries using local AI models (with optional Ollama integration), ensuring full data sovereignty and traceability.

---

## 2. Problem Statement

When participating in remote meetings:

- Notes are fragmented across tools.
    
- Recordings are stored outside the knowledge system.
    
- Summaries are manual and time-consuming.
    
- Decisions and action items are not consistently extracted.
    
- AI tools often require cloud processing (privacy concern).
    

Users need a **fully local, integrated workflow** inside Obsidian that:

- Records meetings
    
- Attaches recordings to a Session
    
- Transcribes locally
    
- Generates structured Markdown summaries
    
- Marks audio as processed
    
- Shows recording status in real time
    

---

## 3. Goals

### Functional Goals

1. Record meeting audio from within Obsidian.
    
2. Store audio inside the respective Session.
    
3. Provide visible recording status (at least status bar).
    
4. Generate transcript locally.
    
5. Generate structured Markdown summary.
    
6. Mark recording as processed.
    
7. Support local AI via Ollama.
    
8. Keep all data local (no external API required).
    

### Non-Functional Goals

- Fully offline-capable.
    
- Deterministic and reproducible.
    
- Transparent processing state.
    
- Compatible with Windows/macOS/Linux.
    
- Scalable for future diarization and speaker detection.
    

---

## 4. Non-Goals (v1)

- Cloud transcription
    
- Multi-speaker identification (diarization)
    
- Automatic meeting joining
    
- Real-time transcription
    
- Cross-device synchronization of recordings
    

---

## 5. Primary User Persona

### Product Owner / Knowledge Worker

- Participates in remote meetings
    
- Takes structured notes in Obsidian
    
- Needs reliable action-item extraction
    
- Cares about data privacy
    
- Uses local-first workflows
    

---

## 6. Jobs To Be Done

|Situation|Job|Outcome|
|---|---|---|
|During a remote meeting|Record the discussion without leaving Obsidian|Audio is stored in the Session|
|After meeting|Generate summary from recording|Structured Markdown summary|
|While recording|See clear recording indicator|Avoid accidental non-recording|
|After processing|Know if audio has been processed|Clear status|
|Reviewing later|Access transcript and summary easily|Full traceability|

---

## 7. User Stories

1. As a user, I want to start recording from the Session so that the audio is linked automatically.
    
2. As a user, I want to see recording duration in the status bar.
    
3. As a user, I want to stop recording and save audio locally.
    
4. As a user, I want to click “Summarize” so that a Markdown summary is generated.
    
5. As a user, I want the Session to reflect that the recording was processed.
    
6. As a user, I want to use Ollama locally for summary generation.
    
7. As a user, I want to configure which model is used.
    
8. As a user, I want processing status visible.
    

---

## 8. Functional Requirements

### 8.1 Session Binding

- Recording must attach to the currently active Session note.
    
- Session must have a unique session_id.
    
- If none exists, plugin prompts to initialize session metadata.
    

---

### 8.2 Recording

- User can:
    
    - Start recording
        
    - Stop recording
        
- Audio is saved to a Session-specific folder.
    
- Audio file is referenced in Session frontmatter.
    
- Recording status appears in status bar:
    
    - Idle
        
    - Recording (with duration)
        
    - Processing
        
    - Completed
        
    - Error
        

---

### 8.3 Audio Storage

Recommended structure:

```
Resources/Sessions/<session_id>/
  audio/
  transcript/
  summary/
```

Audio format must be consistent and transcribable.

---

### 8.4 Transcription

- Must run locally.
    
- Must support pluggable transcription backend.
    
- Output must include:
    
    - Full text
        
    - Optional segments with timestamps
        
    - Metadata (model, duration, language)
        

Transcript may be:

- Stored as JSON
    
- Stored as Markdown
    
- Or both
    

---

### 8.5 Summary Generation

When user clicks “Summarize”:

1. Transcription is executed (if not existing).
    
2. Summary generation is executed.
    
3. Summary Markdown note is created or updated.
    
4. Session metadata is updated:
    
    - processed: true
        
    - status: done
        
    - last_processed_at timestamp
        

---

### 8.6 Ollama Integration

- User can enable Ollama in settings.
    
- User can configure:
    
    - Ollama endpoint (default: [http://localhost:11434](http://localhost:11434/))
        
    - Model name
        
    - Temperature
        
    - System prompt template
        
- If Ollama is unavailable:
    
    - Plugin must fallback gracefully (error state visible).
        
- Must never send data outside localhost unless explicitly configured.
    

---

### 8.7 Status Bar Indicators

Minimum requirements:

|State|Indicator|
|---|---|
|Idle|Session Ready|
|Recording|● REC mm:ss|
|Processing|⟳ Transcribing…|
|Summarizing|⟳ Summarizing…|
|Done|✓ Summary Updated|
|Error|⚠ Error|

---

### 8.8 Processed State

Processed state must be stored in Session frontmatter:

```yaml
  status: idle | recording | processing | done | error
  audio_file: path
  processed: true | false
  transcript_note: path
  summary_note: path
  last_processed_at: ISO timestamp
```

If audio changes, processed must reset to false.

---

## 9. UX Requirements

### Commands

- Session: Start Recording
    
- Session: Stop Recording
    
- Session: Summarize Recording
    
- Session: Reprocess Recording
    
- Session: Open Session Assets
    

### Settings Panel

- Recording input device selection
    
- Transcription backend selection
    
- Ollama enable toggle
    
- Ollama model
    
- Summary template
    
- Storage path configuration
    

---

## 10. Summary Output Structure (Default Template)

```markdown
# Summary — {{session_title}}

## Highlights
-

## Decisions
-

## Action Items
- [ ] 

## Risks / Blockers
-

## Topics Discussed
-

## Transcript Reference
[[transcript_note]]
```

---

## 11. Error Handling

- If recording fails → status error + notification.
    
- If transcription fails → summary disabled.
    
- If Ollama unreachable → summary error but transcript remains.
    
- Must not corrupt session metadata.
    

---

## 12. Non-Functional Requirements

|Category|Requirement|
|---|---|
|Privacy|Fully local processing|
|Performance|Must handle ≥ 60 min meeting|
|Stability|No UI freeze during processing|
|Extensibility|Pluggable AI backends|
|Traceability|All artifacts stored in vault|
|Observability|Clear status transitions|

---

## 13. Risks

|Risk|Mitigation|
|---|---|
|System audio capture unreliable|Allow device selection|
|Long meetings cause memory issues|Stream processing|
|Ollama model too slow|Configurable model|
|Large transcript causes context overflow|Chunking strategy|

---

## 14. Future Enhancements

- Speaker diarization
    
- Real-time transcription
    
- Action item auto-linking
    
- Task extraction into Task Store
    
- Canvas visualization of meeting flow
    
- Session analytics dashboard
    
- AI-based meeting classification
    

---

## 15. Success Metrics

- ≥ 90% successful local transcription
    
- ≤ 2 clicks to summary
    
- Recording state always visible
    
- Zero cloud dependencies
    
- Process reproducible on fresh machine
    

---

# Architectural Intent

This feature establishes:

- A local AI processing pipeline
    
- Session-bound artifact lifecycle
    
- Status-driven UX state machine
    
- Foundation for deeper AI-assisted workflows in Flowti
    

It becomes a core enabler for:

- Session Workspace maturity
    
- AI-Augmented Product Development
    
- Local-first knowledge automation
    

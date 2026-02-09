# Jobs to be Done: The Developer (Sam)

> Persona: [The Developer](Development/watcher/docs/personas/Developer.md) | Journey: [Journey 2](../journeys/journey-2-edit-from-both-sides.md)

## Jobs

| Job | When I… | I want to… | So that… |
|-----|---------|------------|----------|
| **Edit seamlessly** | switch between Obsidian and VS Code on the same markdown file | see my latest save reflected in the other editor within seconds | I work fluidly without thinking about sync |
| **Avoid sync storms** | type rapidly in VS Code (many saves per second) | have edits debounced into a single sync operation | the plugin doesn't fire hundreds of redundant syncs |
| **Prevent loops** | save in VS Code, triggering a vault event, triggering a reverse sync… | have the loop detector block the bounce-back | my CPU and disk are not consumed by infinite sync cycles |
| **Resolve conflicts fairly** | edit a file in Obsidian while VS Code also auto-saves | have the newer version win automatically | I don't lose my most recent work |
| **Detect moves** | rename or move a file in VS Code | see the vault reflect the move (not a delete + add) | my Obsidian links and backlinks stay intact |
| **Handle long paths** | create deeply nested project docs in Windows | get a clear warning if the path exceeds MAX_PATH (260 chars) | I don't encounter cryptic file system errors later |

---
type: Idea
stage: discovery
origin: inbox
domain: collaboration
parent: "[[Multiplayer PRD]]"
description: "Right-click a file to copy it to an external share folder — tracked in a markdown manifest, event-driven."
tags:
priority: 0 - low
rank:
---

as of right now we are limited in options to share. Easiest solution for the mvp is to just copy a file into a folder outside of the vault. 

I envision a solution where I can configure a path outside of the vault of a folder picker. When ever I decide to share a file or folder, this file or folder will then get copied to this "Share" folder with the Username as root.

As for example: `$externalFolder/$userName/path/to/file`

The application keeps track of what is shared and persists this list in a Markdown file.

Other services can also mark a file or folder as shared with simple events which also opens up the possibility for commands.


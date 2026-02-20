---
type:
tags:
---
I want to use the User Hub Inbox also to watch Vault Folders. I need to be able to configure multiple folders to watch. The can also watch recursively but this can be configured. 

The Idea is, to connect folders to the inbox for ingestion and one main target folder where new notes get captured. We want to embrace the "Inbox Zero" idea, the only task with the inbox is to set a note as "read". At most the user can edit type and description. Once a note is typed, it will disappear from the inbox. 

The flow is as follows:

- a new note gets created in the vault folder "inbox"
- this note does only have a title
- the note appears in the user hub inbox
- the user can click read, this will give the note the frontmatter props from the note template
- or:
	- the user changes the type in the inbox editor and clicks on read afterwards
- or:
	- the user enters a description or updates both
- the closing action will be always to mark a note without frontmatter as read to start the data quality journey and set the first frontmatter properties

The Inbox can also listen to other folders to capture empty notes and display them in the inbox, this will update the note. 

New notes from the inbox will always go into exactly one target folder. 

The Inbox actions can potentially be combined with data-massage or template supported by Obsidian Bases config files.

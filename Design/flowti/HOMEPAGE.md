# Flowti - The Business Development Environment

Goal of this system is to provide a unified data-model for core business elements and processes. Obsidian helps consolidating and publishing of content.

Obsidian is also used to enrich and visualize gathered data by providing easy to use interfaces supporting day-2-day business operations.

We use Obsidians flexibility to test and validate new ideas while further enhancing the underlying dataset.

> Keep it simple!

To achieve our goal we use well-defined and documented workflows with high data-value in mind, directly accessible trough the vault.

[[Design/flowti/Flowti IBDE - User Vault|Flowti IBDE - User Vault]]
## Daily Notes

```base
filters:
  and:
    - file.inFolder("03 - Resources/Daily Notes")
views:
  - type: cards
    name: Notes
    order:
      - file.name
      - file.tags
      - file.links
      - file.backlinks
    sort:
      - property: file.name
        direction: DESC
    limit: 4
    image: note.Image

```

## Activity log

```base
views:
  - type: table
    name: Table
    order:
      - file.name
      - file.folder
      - doc_type
      - file.mtime
      - file.ctime
      - file.tags
    sort:
      - property: file.mtime
        direction: DESC
    limit: 10

```

## Projects

```base
filters:
  and:
    - file.inFolder("01 - Projects")
    - file.ext == "canvas"
views:
  - type: cards
    name: Projects
    order:
      - file.name
      - file.folder
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
    limit: 4
    image: note.Image

```

## Views into the business

```base
filters:
  and:
    - file.inFolder("03 - Resources/Views")
properties:
  file.name:
    displayName: Name
views:
  - type: table
    name: Table
    order:
      - file.name
      - Description
      - update_interval
      - doc_type
      - parent
      - priority
      - status
      - design_file
      - users
      - tags
      - aliases
  - type: cards
    name: Cards
    order:
      - file.name
      - Description
      - update_interval
      - doc_type
      - parent
      - priority
      - status
      - design_file
      - users
      - tags
      - aliases
    image: note.Image

```

## Daily Exports

Those are the daily exports the system provides for further consumption.

```base
filters:
  and:
    - file.inFolder("03 - Resources/Exports")
properties:
  file.name:
    displayName: Name
views:
  - type: table
    name: Table
    order:
      - file.name
      - Description
      - Source
      - Consumer
      - tags
      - aliases

```


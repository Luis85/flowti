# OneSeater - The Motorsport Manager

Become a Teammanager, build a Team, win prizes.

The game is about chasing opportunities and dealing with events. 
You start in 1948 as a young lad with a dream...one day you will be world champion with your own motorsports team.

When suddenly an Opportunity arises...do you take it? Are you willing to build a legacy? Or even go for world dominance?

## Game Systems

- [x] Random Message Creation System to kick of actions
- [x] Daily Energy System to choose wisely which tasks you want to do
- [x] Player Experience System
- [x] 3d6 Dice based Success System
- [ ] Economy System with a mini ERP
- [ ] Quests and Tasks System
- [ ] Monies System
- [ ] Periodic Save and Reporting System
- [ ] Narrator System (an AI reacts to events or dice rolls)
- [ ] Character Development System
- [ ] Skill System
- [ ] Building System
- [ ] Crafting System
- [ ] Inventory System
- [ ] Automation System with the Scheduling Panel
- [ ] Human Resources System
- [ ] Incremental Game Loop
- [ ] Incremental Organization Building System
- [ ] Team Development System
- [ ] Driver Development System
- [ ] Race Day System
- [ ] Motorsport Season System
- [ ] Young Driver Development System

## Game and Product Design Document

> [!NOTE] TBD

### Game loop

The player receives new messages on a daily basis, his task is to find new opportunities in the endless stream of new messages. 

The player can alter the influx by creating new Products to sell, install a spam filter, invest in marketing or pr, hire an assistant, or automate the whole inbox to get the needed data for downstream processes.

His ultimate goal is to find and execute on valuable opportunities, grow the business and buy a motorsport license...

## Chapter 1

**Goal:** Buy a Motorsport License

- Earn monies by fulfilling customer orders
- Earn XP by finishing daily tasks

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
    columnSize:
      file.name: 275
      file.folder: 264
      note.doc_type: 143

```


## Current Implementation

![[OneSeater - Systemdesign.canvas]]
---
type: Idea
stage: delivered
delivered_in: "[[Cycle 11 - Azure DevOps Integration]]"
origin: inbox
domain: signal
parent: "[[Azure DevOps Integration PRD]]"
description: "Pull Azure DevOps Boards backlog into vault as structured notes via Signals framework. First external integration — introduces adapter pattern, PAT auth, and sync lifecycle."
tags:
  - azure-devops
  - signal
  - integration
priority: 2 - high
rank:
planned_in: "[[Cycle 11 - Azure DevOps Integration]]"
pbi: "[[PBI-SIG-001 Signal Domain Foundation]]"
related:
  - "[[I want to import an Azure DevOps Boards project with all of it's workitems]]"
  - "[[I want to connect to Azure DevOps Boards and get all items and git repos]]"
  - "[[I want to manage multiple Azure DevOps Boards in Flowti]]"
  - "[[I want to extend the data exchange hub with Signals, those are the domain for integrations]]"
---
We already have the data exchange hub for import and export, we also need to be able to listen to signals and pull from them.

I envision a new feature for the data exchange: Signals. This will be the starting point for integrations. I can configure a new signal based on provided Adapters.

Signals could be rss feeds or apis from external systems. I connect to those sources through signals. They can get their data periodically or manually. A signal can be receive, send, or bi-directional connect.

The first signal I want to connect to is Azure DevOpsBoards. I want to create a signal for every organization and project I am part of and pull and push workitems to their backlogs.

Received WorkItems should live in resources/signals/signalname/items

I want to be able to work on and keep in sync multiple backlogs I have to manage.

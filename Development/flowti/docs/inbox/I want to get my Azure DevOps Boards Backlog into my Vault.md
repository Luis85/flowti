We already have the data exchange hub for import and export, we also need to be able to listen to signals and pull from them.

I envision a new feature for the data exchange: Signals. This will be the starting point for integrations. I can configure a new signal based on provided Adapters.

Signals could be rss feeds or apis from external systems. I connect to those sources through signals. They can get their data periodically or manually. A signal can be receive, send, or bi-directional connect.

The first signal I want to connect to is Azure DevOpsBoards. I want to create a signal for every organization and project I am part of and pull and push workitems to their backlogs.

Received WorkItems should live in resources/signals/signalname/items

I want to be able to work on and keep in sync multiple backlogs I have to manage.


# Flowti CLI — command surface (built-in)

**Generated** — regenerate with `flowti docs:cli-surface` (or `node .flowti/bin/main.mjs docs:cli-surface`).

## Plugin / Obsidian entry

The Flowti Obsidian plugin and other tooling should invoke the bundled CLI as:

```text
node <vault>/.flowti/bin/main.mjs <command> [flags...]
```

- Global flags: `--verbose`, `--quiet`, `--no-color`, `--project=<name>`, `--format=json` (where supported).
- `agent:start` is a special case: it opens a JSONL stdin/stdout loop and does not exit until the session ends.
- **No interactive TUI** — the CLI is command-only; empty invocation exits with usage and a non-zero code.

Plugin-provided commands are registered at runtime when a project is loaded; they are **not** listed below.

## Capabilities (domains)

- **agent**
- **ai-tools**
- **build**
- **capa**
- **capture**
- **claude**
- **completions**
- **deliverables**
- **devtools**
- **events**
- **health**
- **help**
- **info**
- **lifecycle**
- **make**
- **onboarding**
- **plugins**
- **project**
- **publish**
- **raid**
- **reports**
- **requirements**
- **resources**
- **review**
- **scaffold**
- **serve**
- **sitemap**
- **state**
- **storybook**
- **timelog**
- **vault-test**
- **workspace**

## Commands

Wildcard: commands matching `report:*` are handled by domain **reports** (e.g. `report:my-id`).

| Command | Domain | Project-free | Requires project | rawArgs | Wildcard prefix | Flags |
|---------|--------|--------------|------------------|---------|-----------------|-------|
| `agent:list` | agent | yes | no | no | — | — |
| `agent:permission` | agent | yes | no | no | — | `agent` (string, required); `tool` (string, required); `decision` (string, required) |
| `agent:task` | agent | yes | no | no | — | `agent` (string, required); `task` (string, required) |
| `agent:wake` | agent | yes | no | no | — | `agent` (string, required) |
| `ai:list` | ai-tools | yes | no | no | — | — |
| `ai:new` | ai-tools | yes | no | no | — | — |
| `ai:reference` | ai-tools | yes | no | no | — | — |
| `ai:run` | ai-tools | yes | no | no | — | `tool` (string, required); `dry-run` (boolean, optional, default=false) |
| `ai:validate` | ai-tools | yes | no | no | — | — |
| `build` | build | no | no | no | — | — |
| `build:auto` | build | no | yes | no | — | — |
| `build:check` | build | no | yes | no | — | — |
| `build:distribute` | build | no | no | no | — | — |
| `build:full` | build | no | no | no | — | — |
| `build:increment` | build | no | no | no | — | — |
| `build:record` | build | no | yes | no | — | — |
| `build:watch` | build | no | no | no | — | `reload` (boolean, optional, default=false) |
| `capa:add` | capa | no | yes | no | — | `name` (string, required); `capa-type` (string, optional, default="corrective"); `id` (string, optional, default=""); `severity` (string, optional, default="medium"); `source` (string, optional, default="observation"); `owner` (string, optional, default=""); `due` (string, optional, default=""); `root-cause` (string, optional, default=""); `description` (string, optional, default="") |
| `capa:list` | capa | no | yes | no | — | — |
| `capa:update` | capa | no | yes | no | — | `name` (string, required); `status` (string, required) |
| `capture:idea` | capture | yes | no | no | — | — |
| `capture:import` | capture | yes | no | no | — | — |
| `capture:note` | capture | yes | no | no | — | — |
| `capture:search` | capture | yes | no | no | — | — |
| `claude:sync` | claude | yes | no | no | — | — |
| `completions` | completions | yes | no | yes | — | — |
| `debt:estimate` | health | no | yes | no | — | — |
| `deliverables:add` | deliverables | no | yes | no | — | `name` (string, required); `status` (string, optional, default="planned"); `due` (string, optional, default=""); `assignee` (string, optional, default=""); `priority` (string, optional, default="medium"); `completion` (string, optional, default="0"); `description` (string, optional, default="") |
| `deliverables:list` | deliverables | no | yes | no | — | — |
| `deliverables:update` | deliverables | no | yes | no | — | `name` (string, required); `status` (string, required); `completion` (string, optional, default="") |
| `dev:analysis` | devtools | no | no | no | — | — |
| `dev:check` | devtools | no | no | no | — | — |
| `dev:console` | devtools | no | no | no | — | — |
| `dev:debug:off` | devtools | no | no | no | — | — |
| `dev:debug:on` | devtools | no | no | no | — | — |
| `dev:errors` | devtools | no | no | no | — | — |
| `dev:fix-frontmatter` | devtools | no | no | no | — | `dry-run` (boolean, optional, default=false) |
| `dev:lint` | devtools | no | no | no | — | — |
| `dev:rebuild` | devtools | no | no | no | — | — |
| `dev:reload` | devtools | no | no | no | — | `vault` (string, optional, default="") |
| `dev:testdata` | devtools | no | no | no | — | `from` (string, optional, default="2025-01"); `to` (string, optional, default=""); `seed` (string, optional, default="42"); `out` (string, optional, default=""); `dry-run` (boolean, optional, default=false) |
| `docs` | reports | no | yes | no | — | — |
| `docs:cli-surface` | devtools | yes | no | no | — | `out` (string, optional, default="docs/cli-command-surface.md") |
| `edit:component` | make | no | no | no | — | `name` (string, optional, default="") |
| `events:add` | events | no | yes | no | — | `name` (string, optional, default=""); `domain` (string, optional, default="core"); `version` (string, optional, default="1.0.0"); `description` (string, optional, default=""); `producers` (string, optional, default=""); `consumers` (string, optional, default=""); `payload` (string, optional, default="") |
| `events:check-payload` | events | no | yes | no | — | `event` (string, optional, default=""); `payload` (string, optional, default="") |
| `events:codegen` | events | no | yes | no | — | `out` (string, optional, default="") |
| `events:contracts` | events | no | yes | no | — | `out` (string, optional, default="") |
| `events:flow` | events | no | yes | no | — | `domain` (string, optional, default="") |
| `events:list` | events | no | yes | no | — | — |
| `events:validate` | events | no | yes | no | — | — |
| `events:version` | events | no | yes | no | — | `name` (string, optional, default=""); `version` (string, optional, default=""); `migration` (string, optional, default="") |
| `health` | health | no | yes | no | — | — |
| `health:history` | health | no | yes | no | — | — |
| `health:snapshot` | health | no | yes | no | — | — |
| `help` | help | yes | no | yes | — | — |
| `info` | info | no | yes | no | — | — |
| `lifecycle:create` | lifecycle | no | yes | no | — | `name` (string, required); `type` (string, optional, default="feature"); `description` (string, optional, default=""); `subdir` (string, optional, default="") |
| `lifecycle:history` | lifecycle | no | yes | no | — | `name` (string, required); `subdir` (string, optional, default="") |
| `lifecycle:list` | lifecycle | no | yes | no | — | `type` (string, optional, default=""); `subdir` (string, optional, default="") |
| `lifecycle:status` | lifecycle | no | yes | no | — | `name` (string, required); `subdir` (string, optional, default="") |
| `lifecycle:transition` | lifecycle | no | yes | no | — | `name` (string, required); `to` (string, required); `reason` (string, required); `subdir` (string, optional, default="") |
| `make:c4-component` | make | no | no | no | — | `name` (string, optional, default="") |
| `make:component` | make | no | no | no | — | `name` (string, optional, default="") |
| `make:container` | make | no | no | no | — | `name` (string, optional, default="") |
| `make:definition` | make | no | no | no | — | `name` (string, optional, default="") |
| `make:person` | make | no | no | no | — | `name` (string, optional, default="") |
| `make:system` | make | no | no | no | — | `name` (string, optional, default="") |
| `marketplace:export` | scaffold | yes | no | no | — | `output` (string, optional, default="") |
| `marketplace:import-bundle` | scaffold | yes | no | no | — | `file` (string, required) |
| `onboarding:restart` | onboarding | yes | no | no | — | — |
| `onboarding:skip` | onboarding | yes | no | no | — | — |
| `onboarding:start` | onboarding | yes | no | no | — | — |
| `onboarding:status` | onboarding | yes | no | no | — | — |
| `plugin:list` | plugins | yes | no | no | — | — |
| `plugin:new` | plugins | yes | no | no | — | — |
| `plugin:reference` | plugins | yes | no | no | — | — |
| `plugin:validate` | plugins | yes | no | no | — | — |
| `project` | project | yes | no | no | — | — |
| `project:bootstrap` | project | no | yes | no | — | `build` (string, optional, default=""); `test` (string, optional, default=""); `lint` (string, optional, default=""); `storybook` (string, optional, default="") |
| `project:ci` | build | no | yes | no | — | `dry-run` (boolean, optional, default=false) |
| `project:create` | project | no | no | no | — | `name` (string, required) |
| `project:deps` | project | yes | no | no | — | — |
| `project:detect` | project | no | yes | no | — | — |
| `publish` | publish | no | no | no | — | `dry-run` (boolean, optional, default=false); `skip-gates` (boolean, optional, default=false) |
| `publish:all` | publish | no | no | no | — | `skip-gates` (boolean, optional, default=false) |
| `publish:check` | publish | no | yes | no | — | — |
| `raid:add` | raid | no | yes | no | — | `name` (string, required); `item-type` (string, optional, default="risk"); `severity` (string, optional, default="medium"); `owner` (string, optional, default=""); `due` (string, optional, default=""); `category` (string, optional, default="technical"); `description` (string, optional, default="") |
| `raid:list` | raid | no | yes | no | — | — |
| `raid:update` | raid | no | yes | no | — | `name` (string, required); `status` (string, required) |
| `readme` | project | no | yes | no | — | — |
| `report:*` | reports | no | yes | no | `report:*` | — |
| `reports` | reports | no | no | no | — | `parallel` (boolean, optional, default=false) |
| `reports:audit` | reports | no | no | no | — | `parallel` (boolean, optional, default=false) |
| `reports:diff` | reports | no | yes | no | — | — |
| `reports:html` | reports | no | yes | no | — | `output` (string, optional, default="") |
| `requirements:add` | requirements | no | yes | no | — | `name` (string, required); `type` (string, optional, default="functional"); `id` (string, optional, default=""); `status` (string, optional, default="draft"); `priority` (string, optional, default="should"); `source` (string, optional, default=""); `rationale` (string, optional, default=""); `description` (string, optional, default="") |
| `requirements:list` | requirements | no | yes | no | — | — |
| `requirements:update` | requirements | no | yes | no | — | `name` (string, required); `status` (string, required) |
| `resources:add` | resources | no | yes | no | — | `name` (string, required); `type` (string, optional, default="human"); `role` (string, optional, default=""); `price` (string, optional, default="0"); `amount` (string, optional, default="1"); `description` (string, optional, default=""); `category` (string, optional, default=""); `currency` (string, optional, default=""); `period-start` (string, optional, default=""); `period-end` (string, optional, default="") |
| `resources:list` | resources | no | yes | no | — | — |
| `resources:summary` | resources | no | yes | no | — | — |
| `review` | review | no | no | no | — | — |
| `review:all` | review | no | yes | no | — | — |
| `review:changes` | review | no | yes | no | — | `base` (string, optional, default="") |
| `review:clean` | review | no | yes | no | — | — |
| `review:coverage` | review | no | yes | no | — | — |
| `review:e2e` | review | no | no | no | — | `format` (string, optional, default=""); `journey` (string, optional, default="") |
| `review:e2e:list` | review | no | no | no | — | `format` (string, optional, default="") |
| `review:evidence` | review | no | yes | no | — | — |
| `review:gates` | review | no | yes | no | — | — |
| `review:traceability` | review | no | yes | no | — | — |
| `scaffold:import` | scaffold | no | yes | no | — | `file` (string, required) |
| `scaffold:list` | scaffold | yes | no | no | — | — |
| `scaffold:marketplace` | scaffold | yes | no | no | — | — |
| `scaffold:new` | scaffold | yes | no | no | — | `name` (string, required); `definition` (string, optional, default="flowti-project"); `author` (string, optional, default=""); `output` (string, optional, default=""); `dry-run` (boolean, optional, default=false) |
| `serve` | serve | yes | no | no | — | `port` (number, optional, default=3000); `dir` (string, optional, default=".flowti/agents") |
| `serve:status` | serve | yes | no | no | — | — |
| `serve:stop` | serve | yes | no | no | — | — |
| `sitemap:status` | sitemap | yes | no | no | — | — |
| `sitemap:validate` | sitemap | yes | no | no | — | — |
| `sitemap:views` | sitemap | yes | no | no | — | — |
| `state` | state | yes | no | no | — | — |
| `stories:add` | requirements | no | yes | no | — | `name` (string, required); `role` (string, required); `goal` (string, required); `benefit` (string, required); `id` (string, optional, default=""); `points` (string, optional, default="0"); `description` (string, optional, default="") |
| `stories:list` | requirements | no | yes | no | — | — |
| `storybook:build` | storybook | no | yes | no | — | — |
| `storybook:canvas-generate` | storybook | no | yes | no | — | `preset` (string, optional, default=""); `force` (boolean, optional, default=false) |
| `storybook:canvas-import` | storybook | no | yes | no | — | `canvas` (string, optional); `output` (string, optional); `merge` (boolean, optional) |
| `storybook:clean` | storybook | no | yes | no | — | — |
| `storybook:generate` | storybook | no | yes | no | — | — |
| `storybook:import` | storybook | no | yes | no | — | `output` (string, optional); `source` (string, optional); `saveConfig` (boolean, optional); `strategy` (string, optional); `fields` (string, optional) |
| `storybook:install` | storybook | no | yes | no | — | `framework` (string, optional) |
| `storybook:scaffold` | storybook | yes | yes | no | — | `sitemap` (string, optional); `framework` (string, optional); `adoptImport` (boolean, optional) |
| `storybook:start` | storybook | no | yes | no | — | — |
| `storybook:stop` | storybook | no | yes | no | — | — |
| `suggest:relationships` | make | no | no | no | — | — |
| `test` | build | no | no | no | — | — |
| `test:e2e` | build | no | no | no | — | — |
| `test:increment` | build | no | no | no | — | — |
| `test:vault` | vault-test | yes | no | no | — | — |
| `test:vault:ecosystem` | vault-test | yes | no | no | — | — |
| `test:vault:integration` | vault-test | yes | no | no | — | — |
| `test:vault:smoke` | vault-test | yes | no | no | — | — |
| `timelog:add` | timelog | no | yes | no | — | `person` (string, required); `task` (string, required); `date` (string, optional, default=""); `hours` (string, optional, default="1"); `category` (string, optional, default="development"); `description` (string, optional, default="") |
| `timelog:list` | timelog | no | yes | no | — | — |
| `timelog:summary` | timelog | no | yes | no | — | — |
| `usecases:add` | requirements | no | yes | no | — | `name` (string, required); `actor` (string, required); `id` (string, optional, default=""); `description` (string, optional, default="") |
| `usecases:list` | requirements | no | yes | no | — | — |
| `workspace:collect` | workspace | yes | no | yes | — | — |
| `workspace:dispose` | workspace | yes | no | yes | — | — |
| `workspace:inspect` | workspace | yes | no | yes | — | `id` (string, optional, default="") |
| `workspace:list` | workspace | yes | no | no | — | — |
| `workspace:provision` | workspace | yes | no | no | — | `agent` (string, optional, default="adhoc"); `branch` (string, optional, default=""); `base` (string, optional, default="") |
| `workspace:prune` | workspace | yes | no | no | — | `older-than` (string, optional, default=""); `dry-run` (boolean, optional, default=false) |

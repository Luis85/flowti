---
type: UseCase
domain: Flowti
stage: done
description: "Create and execute multi-import pipelines from the Hub Pipelines tab"
view: "[[Data Exchange Hub View]]"
feature: "[[Data Exchange Hub]]"
testplanRef: "UC-76"
tags:
  - use-case
  - hub
---

# Orchestrate Multi-Import Pipelines

## Summary

The user creates and manages multi-import pipelines that chain several saved import configurations into a single sequential run, enabling batch processing of related CSV files through the Hub's Pipelines tab.

## Preconditions

- The Data Exchange Hub view is open.
- At least two saved import configurations exist (pipelines require multiple steps to be meaningful).
- The CSV source files referenced by the pipeline steps are present in the vault.

## Steps

1. The user opens the Data Exchange Hub and selects the **Pipelines** tab from the tab bar.
2. The master list displays existing pipelines by name; the user clicks the **+** button to create a new pipeline.
3. The system creates a new pipeline entry and opens the detail panel in edit mode, prompting the user to name the pipeline.
4. The user adds steps to the pipeline by selecting from the list of saved import configurations; each step appears as an ordered item in the pipeline's step list.
5. The user reorders steps by dragging them or using up/down controls to set the correct execution sequence.
6. The user saves the pipeline; the system persists the pipeline definition (name, ordered step references) to storage and updates the master list.
7. The user clicks **Run Pipeline** to execute all steps sequentially; the detail panel displays a progress indicator for each step, marking steps as completed, in-progress, or pending.
8. When the pipeline finishes, the detail panel shows a summary: total notes created, any steps that were skipped or failed, and elapsed time.

## Outcome

The user has created a multi-step import pipeline and executed it in a single action. All referenced import configurations ran sequentially, and the user has a clear summary of the entire pipeline's results.

## Variations

- **Step failure**: If a step fails during execution, the pipeline halts and the detail panel highlights the failed step with its error message; the user can fix the issue and resume or retry.
- **Edit existing pipeline**: The user selects an existing pipeline, adds or removes steps, reorders them, and saves the updated definition.
- **Delete pipeline**: The user deletes a pipeline from the master list; the underlying import configurations are not affected.
- **Single-step pipeline**: The user creates a pipeline with only one step, which functions identically to running the import configuration directly but is saved as a named pipeline for convenience.
- **Dependent imports**: Steps later in the pipeline import data that depends on notes created by earlier steps, leveraging the sequential execution order.

## Related

- View: [[Data Exchange Hub View]]
- Feature: [[Data Exchange Hub]]
- Test: UC-76 in [[Testplan and Teststrategy]]

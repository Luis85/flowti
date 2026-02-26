---
type: Bug
stage: fixed
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
pbi: TD-124
description: Exporter does not evaluate Base formulas — preview shows property names instead of computed values.
tags:
priority: 2 - high
rank:
fixed_in: "[[Cycle 4 - Auto-Session and Activity Polish]]"
fixed_date: 2026-02-18
related: "[[exporter should only show view properties]]"
note: "Fixed in Cycle 4 Inc 1 via ResolvedColumn unified descriptor. Formula columns now resolve to computed values using scanResolvedColumns() + resolveColumnValue(). Both preview and export produce correct output."
---
Given I want to export a Base. While preview I want to see the value to which a formula evaluates. Right now I have 2 bugs with the exporter. I have a base view only consisting of formulas, all formulas are human friendly named like "Product Value". For some Formulas i see a property in lower.case. For no formula do I see the values in the preview.
---
type: Bug
stage: fixed
origin: inbox
domain: data-exchange
parent: "[[Data Exchange Hub PRD]]"
description: "Exporter shows all properties instead of only the selected view properties, ignoring the view's property sorting."
tags:
priority: 2 - high
rank:
fixed_in: "[[Cycle 4 - Auto-Session and Activity Polish]]"
fixed_date: 2026-02-18
related: "[[exporter is not evaluating formulas]]"
note: "Fixed in Cycle 4 Inc 1 via ResolvedColumn unified descriptor. When Base view has order array, scanResolvedColumns() produces exact view columns in view order. ConfigurePage shows read-only view columns section."
---
In the exporter of a view there should only be the selected properties from that particular view. They must adhere to the property sorting of the view. 
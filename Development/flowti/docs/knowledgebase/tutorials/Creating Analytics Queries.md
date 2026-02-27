---
type: KnowledgeBase
domain: Flowti
stage: done
description: How to create queries against vault data, apply filters and sorting, and view results in the Analytics Hub.
tags:
  - tutorial
  - analytics
  - queries
---

# Creating Analytics Queries

> Queries let you ask questions about your vault data and get structured answers. This tutorial shows you how to create, run, and save queries in the Analytics Hub.

---

## What Is an Analytics Query?

An analytics query is a question you ask about the structured data in your vault. Instead of manually browsing notes and counting things, you define what you want to see and let the analytics engine do the work.

Examples of questions you might ask:

- "How many notes of each type do I have?"
- "Which suppliers have a status of 'active'?"
- "What is the total value of open orders grouped by region?"
- "Show me all sessions completed this month"

Queries run against frontmatter properties — the structured fields at the top of your notes. This is why good [[Importing CSV Data|imports]] and consistent property naming matter. The richer your frontmatter, the more interesting your queries become.

---

## Opening the Analytics Hub

Open the command palette and search for **Open analytics hub**. The Analytics Hub has two main areas:

- **Queries** — where you build, run, and manage queries
- **Dashboards** — where you arrange query results into visual layouts (see [[Building Dashboards]])

Start with the Queries tab. You will see any saved queries listed here, along with a button to create a new one.

---

## Creating a Query Step by Step

1. Click **+** in the Queries tab to start a new query
2. **Choose a source** — select the folder or data source you want to query. The system scans the notes in that folder and discovers all available columns (frontmatter properties)
3. **Set the locale** — if your data uses European number formats (commas as decimal separators) or non-US date formats, choose the appropriate locale. Supported locales include US, UK, German, Dutch, and French
4. **Pick your columns** — select which properties to include in the results. You can rename columns with aliases and mark sensitive columns as private (values will be anonymized)
5. **Add filters** — narrow the results. For example, filter where `type` equals "supplier" or where `amount` is greater than 1000
6. **Add sorting** — order the results by one or more columns, ascending or descending
7. **Add grouping and aggregation** (optional) — group rows by a dimension (e.g., `region`) and aggregate a measure (e.g., SUM of `amount`, COUNT of rows, AVG of `score`). Supported aggregation functions are SUM, COUNT, AVG, MIN, MAX, and COUNT_DISTINCT
8. **Run the query** — click Run and see the results as a table

The results appear immediately. If something is not right, adjust the filters or columns and run again. Queries are interactive — experiment freely.

---

## Saving and Reusing Queries

Once you have a query that produces useful results, save it. Saved queries appear in your Queries list and can be:

- **Rerun** at any time with one click to get fresh results
- **Added to dashboards** as tiles (see [[Building Dashboards]])
- **Marked as favorites** for quick access
- **Used as templates** to create variations without starting from scratch

Give your saved queries clear names: "Active Suppliers by Region" is more helpful than "Query 3."

---

## Filtering in Depth

Filters are the most powerful part of the query builder. They let you narrow results to exactly what you need.

Each filter has three parts:

- **Column** — which property to filter on
- **Operator** — how to compare (equals, not equals, contains, greater than, less than, and more)
- **Value** — what to compare against

You can add multiple filters, and they work together to refine your results. For date columns, the system offers a **date range filter** with 12 preset ranges like "Today," "This week," "Last 30 days," "This quarter," and "This year." You can also set a custom date range.

---

## Sorting and Grouping

**Sorting** orders your results. You can sort by multiple columns — for example, sort by region first, then by amount descending within each region.

**Grouping** collapses rows into summaries. When you group by a column, individual rows disappear and you see one row per unique value in that column, with aggregated measures alongside. This is how you get answers like "total revenue per region" or "average score per team."

You can group by multiple dimensions to create cross-tabulations. The analytics engine handles the heavy lifting — you just pick the dimensions and measures.

---

## Joining Multiple Sources

If your data lives in multiple folders, you can add more than one source to a query and **join** them together. A join combines rows from two sources based on a matching column.

For example, if you have orders in one folder and customers in another, you can join them on a shared `customerId` column. The result is a combined dataset with columns from both sources.

The engine supports **inner joins** (only rows that match in both sources) and **left joins** (all rows from the first source, with matching data from the second where available).

---

## Tips for Effective Queries

**Start simple.** Pick one source, one or two columns, and run. Add complexity gradually.

**Use column type hints.** If a column contains numbers or dates but the engine treats it as text, set the type hint in the column configuration. This enables proper sorting and aggregation.

**Check the locale.** If numbers look wrong (e.g., "1.234" is being treated as one-point-two-three-four instead of one thousand two hundred thirty-four), switch to the correct locale.

**Save often.** If a query produces useful results, save it before you close the tab. Saved queries persist across sessions.

**Combine with dashboards.** Queries are the raw material. Dashboards are the presentation layer. See [[Building Dashboards]] for how to turn query results into visual tiles.

---

## Next Steps

- [[Building Dashboards]] — Arrange your query results into visual layouts
- [[Importing CSV Data]] — Bring in the data your queries will analyze
- [[Understanding Domains and Events]] — Understand the data model behind your vault

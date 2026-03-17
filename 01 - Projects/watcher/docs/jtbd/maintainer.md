# Jobs to be Done: The Maintainer (Luis)

> Persona: [The Maintainer](Development/watcher/docs/personas/Maintainer.md) | No journey — drives internal quality.

## Jobs

| Job | When I… | I want to… | So that… |
|-----|---------|------------|----------|
| **Validate a change** | push a commit or open a PR | run the full test suite and get a clear pass/fail | I know nothing is broken before releasing |
| **Diagnose a bug report** | receive a user report with vague symptoms | reproduce the issue with a targeted test | I can fix the root cause, not just the symptom |
| **Add a feature safely** | implement a new sync mode or filter | write acceptance tests before touching production code | the feature works as designed from the start |
| **Refactor with confidence** | extract a class or reorganize modules | see all 460+ tests stay green after the change | I know the refactor preserved behavior |
| **Understand failure modes** | think about what could go wrong | see edge-case tests (EBUSY, ENOENT, corrupt state, Unicode) | I cover real-world scenarios, not just happy paths |
| **Monitor code health** | review the test plan index | see coverage percentages and skip reasons per feature | I know where the gaps are and what unblocks them |
| **Ship a release** | tag a new version | run build + lint + typecheck + tests in one command | the release artifact is verified end-to-end |
| **Onboard a contributor** | hand off context to someone else (or future self) | point them to personas, journeys, and the test plan | they understand *why* the code is shaped this way |

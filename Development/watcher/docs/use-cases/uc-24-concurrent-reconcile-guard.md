# UC-24: Concurrent Reconcile Guard

**Feature:** [Reconciliation](../features/feature-05-reconciliation.md)

> As a user, I expect that triggering reconciliation while another is already running does not cause conflicts.

## Scenario 24.1: Second reconcile call is ignored ✅

```gherkin
Given reconciliation is already running
When reconcileAll() is called again (via settings or dashboard)
Then the second call should return immediately without action
  And the first reconciliation should continue unaffected
```

/**
 * merchant-visit.ts — MDSL subtree for autonomous merchant visits.
 *
 * When an agent is level 5+, has "trusted" or "autonomous" trust tier,
 * the merchant system has an affordable item, and the agent has not
 * visited the merchant this day cycle — seeks the merchant stall,
 * browses briefly, and executes auto-purchase.
 */

export const MERCHANT_VISIT_SUBTREE = `
root [MerchantVisit] {
	sequence {
		condition [IsMerchantEligible]
		condition [HasNotVisitedMerchantThisCycle]
		condition [HasAutoPurchaseAvailable]
		action [SeekMerchantStall]
		action [BrowseMerchant]
		action [ExecuteMerchantPurchase]
	}
}
`.trim();

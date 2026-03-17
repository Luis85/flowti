export function getTypeIcon(type: string): string {
	const icons: Record<string, string> = {
		Spam: "🗑️",
		Opportunity: "🏆",
		SupportRequest: "🎧",
		CustomerPurchaseOrder: "🛒",
		OrderCancelation: "🔥",
		Complain: "😤",
		RFQ: "📋",
		RFP: "📋",
		Invoice: "💰",
		Phishing: "💰",
		Payment: "💸",
		Newsletter: "📰",
		SponsorLead: "💼",
		GenericRequest: "⁉️",
	};
	return icons[type] || "📧";
}

export function getPriorityDot(priority: string): string {
	const dots: Record<string, string> = {
		"3 - Low": "⚫",
		"2 - Medium": "🟢",
		"1 - High": "🟡",
		"0 - Urgent": "🔥",
	};
	return dots[priority] || "⚫";
}

export function getPriorityLabel(priority: string): string {
	const labels: Record<string, string> = {
		"3 - Low": "⚫ Low",
		"2 - Medium": "🟢 Normal",
		"1 - High": "🟡 High",
		"0 - Urgent": "🔥 Urgent",
	};
	return labels[priority] || priority;
}

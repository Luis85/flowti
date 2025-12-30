import { TaskKind } from "src/eventsystem/tasks/TaskFinishedEvent";
import { SimulationMessage } from "src/models/SimulationMessage";
import { LineItemStrategy } from "src/orders";

export type MessageAction =
	| "read"
	| "delete"
	| "accept"
	| "decline"
	| "spam"
	| "archive"
	| "respond"
	| "negotiate"
	| "inspect"
	| "approve"
	| "collect";

export type MessagePriority =
	| "0 - Urgent"
	| "1 - High"
	| "2 - Medium"
	| "3 - Low";

export type MessageType =
	| "Message"
	| "Task"
	| "Info"
	| "Alert"
	| "Offer"
	| "Opportunity"
	| "Spam"
	| "RFP"
	| "RFQ"
	| "Complain"
	| "SupportRequest"
	| "CustomerPurchaseOrder"
	| "Phishing"
	| "Offer"
	| "GenericRequest"
	| "OrderCancelation"
	| "Invoice"
	| "Payment"
	| "ApprovalRequest"
	| "IT"
	| "System"
	| "Overdue"
	| "Refund"
	| "SalesDecision"
	| "Legal"
	| "VendorDelay"
	| "VendorUpdate"
	| "HR"
	| "Policy"
	| "InternalUpdate"
	| "Internal"
	| "Customer"
	| "Sales"
	| "Finance"
	| "Partner"
	| "ChangeRequest"
	| "Meeting"
	| "Quote"
	| "SupplierDelay"
	| "Procurement"
	| "Warehouse"
	| "Logistics"
	| "Project"
	| "QA"
	| "Planning"
	| "Scope"
	| "Incident"
	| "Access"
	| "Timesheets"
	| "Training"
	| "Recruiting"
	| "Compliance"
	| "Marketing"
	| "Facilities"
	| "Quality"
	| "Operations"
	| "Ops"
	| "Process"
	| "Reminder"
	| "Supplier"
	| "SupplierQuality"
	| "Delivery"
	| "SLA"
	| "Comms"
	| "Deployment"
	| "ChangeManagement"
	| "Security"
	| "Checklist"
	| "Account"
	| "Documentation"
	| "Expense";

export type MessageActionContext = {
	action: MessageAction;
	message: SimulationMessage;
};

export type MessageContext = {
	dayIndex: number;
	minuteOfDay: number;
};

export type MessageActionHandler = (
	ctx: MessageActionContext
) => void | Promise<void>;

export type MessageTemplate = {
	id: string;
	type: MessageType;
	category?: string;
	channel?: string;

	/** optional parent to other messages to build message threats */
	parent?: string;

	subject: string;
	body: string;
	author: string;

	priority: MessagePriority;
	possible_actions: MessageAction[];

	/** base weight used for weighted random pick */
	weight: number;

	/** soft-rule knobs: everything can happen, but some are more likely in certain contexts */
	soft?: {
		/**
		 * Multiplies weight based on time-of-day (minuteOfDay: 0..1439).
		 * Return value should be >0 (can be very small but never zero if you want "everything can happen").
		 */
		timeOfDayFactor?: (minuteOfDay: number) => number;

		/** Multiplies weight on weekends. */
		weekendFactor?: (isWeekend: boolean) => number;
	};

	/** optional routing hints for later systems (journeys) */
	tags?: string[];
	// Strategy for generating line items
	lineItemsStrategy?: LineItemStrategy;
};

export type ActionPlacement = "left" | "right";

export type MessageActionDef = {
	action: MessageAction;
	label: string;
	icon?: string;
	placement: ActionPlacement;
	btnClass: string;
	destructive?: boolean;
};

export type TaskRewardPolicy = {
	energyCost: number;
	timeCostMinutes: number;
	xpGain: number;
	tags?: string[];
	taskType: TaskKind;
	taskIdSuffix: string; // e.g. "read" (used in deterministic task id)
};

export type MessageActionPolicy = {
	action: MessageAction;

	/** If present, completing this action yields a TaskFinishedEvent */
	task?: TaskRewardPolicy;

	/** if you later want to block actions, return false + reason */
	canExecute?: (ctx: {
		messageId: string;
	}) => { ok: true } | { ok: false; reason: string };
};

export type ActionGateResult = { ok: true } | { ok: false; reason: string };

export interface IMessageActionGate {
	canExecute(action: MessageAction, messageId: string): ActionGateResult;

	/** UI-Cost-Badge/Tooltip */
	getCostHint?(
		action: MessageAction
	):
		| { energyCost: number; timeCostMinutes: number; xpGain: number }
		| undefined;
}

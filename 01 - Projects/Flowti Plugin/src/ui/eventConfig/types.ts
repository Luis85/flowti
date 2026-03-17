/**
 * Shared types for EventConfigModal page components.
 */

import type { App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { EventCatalogEntry } from "../../infrastructure/events/catalog";
import type { Subscription } from "../../domain/subscription/types";
import type { EventDefinition, PayloadMapping, EmissionPolicy } from "../../domain/eventDefinition/types";
import type { SubscriptionFormData } from "../catalog/helpers";

export interface DefinitionFormData {
	domainEventName: string;
	filePattern: string;
	emissionPolicy: EmissionPolicy;
	payloadMappings: PayloadMapping[];
}

export interface EventConfigPageDeps {
	app: App;
	eventBus: IEventBus;
	entry: EventCatalogEntry;
	eventsFolder: string;
	subscriptions: Subscription[];
	definitions: EventDefinition[];
	subFormData: SubscriptionFormData;
	defFormData: DefinitionFormData;
	editingSubscriptionId: string | null;
	editingDefinitionId: string | null;
	onEditSubscription: (id: string, formData: SubscriptionFormData) => void;
	onDeleteSubscription: (id: string, label: string) => void;
	onEditDefinition: (id: string, formData: DefinitionFormData) => void;
	onDeleteDefinition: (id: string, name: string) => void;
	onNavigateToPage: (page: string) => void;
	onOpenEventDoc: () => void;
	onRender: () => void;
}

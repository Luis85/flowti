/**
 * action-reference.ts — Curated reference of common user actions for components.
 *
 * Provides a categorised knowledgebase of actions that UI components typically
 * receive. Used to offer suggestions when adding actions to a component.
 */

export interface ActionEntry {
	name: string;
	description: string;
}

export interface ActionCategory {
	category: string;
	actions: ActionEntry[];
}

export const ACTION_REFERENCE: ActionCategory[] = [
	{
		category: "Mouse",
		actions: [
			{ name: "onClick", description: "Fired when the element is clicked" },
			{ name: "onDoubleClick", description: "Fired on double-click" },
			{ name: "onRightClick", description: "Fired on right-click / context menu" },
			{ name: "onMouseEnter", description: "Fired when pointer enters the element" },
			{ name: "onMouseLeave", description: "Fired when pointer leaves the element" },
			{ name: "onMouseDown", description: "Fired when a mouse button is pressed" },
			{ name: "onMouseUp", description: "Fired when a mouse button is released" },
			{ name: "onDrag", description: "Fired while the element is being dragged" },
			{ name: "onDragStart", description: "Fired when a drag operation begins" },
			{ name: "onDragEnd", description: "Fired when a drag operation ends" },
			{ name: "onDrop", description: "Fired when a dragged element is dropped" },
		],
	},
	{
		category: "Keyboard",
		actions: [
			{ name: "onKeyDown", description: "Fired when a key is pressed" },
			{ name: "onKeyUp", description: "Fired when a key is released" },
			{ name: "onKeyPress", description: "Fired on character key press" },
			{ name: "onEnter", description: "Fired when the Enter key is pressed" },
			{ name: "onEscape", description: "Fired when the Escape key is pressed" },
		],
	},
	{
		category: "Focus",
		actions: [
			{ name: "onFocus", description: "Fired when the element gains focus" },
			{ name: "onBlur", description: "Fired when the element loses focus" },
			{ name: "onFocusIn", description: "Fired when focus enters the element or a descendant" },
			{ name: "onFocusOut", description: "Fired when focus leaves the element or a descendant" },
		],
	},
	{
		category: "Form",
		actions: [
			{ name: "onChange", description: "Fired when the input value changes" },
			{ name: "onInput", description: "Fired on every keystroke in an input" },
			{ name: "onSubmit", description: "Fired when a form is submitted" },
			{ name: "onReset", description: "Fired when a form is reset" },
			{ name: "onSelect", description: "Fired when text is selected in an input" },
			{ name: "onInvalid", description: "Fired when form validation fails" },
			{ name: "onClear", description: "Fired when input is cleared" },
		],
	},
	{
		category: "Touch",
		actions: [
			{ name: "onTouchStart", description: "Fired when a touch begins" },
			{ name: "onTouchEnd", description: "Fired when a touch ends" },
			{ name: "onTouchMove", description: "Fired on touch movement" },
			{ name: "onSwipeLeft", description: "Fired on left swipe gesture" },
			{ name: "onSwipeRight", description: "Fired on right swipe gesture" },
			{ name: "onLongPress", description: "Fired on long press / touch hold" },
			{ name: "onPinch", description: "Fired on pinch gesture" },
		],
	},
	{
		category: "Scroll",
		actions: [
			{ name: "onScroll", description: "Fired when the element is scrolled" },
			{ name: "onScrollEnd", description: "Fired when scrolling stops" },
			{ name: "onScrollToTop", description: "Fired when scrolled to the top" },
			{ name: "onScrollToBottom", description: "Fired when scrolled to the bottom" },
		],
	},
	{
		category: "Lifecycle",
		actions: [
			{ name: "onInit", description: "Fired when the component initialises" },
			{ name: "onDestroy", description: "Fired when the component is destroyed" },
			{ name: "onMount", description: "Fired when the component is mounted to the DOM" },
			{ name: "onUnmount", description: "Fired when the component is removed from the DOM" },
			{ name: "onUpdate", description: "Fired when the component re-renders" },
			{ name: "onReady", description: "Fired when the component is fully initialised and visible" },
		],
	},
	{
		category: "Data",
		actions: [
			{ name: "onLoad", description: "Fired when data has been loaded" },
			{ name: "onError", description: "Fired when an error occurs" },
			{ name: "onRetry", description: "Fired when a retry is triggered" },
			{ name: "onRefresh", description: "Fired when data is refreshed" },
			{ name: "onSave", description: "Fired when data is saved" },
			{ name: "onDelete", description: "Fired when data is deleted" },
			{ name: "onCancel", description: "Fired when an operation is cancelled" },
		],
	},
	{
		category: "Selection",
		actions: [
			{ name: "onSelectionChange", description: "Fired when the selection changes" },
			{ name: "onSelectAll", description: "Fired when all items are selected" },
			{ name: "onDeselect", description: "Fired when an item is deselected" },
			{ name: "onItemSelect", description: "Fired when a specific item is selected" },
			{ name: "onRowSelect", description: "Fired when a table row is selected" },
			{ name: "onCellSelect", description: "Fired when a table cell is selected" },
		],
	},
	{
		category: "Navigation",
		actions: [
			{ name: "onNavigate", description: "Fired when navigation occurs" },
			{ name: "onTabChange", description: "Fired when the active tab changes" },
			{ name: "onPageChange", description: "Fired when the page changes (pagination)" },
			{ name: "onStepChange", description: "Fired when a wizard step changes" },
			{ name: "onBack", description: "Fired when navigating back" },
			{ name: "onNext", description: "Fired when navigating forward" },
		],
	},
	{
		category: "Toggle",
		actions: [
			{ name: "onToggle", description: "Fired when a toggle switches state" },
			{ name: "onOpen", description: "Fired when a panel or dropdown opens" },
			{ name: "onClose", description: "Fired when a panel or dropdown closes" },
			{ name: "onExpand", description: "Fired when a collapsible section expands" },
			{ name: "onCollapse", description: "Fired when a collapsible section collapses" },
			{ name: "onShow", description: "Fired when the element becomes visible" },
			{ name: "onHide", description: "Fired when the element becomes hidden" },
		],
	},
	{
		category: "Media",
		actions: [
			{ name: "onPlay", description: "Fired when media playback starts" },
			{ name: "onPause", description: "Fired when media playback is paused" },
			{ name: "onStop", description: "Fired when media playback stops" },
			{ name: "onSeek", description: "Fired when media seek position changes" },
			{ name: "onVolumeChange", description: "Fired when volume changes" },
			{ name: "onFullscreen", description: "Fired when entering/exiting fullscreen" },
		],
	},
	{
		category: "File",
		actions: [
			{ name: "onUpload", description: "Fired when a file upload begins" },
			{ name: "onUploadComplete", description: "Fired when a file upload completes" },
			{ name: "onFileSelect", description: "Fired when a file is selected" },
			{ name: "onFileRemove", description: "Fired when a file is removed" },
			{ name: "onDownload", description: "Fired when a download is triggered" },
		],
	},
	{
		category: "Sort & Filter",
		actions: [
			{ name: "onSort", description: "Fired when sorting is applied" },
			{ name: "onFilter", description: "Fired when a filter is applied" },
			{ name: "onSearch", description: "Fired when a search is performed" },
			{ name: "onClearFilters", description: "Fired when all filters are cleared" },
		],
	},
	{
		category: "Resize",
		actions: [
			{ name: "onResize", description: "Fired when the element is resized" },
			{ name: "onResizeStart", description: "Fired when a resize operation begins" },
			{ name: "onResizeEnd", description: "Fired when a resize operation ends" },
		],
	},
];

/** Returns all action names as a flat list. */
export function getAllActionNames(): string[] {
	return ACTION_REFERENCE.flatMap((cat) => cat.actions.map((a) => a.name));
}

/** Returns categories containing actions matching a search term. */
export function searchActions(term: string): ActionCategory[] {
	const lower = term.toLowerCase();
	return ACTION_REFERENCE
		.map((cat) => ({
			category: cat.category,
			actions: cat.actions.filter(
				(a) => a.name.toLowerCase().includes(lower) || a.description.toLowerCase().includes(lower),
			),
		}))
		.filter((cat) => cat.actions.length > 0);
}

/** Returns a flat list of all actions matching a search term. */
export function findActions(term: string): ActionEntry[] {
	const lower = term.toLowerCase();
	return ACTION_REFERENCE.flatMap((cat) =>
		cat.actions.filter(
			(a) => a.name.toLowerCase().includes(lower) || a.description.toLowerCase().includes(lower),
		),
	);
}

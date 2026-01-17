import { App, Modal, Setting } from "obsidian";
import type { IUserService } from "./types";

/**
 * Modal dialog for initial user setup.
 * Prompts the user to enter their name when first using the plugin.
 */
export class UserSetupModal extends Modal {
	private userName: string = "";
	private onSubmit: (name: string) => void;

	/**
	 * Shows the setup modal if no user exists.
	 * @param app - The Obsidian app instance
	 * @param userService - The user service to check and create user
	 */
	static showIfNeeded(app: App, userService: IUserService): void {
		if (!userService.hasUser()) {
			const modal = new UserSetupModal(app, async (name) => {
				await userService.createUser(name);
			});
			modal.open();
		}
	}

	/**
	 * Creates a new UserSetupModal.
	 * @param app - The Obsidian app instance
	 * @param onSubmit - Callback function called with the entered name when submitted
	 */
	constructor(app: App, onSubmit: (name: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-user-setup-modal");

		contentEl.createEl("h2", { text: "Welcome to Flowti" });
		contentEl.createEl("p", {
			text: "Please enter your name to get started. This will be used to identify you within your business environment.",
		});

		new Setting(contentEl)
			.setName("Your name")
			.setDesc("Enter your display name")
			.addText((text) =>
				text
					.setPlaceholder("Enter your name")
					.setValue(this.userName)
					.onChange((value) => {
						this.userName = value;
					})
			);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Get started")
				.setCta()
				.onClick(() => {
					if (this.userName.trim()) {
						this.onSubmit(this.userName.trim());
						this.close();
					}
				})
		);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

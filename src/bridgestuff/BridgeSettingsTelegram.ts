export interface BridgeSettingsTelegramProperties {
	chatId: number;
	sendUsernames: boolean;
	//relayCommands: boolean;
	relayJoinMessages: boolean;
	relayLeaveMessages: boolean;
	crossDeleteOnDiscord: boolean;
	allowedUserIds?: string[];
	blockedUserIds?: string[];
	groupMessages?: boolean;
	relayMedia?: boolean;
	mediaReplacementText?: string;
	ignoreCommands?: boolean;
	messageStyle?: "text" | "componentsV2";
}

/** Holds settings for the Telegram part of a bridge */
export class BridgeSettingsTelegram {
	public chatId: number;
	public sendUsernames: boolean;
	public relayJoinMessages: boolean;
	public relayLeaveMessages: boolean;
	public crossDeleteOnDiscord: boolean;
	public allowedUserIds: string[];
	public blockedUserIds: string[];
	public groupMessages: boolean;
	public relayMedia: boolean;
	public mediaReplacementText: string;
	public messageStyle: "text" | "componentsV2";
	//public relayCommands: boolean;

	/**
	 * Creates a new BridgeSettingsTelegram object
	 *
	 * @param settings Settings for the Telegram side of the bridge
	 * @param settings.chatId ID of the Telegram chat to bridge
	 * @param settings.relayJoinMessages Whether or not to relay join messages from Telegram to Discord
	 * @param settings.relayLeaveMessages Whether or not to relay leave messages from Telegram to Discord
	 */
	constructor(settings: BridgeSettingsTelegramProperties) {
		// Check that the settings object is valid
		BridgeSettingsTelegram.validate(settings);

		/** ID of the Telegram chat to bridge */
		this.chatId = Number.parseInt(settings.chatId.toString());

		/** Whether or not to relay join messages from Telegram to Discord */
		this.relayJoinMessages = settings.relayJoinMessages;

		/** Whether or not to relay join messages from Telegram to Discord */
		this.relayLeaveMessages = settings.relayLeaveMessages;

		/** Whether or not to send the user's name as part of the messages to Discord */
		this.sendUsernames = settings.sendUsernames;

		/** Whether or not to relay messages starting with "/" (commands) */
		//this.relayCommands = settings.relayCommands;

		/** Whether or not to delete messages when they are edited to be a single dot */
		this.crossDeleteOnDiscord = settings.crossDeleteOnDiscord;
		this.allowedUserIds = settings.allowedUserIds ?? [];
		this.blockedUserIds = settings.blockedUserIds ?? [];
		this.groupMessages = settings.groupMessages ?? false;
		this.relayMedia = settings.relayMedia ?? true;
		this.mediaReplacementText = settings.mediaReplacementText ?? "[Media omitted]";
		this.messageStyle = settings.messageStyle ?? "text";
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a BridgeSettingsTelegram object
	 *
	 * @param settings The object to validate
	 *
	 * @throws If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings: BridgeSettingsTelegramProperties) {
		// Check that relayJoinMessages is a boolean
		if (Boolean(settings.relayJoinMessages) !== settings.relayJoinMessages) {
			throw new Error("`settings.relayJoinMessages` must be a boolean");
		}

		// Check that relayLeaveMessages is a boolean
		if (Boolean(settings.relayLeaveMessages) !== settings.relayLeaveMessages) {
			throw new Error("`settings.relayLeaveMessages` must be a boolean");
		}

		// Check that sendUsernames is a boolean
		if (Boolean(settings.sendUsernames) !== settings.sendUsernames) {
			throw new Error("`settings.sendUsernames` must be a boolean");
		}

		// Check that relayCommands is a boolean
		/*if (Boolean(settings.relayCommands) !== settings.relayCommands) {
			throw new Error("`settings.relayCommands` must be a boolean");
		}*/

		// Check that crossDeleteOnDiscord is a boolean
		if (Boolean(settings.crossDeleteOnDiscord) !== settings.crossDeleteOnDiscord) {
			throw new Error("`settings.crossDeleteOnDiscord` must be a boolean");
		}
		for (const [key, value] of Object.entries({
			allowedUserIds: settings.allowedUserIds,
			blockedUserIds: settings.blockedUserIds
		})) {
			if (value !== undefined && (!Array.isArray(value) || value.some(id => typeof id !== "string"))) {
				throw new Error(`settings.telegram.${key} must be an array of user IDs`);
			}
		}
		if (settings.relayMedia !== undefined && typeof settings.relayMedia !== "boolean") {
			throw new Error("settings.telegram.relayMedia must be a boolean");
		}
		if (settings.groupMessages !== undefined && typeof settings.groupMessages !== "boolean") {
			throw new Error("settings.telegram.groupMessages must be a boolean");
		}
		if (settings.mediaReplacementText !== undefined && typeof settings.mediaReplacementText !== "string") {
			throw new Error("settings.telegram.mediaReplacementText must be a string");
		}
		if (settings.messageStyle !== undefined && !["text", "componentsV2"].includes(settings.messageStyle)) {
			throw new Error('settings.telegram.messageStyle must be "text" or "componentsV2"');
		}
	}
}

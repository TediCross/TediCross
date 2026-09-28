export const bridgeMediaTypes = ["photo", "video", "audio", "file", "sticker"] as const;
export type BridgeMediaType = (typeof bridgeMediaTypes)[number];

export interface BridgeMediaTypeSettingsProperties {
	enabled?: boolean;
	replacementText?: string;
}

export interface BridgeMediaSettingsProperties {
	enabled?: boolean;
	photo?: BridgeMediaTypeSettingsProperties;
	video?: BridgeMediaTypeSettingsProperties;
	audio?: BridgeMediaTypeSettingsProperties;
	file?: BridgeMediaTypeSettingsProperties;
	sticker?: BridgeMediaTypeSettingsProperties;
}

export interface BridgeMediaTypeSettings {
	enabled: boolean;
	replacementText: string;
}

export interface BridgeMediaSettings {
	enabled: boolean;
	photo: BridgeMediaTypeSettings;
	video: BridgeMediaTypeSettings;
	audio: BridgeMediaTypeSettings;
	file: BridgeMediaTypeSettings;
	sticker: BridgeMediaTypeSettings;
}

export interface BridgeSettingsTelegramProperties {
	chatId: number;
	sendUsernames: boolean;
	//relayCommands: boolean;
	relayJoinMessages: boolean;
	relayLeaveMessages: boolean;
	crossDeleteOnDiscord: boolean;
	allowedUserIds?: string[];
	blockedUserIds?: string[];
	ignoreBots?: boolean;
	groupMessages?: boolean;
	media?: BridgeMediaSettingsProperties;
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
	public ignoreBots: boolean;
	public groupMessages: boolean;
	public media: BridgeMediaSettings;
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
		this.ignoreBots = settings.ignoreBots ?? true;
		this.groupMessages = settings.groupMessages ?? false;
		this.media = BridgeSettingsTelegram.createMediaSettings(settings.media);
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
		if (settings.groupMessages !== undefined && typeof settings.groupMessages !== "boolean") {
			throw new Error("settings.telegram.groupMessages must be a boolean");
		}
		if (settings.ignoreBots !== undefined && typeof settings.ignoreBots !== "boolean") {
			throw new Error("settings.telegram.ignoreBots must be a boolean");
		}
		const legacySettings = settings as BridgeSettingsTelegramProperties & Record<string, unknown>;
		if ("relayMedia" in legacySettings || "mediaReplacementText" in legacySettings) {
			throw new Error(
				"settings.telegram.relayMedia and mediaReplacementText have been replaced by settings.telegram.media"
			);
		}
		if (settings.media !== undefined) {
			if (typeof settings.media !== "object" || settings.media === null || Array.isArray(settings.media)) {
				throw new Error("settings.telegram.media must be an object");
			}
			const allowedMediaKeys = new Set(["enabled", ...bridgeMediaTypes]);
			const unknownMediaKeys = Object.keys(settings.media).filter(key => !allowedMediaKeys.has(key));
			if (unknownMediaKeys.length > 0) {
				throw new Error(`settings.telegram.media contains unknown keys: ${unknownMediaKeys.join(", ")}`);
			}
			if (settings.media.enabled !== undefined && typeof settings.media.enabled !== "boolean") {
				throw new Error("settings.telegram.media.enabled must be a boolean");
			}
			for (const type of bridgeMediaTypes) {
				const typeSettings = settings.media[type];
				if (typeSettings === undefined) continue;
				if (typeof typeSettings !== "object" || typeSettings === null || Array.isArray(typeSettings)) {
					throw new Error(`settings.telegram.media.${type} must be an object`);
				}
				const unknownTypeKeys = Object.keys(typeSettings).filter(
					key => key !== "enabled" && key !== "replacementText"
				);
				if (unknownTypeKeys.length > 0) {
					throw new Error(
						`settings.telegram.media.${type} contains unknown keys: ${unknownTypeKeys.join(", ")}`
					);
				}
				if (typeSettings.enabled !== undefined && typeof typeSettings.enabled !== "boolean") {
					throw new Error(`settings.telegram.media.${type}.enabled must be a boolean`);
				}
				if (typeSettings.replacementText !== undefined && typeof typeSettings.replacementText !== "string") {
					throw new Error(`settings.telegram.media.${type}.replacementText must be a string`);
				}
			}
		}
		if (settings.messageStyle !== undefined && !["text", "componentsV2"].includes(settings.messageStyle)) {
			throw new Error('settings.telegram.messageStyle must be "text" or "componentsV2"');
		}
	}

	private static createMediaSettings(settings?: BridgeMediaSettingsProperties): BridgeMediaSettings {
		const defaults: Record<BridgeMediaType, string> = {
			photo: "[Photo omitted]",
			video: "[Video omitted]",
			audio: "[Audio omitted]",
			file: "[File omitted]",
			sticker: "[Sticker omitted]"
		};
		const normalized = {} as Pick<BridgeMediaSettings, BridgeMediaType>;
		for (const type of bridgeMediaTypes) {
			normalized[type] = {
				enabled: settings?.[type]?.enabled ?? true,
				replacementText: settings?.[type]?.replacementText ?? defaults[type]
			};
		}
		return { enabled: settings?.enabled ?? true, ...normalized };
	}
}

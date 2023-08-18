interface SettingProperties {
	token: string;
	skipOldMessages: boolean;
	colonAfterSenderName: boolean;
	sendEmojiWithStickers: boolean;
	useFirstNameInsteadOfUsername: boolean;
	useCustomEmojiFilter: boolean;
	replaceAtWithHash: boolean;
	replaceExcessiveSpaces: boolean;
	removeNewlineSpaces: boolean;
	suppressFileTooBigMessages: boolean;
	suppressThisIsPrivateBotMessage: boolean;
}

/******************************
 * The TelegramSettings class *
 ******************************/

/** Settings for the Telegram bot */
export class TelegramSettings {
	private _token: string;
	useFirstNameInsteadOfUsername: boolean;
	colonAfterSenderName: boolean;
	skipOldMessages: boolean;
	sendEmojiWithStickers: boolean;
	useCustomEmojiFilter: boolean;
	replaceAtWithHash: boolean;
	replaceExcessiveSpaces: boolean;
	removeNewlineSpaces: boolean;
	suppressFileTooBigMessages: boolean;
	suppressThisIsPrivateBotMessage: boolean;

	/**
	 * Creates a new TelegramSettings object
	 *
	 * @param settings The raw settings object to use
	 * @param settings.token The bot token to use. Set to {@link TelegramSettings#GET_TOKEN_FROM_ENVIRONMENT} to read the token from the TELEGRAM_BOT_TOKEN environment variable
	 * @param settings.useFirstNameInsteadOfUsername Whether or not to use a Telegram user's first name instead of the username when displaying the name in the Discord messages
	 * @param settings.colonAfterSenderName Whether or not to put a colon after the name of the sender in messages from Discord to Telegram. If true, the name is displayed `Name:`. If false, it is displayed `Name`
	 * @param settings.skipOldMessages Whether or not to skip through all previous messages cached from the telegram-side and start processing new messages ONLY
	 * @param settings.sendEmojiWithStickers Whether or not to send the corresponding emoji when relaying stickers to Discord
	 * @param settings.useCustomEmojiFilter Whether or not to use the custom emoji filter
	 * @param settings.replaceAtWithHash Whether or not to replace @ with #
	 * @param settings.replaceExcessiveSpaces Whether or not to replace excessive spaces
	 * @param settings.removeNewlineSpaces Whether or not to remove newline spaces
	 * @param settings.suppressThisIsPrivateBotMessage Suppress warning in chat when no bridge configured
	 *
	 * @throws If the settings object does not validate
	 */
	constructor(settings: SettingProperties) {
		// Make sure the settings are valid
		TelegramSettings.validate(settings);

		/** The bot token to use, or `env` to indicate the token should be collected from the environment */
		this._token = settings.token;

		/** Whether to use a Telegram user's first name instead of the username when displaying the name in the Discord messages */
		this.useFirstNameInsteadOfUsername = settings.useFirstNameInsteadOfUsername;

		/** Whether to put a colon after the name of the sender in messages from Discord to Telegram. If true, the name is displayed `Name:`. If false, it is displayed `Name` */
		this.colonAfterSenderName = settings.colonAfterSenderName;

		/** Whether to skip through all previous messages cached from the telegram-side and start processing new messages ONLY */
		this.skipOldMessages = settings.skipOldMessages;

		/** Whether to send the corresponding emoji when relaying stickers to Discord */
		this.sendEmojiWithStickers = settings.sendEmojiWithStickers;

		/** Whether to use the custom emoji filter */
		this.useCustomEmojiFilter = settings.useCustomEmojiFilter;

		/** Whether to replace @ with # */
		this.replaceAtWithHash = settings.replaceAtWithHash;

		/** Whether to replace excessive spaces */
		this.replaceExcessiveSpaces = settings.replaceExcessiveSpaces;

		/** Whether to remove newline spaces */
		this.removeNewlineSpaces = settings.removeNewlineSpaces;

		/** Don't send a warning message to telegram if a file is too big to be sent from Telegram to Discord */
		this.suppressFileTooBigMessages = settings.suppressFileTooBigMessages;

		/** Whether to suppress warning in chat when no bridge configured */
		this.suppressThisIsPrivateBotMessage = settings.suppressThisIsPrivateBotMessage;
	}

	/** The bot token to use */
	get token(): string {
		return this._token === TelegramSettings.GET_TOKEN_FROM_ENVIRONMENT
			? (process.env.TELEGRAM_BOT_TOKEN as string)!
			: this._token;
	}

	/** Makes a JSON object of the settings. Called automatically by JSON.stringify */
	toJSON() {
		// Make a clone of the object
		const clone = Object.assign({}, this) as Record<string, any>;

		// Change name of the `_token` property to `token`
		clone.token = clone._token;
		delete clone._token;

		// It's now perfect
		return clone;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a TelegramSettings object
	 *
	 * @param settings The object to validate
	 *
	 * @throws If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings: SettingProperties) {
		// Check that useFirstNameInsteadOfUsername is a boolean
		if (Boolean(settings.useFirstNameInsteadOfUsername) !== settings.useFirstNameInsteadOfUsername) {
			throw new Error("`settings.useFirstNameInsteadOfUsername` must be a boolean");
		}

		// Check that colonAfterSenderName is a boolean
		if (Boolean(settings.colonAfterSenderName) !== settings.colonAfterSenderName) {
			throw new Error("`settings.colonAfterSenderName` must be a boolean");
		}

		// Check that skipOldMessages is a boolean
		if (Boolean(settings.skipOldMessages) !== settings.skipOldMessages) {
			throw new Error("`settings.skipOldMessages` must be a boolean");
		}

		// Check that sendEmojiWithStickers is a boolean
		if (Boolean(settings.sendEmojiWithStickers) !== settings.sendEmojiWithStickers) {
			throw new Error("`settings.sendEmojiWithStickers` must be a boolean");
		}

		// Check that useCustomEmojiFilter is a boolean
		if (Boolean(settings.useCustomEmojiFilter) !== settings.useCustomEmojiFilter) {
			throw new Error("`settings.useCustomEmojiFilter` must be a boolean");
		}

		// Check that replaceAtWithHash is a boolean
		if (Boolean(settings.replaceAtWithHash) !== settings.replaceAtWithHash) {
			throw new Error("`settings.replaceAtWithHash` must be a boolean");
		}

		// Check that replaceExcessiveSpaces is a boolean
		if (Boolean(settings.replaceExcessiveSpaces) !== settings.replaceExcessiveSpaces) {
			throw new Error("`settings.replaceExcessiveSpaces` must be a boolean");
		}

		// Check that removeNewlineSpaces is a boolean
		if (Boolean(settings.removeNewlineSpaces) !== settings.removeNewlineSpaces) {
			throw new Error("`settings.removeNewlineSpaces` must be a boolean");
		}

		// Check that `suppressFileTooBigMessages` is a boolean
		if (Boolean(settings.suppressFileTooBigMessages) !== settings.suppressFileTooBigMessages) {
			throw new Error("`settings.suppressFileTooBigMessages` must be a boolean");
		}

		// Check that suppressThisIsPrivateBotMessage is a boolean
		if (Boolean(settings.suppressThisIsPrivateBotMessage) !== settings.suppressThisIsPrivateBotMessage) {
			throw new Error("`settings.suppressThisIsPrivateBotMessage` must be a boolean");
		}
	}

	/** Constant telling the Telegram token should be gotten from the environment */
	static get GET_TOKEN_FROM_ENVIRONMENT(): "env" {
		return "env";
	}

	/** Default Telegram settings */
	static get DEFAULTS() {
		return {
			token: TelegramSettings.GET_TOKEN_FROM_ENVIRONMENT,
			useFirstNameInsteadOfUsername: false,
			colonAfterSenderName: false,
			skipOldMessages: true,
			sendEmojiWithStickers: true,
			useCustomEmojiFilter: false,
			replaceAtWithHash: false,
			replaceExcessiveSpaces: false,
			removeNewlineSpaces: false,
			suppressFileTooBigMessages: false,
			suppressThisIsPrivateBotMessage: false
		};
	}
}

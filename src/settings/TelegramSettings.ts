interface SettingProperties {
	token: string;
	skipOldMessages: boolean;
	colonAfterSenderName: boolean;
	sendEmojiWithStickers: boolean;
	useFirstNameInsteadOfUsername: boolean;
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

	/**
	 * Creates a new TelegramSettings object
	 *
	 * @param settings The raw settings object to use
	 * @param settings.token The bot token to use. Set to {@link TelegramSettings#GET_TOKEN_FROM_ENVIRONMENT} to read the token from the TELEGRAM_BOT_TOKEN environment variable
	 * @param settings.useFirstNameInsteadOfUsername Whether or not to use a Telegram user's first name instead of the username when displaying the name in the Discord messages
	 * @param settings.colonAfterSenderName Whether or not to put a colon after the name of the sender in messages from Discord to Telegram. If true, the name is displayed `Name:`. If false, it is displayed `Name`
	 * @param settings.skipOldMessages Whether or not to skip through all previous messages cached from the telegram-side and start processing new messages ONLY
	 * @param settings.sendEmojiWithStickers Whether or not to send the corresponding emoji when relaying stickers to Discord
	 *
	 * @throws If the settings object does not validate
	 */
	constructor(settings: SettingProperties) {
		// Make sure the settings are valid
		TelegramSettings.validate(settings);

		/** The bot token to use, or `env` to indicate the token should be collected from the environment */
		this._token = settings.token;

		/** Whether or not to use a Telegram user's first name instead of the username when displaying the name in the Discord messages */
		this.useFirstNameInsteadOfUsername = settings.useFirstNameInsteadOfUsername;

		/** Whether or not to put a colon after the name of the sender in messages from Discord to Telegram. If true, the name is displayed `Name:`. If false, it is displayed `Name` */
		this.colonAfterSenderName = settings.colonAfterSenderName;

		/** Whether or not to skip through all previous messages cached from the telegram-side and start processing new messages ONLY */
		this.skipOldMessages = settings.skipOldMessages;

		/** Whether or not to send the corresponding emoji when relaying stickers to Discord */
		this.sendEmojiWithStickers = settings.sendEmojiWithStickers;
	}

	/** The bot token to use */
	get token(): string {
		return this._token === TelegramSettings.GET_TOKEN_FROM_ENVIRONMENT
			? process.env.TELEGRAM_BOT_TOKEN!
			: this._token;
	}

	/** Makes a JSONifiable object of the settings. Called automatically by JSON.stringify */
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
		// Check that the settings are indeed in object form
		if (!(settings instanceof Object)) {
			throw new Error("`settings` must be an object");
		}

		// Check that the token is a string
		if (typeof settings.token !== "string") {
			throw new Error("`settings.token` must be a string");
		}

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
			sendEmojiWithStickers: true
		};
	}
}

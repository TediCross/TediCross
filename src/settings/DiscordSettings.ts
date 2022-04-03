interface Settings {
	token: string;
	replyLength: number;
	useNickname: boolean;
	maxReplyLines: number;
	skipOldMessages: boolean;
}

/*****************************
 * The DiscordSettings class *
 *****************************/

/** Settings for the Discord bot */
export class DiscordSettings {
	// eslint-disable-next-line
	displayTelegramReplies(_displayTelegramReplies: any) {
		throw new Error("Method not implemented.");
	}
	private _token: string;
	useNickname: boolean;
	replyLength: number;
	maxReplyLines: number;
	skipOldMessages: boolean;

	/**
	 * Creates a new DiscordSettings object
	 *
	 * @param settings The raw settings object to use
	 * @param token The bot token to use. Set to {@link DiscordSettings#GET_TOKEN_FROM_ENVIRONMENT} to read the token from the DISCORD_BOT_TOKEN environment variable
	 * @param skipOldMessages Whether or not to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY
	 *
	 * @throws If the settings object does not validate
	 */
	constructor(settings: Settings) {
		// Make sure the settings are valid
		DiscordSettings.validate(settings);

		/** The bot token to use, or `env` to indicate the token should be collected from the environment */
		this._token = settings.token;

		/** Whether or not to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY */
		this.skipOldMessages = settings.skipOldMessages;

		/** Whether or not to show the Nickname of the user on the server or use his username */
		this.useNickname = settings.useNickname;

		/** How much of the original message to show in replies from Telegram */
		this.replyLength = settings.replyLength;

		/** How many lines of the original message to show in replies from Telegram */
		this.maxReplyLines = settings.maxReplyLines;
	}

	/** The bot token to use */
	get token(): string {
		return this._token === DiscordSettings.GET_TOKEN_FROM_ENVIRONMENT
			? process.env.DISCORD_BOT_TOKEN!
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
	 * Validates a raw settings object, checking if it is usable for creating a DiscordSettings object
	 *
	 * @param settings The object to validate
	 *
	 * @throws If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings: Settings) {
		// Check that the settings are indeed in object form
		if (!(settings instanceof Object)) {
			throw new Error("`settings` must be an object");
		}

		// Check that the token is a string
		if (typeof settings.token !== "string") {
			throw new Error("`settings.token` must be a string");
		}

		// Check that skipOldMessages is a boolean
		if (Boolean(settings.skipOldMessages) !== settings.skipOldMessages) {
			throw new Error("`settings.skipOldMessages` must be a boolean");
		}

		// Check that `useNickname` is a boolean
		if (Boolean(settings.useNickname) !== settings.useNickname) {
			throw new Error("`settings.useNickname` must be a boolean");
		}

		// Check that `replyLength` is an integer
		if (!Number.isInteger(settings.replyLength) || settings.replyLength <= 0) {
			throw new Error("`settings.replyLength` must be an integer greater than 0");
		}

		// Check that `maxReplyLines` is an integer
		if (!Number.isInteger(settings.maxReplyLines) || settings.maxReplyLines <= 0) {
			throw new Error("`settings.maxReplyLines` must be an integer greater than 0");
		}
	}

	/** Constant telling the Discord token should be gotten from the environment */
	static get GET_TOKEN_FROM_ENVIRONMENT(): "env" {
		return "env";
	}

	/** Default Discord settings */
	static get DEFAULTS() {
		return {
			token: DiscordSettings.GET_TOKEN_FROM_ENVIRONMENT,
			skipOldMessages: true,
			useNickname: false
		};
	}
}

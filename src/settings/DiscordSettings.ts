interface Settings {
	token: string;
	replyLength: number;
	useNickname: boolean;
	maxReplyLines: number;
	skipOldMessages: boolean;
	suppressThisIsPrivateBotMessage: boolean;
	enableCustomStatus: boolean;
	customStatusMessage: string;
	useEmbeds: string;
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
	suppressThisIsPrivateBotMessage: boolean;
	enableCustomStatus: boolean;
	customStatusMessage: string;
	useEmbeds: string;

	/**
	 * Creates a new DiscordSettings object
	 *
	 * @param settings The raw settings object to use
	 *
	 * @throws If the settings object does not validate
	 */
	constructor(settings: Settings) {
		// Make sure the settings are valid
		DiscordSettings.validate(settings);

		/** The bot token to use, or `env` to indicate the token should be collected from the environment */
		this._token = settings.token;

		/** Whether to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY */
		this.skipOldMessages = settings.skipOldMessages;

		/** Whether to show the Nickname of the user on the server or use his username */
		this.useNickname = settings.useNickname;

		/** How much of the original message to show in replies from Telegram */
		this.replyLength = settings.replyLength;

		/** How many lines of the original message to show in replies from Telegram */
		this.maxReplyLines = settings.maxReplyLines;

		/** Whether to suppress warning in channel when no bridge configured */
		this.suppressThisIsPrivateBotMessage = settings.suppressThisIsPrivateBotMessage;

		/** Whether to enable the playing status */
		this.enableCustomStatus = settings.enableCustomStatus;

		/** The playing status message */
		this.customStatusMessage = settings.customStatusMessage;

		/** Whether to use embeds */
		this.useEmbeds = settings.useEmbeds;
	}

	/** The bot token to use */
	get token(): string {
		return this._token === DiscordSettings.GET_TOKEN_FROM_ENVIRONMENT
			? (process.env.DISCORD_BOT_TOKEN as string)!
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
	 * Validates a raw settings object, checking if it is usable for creating a DiscordSettings object
	 *
	 * @param settings The object to validate
	 *
	 * @throws If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings: Settings) {
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

		// Check that `suppressThisIsPrivateBotMessage` is a boolean
		if (Boolean(settings.suppressThisIsPrivateBotMessage) !== settings.suppressThisIsPrivateBotMessage) {
			throw new Error("`settings.suppressThisIsPrivateBotMessage` must be a boolean");
		}

		// Check that `enableCustomStatus` is a boolean
		if (Boolean(settings.enableCustomStatus) !== settings.enableCustomStatus) {
			throw new Error("`settings.enableCustomStatus` must be a boolean");
		}

		// Check that the customStatusMessage is a string
		if (typeof settings.customStatusMessage !== "string") {
			throw new Error("`settings.customStatusMessage` must be a string");
		}

		// Check that the useEmbeds is a string
		if (typeof settings.useEmbeds !== "string") {
			throw new Error("`settings.useEmbeds` must be a string");
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
			useNickname: false,
			suppressThisIsPrivateBotMessage: false,
			enableCustomStatus: false,
			customStatusMessage: "TediCross",
			useEmbeds: "auto"
		};
	}
}

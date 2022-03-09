"use strict";

/**************************
 * Import important stuff *
 **************************/

// Nothing

/*****************************
 * The DiscordSettings class *
 *****************************/

/**
 * Settings for the Discord bot
 */
class DiscordSettings {
	/**
	 * Creates a new DiscordSettings object
	 *
	 * @param {Object} settings	The raw settings object to use
	 * @param {String} token	The bot token to use. Set to {@link DiscordSettings#GET_TOKEN_FROM_ENVIRONMENT} to read the token from the DISCORD_BOT_TOKEN environment variable
	 * @param {Boolean} whitelistedSender	Whether or not to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY
	 * @param {Boolean} skipOldMessages	The sender whose messages will be relayed. Leave empty to relay all messages
	 *
	 * @throws {Error}	If the settings object does not validate
	 */
	constructor(settings) {
		// Make sure the settings are valid
		DiscordSettings.validate(settings);

		/**
		 * The bot token to use, or `env` to indicate the token should be collected from the environment
		 *
		 * @type {String}
		 *
		 * @private
		 */
		this._token = settings.token;

		/**
		 * The sender whose messages will be relayed. Leave empty to relay all messages
		 *
		 * @type {String}
		 *
		 * @private
		 */
		 this.whitelistedSender = settings.whitelistedSender;

		/**
		 * Whether or not to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY
		 *
		 * @type {Boolean}
		 */
		this.skipOldMessages = settings.skipOldMessages;

		/**
		 * Whether or not to show the Nickname of the user on the server or use his username
		 *
		 * @type {Boolean}
		 */
		this.useNickname = settings.useNickname;

		/**
		 * How much of the original message to show in replies from Telegram
		 *
		 * @type {Integer}
		 */
		this.replyLength = settings.replyLength;

		/**
		 * How many lines of the original message to show in replies from Telegram
		 *
		 * @type {Integer}
		 */
		this.maxReplyLines = settings.maxReplyLines;
	}

	/**
	 * The bot token to use
	 *
	 * @type {String}
	 *
	 * @readonly
	 */
	get token() {
		return this._token === DiscordSettings.GET_TOKEN_FROM_ENVIRONMENT
			? process.env.DISCORD_BOT_TOKEN
			: this._token
		;
	}

	/**
	 * Makes a JSONifiable object of the settings. Called automatically by JSON.stringify
	 *
	 * @returns {Object}
	 */
	toJSON() {
		// Make a clone of the object
		const clone = Object.assign({}, this);

		// Change name of the `_token` property to `token`
		clone.token = clone._token;
		delete clone._token;

		// It's now perfect
		return clone;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a DiscordSettings object
	 *
	 * @param {Object} settings	The object to validate
	 *
	 * @throws {Error}	If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings) {
		// Check that the settings are indeed in object form
		if (!(settings instanceof Object)) {
			throw new Error("`settings` must be an object");
		}

		// Check that the token is a string
		if (typeof settings.token !== "string") {
			throw new Error("`settings.token` must be a string");
		}

		// Check that the whitelistedSender is a string
		if (typeof settings.whitelistedSender !== "string") {
			throw new Error("`settings.whitelistedSender` must be a string");
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
			throw new ("`settings.replyLength` must be an integer greater than 0");
		}

		// Check that `maxReplyLines` is an integer
		if (!Number.isInteger(settings.maxReplyLines) || settings.maxReplyLines <= 0) {
			throw new ("`settings.maxReplyLines` must be an integer greater than 0");
		}
	}

	/**
	 * Constant telling the Discord token should be gotten from the environment
	 *
	 * @type {String}
	 */
	static get GET_TOKEN_FROM_ENVIRONMENT() {
		return "env";
	}

	/**
	 * Default Discord settings
	 *
	 * @type {Object}
	 */
	static get DEFAULTS() {
		return {
			token: DiscordSettings.GET_TOKEN_FROM_ENVIRONMENT,
			whitelistedSender: '',
			skipOldMessages: true,
			useNickname: false
		};
	}
}

/*************
 * Export it *
 *************/

module.exports = DiscordSettings;

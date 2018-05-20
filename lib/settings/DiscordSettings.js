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
	 * @param {Boolean} skipOldMessages	Whether or not to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY
	 *
	 * @throws {Error}	If the settings object does not validate
	 */
	constructor(settings) {
		// Make sure the settings are valid
		DiscordSettings.validate(settings);

		/**
		 * The bot token to use, or `env` to indicate the token should be collected from the environment
		 *
		 * @type String
		 *
		 * @private
		 */
		this._token = settings.token;

		/**
		 * Whether or not to skip through all previous messages sent on Discord since last bot shutdown and start processing new messages ONLY
		 *
		 * @type Boolean
		 */
		this.skipOldMessages = settings.skipOldMessages;
	}

	/**
	 * The bot token to use
	 *
	 * @type String
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

		// Check that skipOldMessages is a boolean
		if (Boolean(settings.skipOldMessages) !== settings.skipOldMessages) {
			throw new Error("`settings.skipOldMessages` must be a boolean");
		}
	}

	/**
	 * Constant telling the Discord token should be gotten from the environment
	 *
	 * @type String
	 */
	static get GET_TOKEN_FROM_ENVIRONMENT() {
		return "env";
	}

	/**
	 * Default Discord settings
	 *
	 * @type Object
	 */
	static get DEFAULTS() {
		return {
			token: DiscordSettings.GET_TOKEN_FROM_ENVIRONMENT,
			skipOldMessages: true
		};
	}
}

/*************
 * Export it *
 *************/

module.exports = DiscordSettings;

import fs from "fs";
import R from "ramda";
import { Bridge, BridgeProperties } from "../bridgestuff/Bridge";
import { TelegramSettings } from "./TelegramSettings";
import { DiscordSettings } from "./DiscordSettings";
import jsYaml from "js-yaml";
import moment from "moment";
import EventEmitter from "events";
import { BridgeMap } from "../bridgestuff/BridgeMap";

interface SettingProperties {
	telegram: TelegramSettings;
	discord: DiscordSettings;
	debug: boolean;
	messageTimeoutAmount: number;
	messageTimeoutUnit: moment.unitOfTime.DurationConstructor;
	persistentMessageMap: boolean;
	bridges: Bridge[];
	token: string;
}

/**********************
 * The Settings class *
 **********************/

/**
 * Settings class for TediCross
 */
export class Settings extends EventEmitter {
	debug: boolean;
	messageTimeoutAmount: number;
	messageTimeoutUnit: moment.unitOfTime.DurationConstructor;
	persistentMessageMap: boolean;
	discord: DiscordSettings;
	telegram: TelegramSettings;
	bridges: Bridge[];
	settingsPath?: string;

	/**
	 * Creates a new settings object
	 *
	 * @param settings The raw settings object to use
	 * @param settings.telegram Settings for the Telegram bot. See the constructor of {@link TelegramSettings}
	 * @param settings.discord Settings for the Discord bot. See the constructor of {@link DiscordSettings}
	 * @param settings.bridges Settings for the bridges. See the constructor of {@link Bridge}
	 * @param settings.debug Whether or not to print debug messages
	 * @param settings.messageTimeoutAmount Amount for your unit of time to expire messages in MessageMap
	 * @param settings.messageTimeoutUnit Format of time as a string (ie: 'hours', 'days', 'weeks', etc)
	 * @param settings.persistentMessageMap Allow MessageMap to persist between reboots by saving it to a file
	 *
	 * @throws If the raw settings object does not validate
	 */
	constructor(settings: SettingProperties) {
		super();
		// Make sure the settings are valid
		Settings.validate(settings);

		/** The settings for the Telegram bot */
		this.telegram = new TelegramSettings(settings.telegram);

		/** The settings for the Discord bot */
		this.discord = new DiscordSettings(settings.discord);

		/** Whether or not to print debug messages */
		this.debug = settings.debug;

		/** Amount for your unit of time to expire messages in MessageMap */
		this.messageTimeoutAmount = settings.messageTimeoutAmount;

		/** Format of time as a string (ie: 'hours', 'days', 'weeks', etc) */
		this.messageTimeoutUnit = settings.messageTimeoutUnit;

		/** Allow MessageMap to persist between reboots by saving it to a file */
		this.persistentMessageMap = settings.persistentMessageMap;

		/** The config for the bridges */
		this.bridges = settings.bridges;

		this.settingsPath = "./";
	}

	updateBridge(bridge: Bridge) {
		// console.dir(bridge);
		this.bridges.forEach(oldBridge => {
			if (
				oldBridge.telegram.chatId === bridge.telegram.chatId &&
				oldBridge.discord.channelId === bridge.discord.channelId
			) {
				oldBridge.topicBridges = bridge.topicBridges;
			}
		});
		this.toFile(this.settingsPath as string);
		const bridgeMap = this.getBridgeMap();
		this.emit("bridgeUpdate", bridgeMap);
	}

	getBridgeMap(): BridgeMap {
		return new BridgeMap(this.bridges.map((bridgeSettings: BridgeProperties) => new Bridge(bridgeSettings)));
	}

	setPath(path: string) {
		this.settingsPath = path;
	}

	/**
	 * Saves the settings to file
	 *
	 * @param filepath Filepath to save to. Absolute path is recommended
	 * @param saveObject External settings
	 */
	toFile(filepath: string, saveObject?: any) {
		const objectToSave = saveObject || JSON.parse(JSON.stringify(this));

		// don't export path
		delete objectToSave.settingsPath;

		// Convert the object to quite human-readable YAML and write it to the file
		const yaml = jsYaml.dump(objectToSave);
		const notepadFriendlyYaml = yaml.replace(/\n/g, "\r\n");

		let error: any;
		try {
			// The raw object is not suitable for YAML-ification. A few `toJSON()` methods will not be triggered that way. Go via JSON
			fs.writeFileSync(filepath, notepadFriendlyYaml);
		} catch (err: any) {
			error = err;
			console.error(`Error occurred while writing settings to file: ${err}`);
		}

		return { yaml: notepadFriendlyYaml, error };
	}

	/**
	 * Makes a raw settings object from this object
	 *
	 * @returns A plain object with the settings
	 */
	toObj(): object {
		// Hacky way to turn this into a plain object...
		const obj = JSON.parse(JSON.stringify(this));
		delete obj.settingsPath;
		return obj;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a Settings object
	 *
	 * @param settings The object to validate
	 *
	 * @throws If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings: SettingProperties) {
		// An Array of valid units of time
		const validUnitsOfTime = [
			"year",
			"years",
			"y",
			"month",
			"months",
			"M",
			"week",
			"weeks",
			"w",
			"day",
			"days",
			"d",
			"hour",
			"hours",
			"h",
			"minute",
			"minutes",
			"m",
			"second",
			"seconds",
			"s",
			"millisecond",
			"milliseconds",
			"ms"
		];

		// Check that debug is a boolean
		if (Boolean(settings.debug) !== settings.debug) {
			throw new Error("`settings.debug` must be a boolean");
		}

		// Check that messageTimeoutAmount is a number
		if (isNaN(settings.messageTimeoutAmount)) {
			throw new Error("`settings.messageTimeoutAmount` must be a number");
		}

		// Check that messageTimeoutUnit is also a valid unit of time
		if (!validUnitsOfTime.includes(settings.messageTimeoutUnit)) {
			throw new Error("`settings.messageTimeoutUnit` is not a valid unit of time");
		}

		// Check that persistentMessageMap is a boolean
		if (Boolean(settings.persistentMessageMap) !== settings.persistentMessageMap) {
			throw new Error("`settings.persistentMessageMap` must be a boolean");
		}

		// Check that the bridges are valid
		settings.bridges.forEach(Bridge.validate);

		// Check that all the bridges have unique names
		settings.bridges.forEach(function (value: Bridge, index: number, array: Bridge[]) {
			for (let i = 0; i < array.length; i++) {
				if (value.name === array[i].name && i !== index) {
					throw new Error("`settings.bridges` must have unique names for each bridge");
				}
			}
		});
	}

	/**
	 * Merges a raw settings object with default values
	 *
	 * @param rawSettings The raw settings object to merge
	 *
	 * @returns A clone of the provided object, with default values on it
	 */
	static applyDefaults(rawSettings: SettingProperties) {
		return R.mergeDeepLeft(rawSettings, Settings.DEFAULTS);
	}

	/**
	 * Migrates settings to the newest format
	 *
	 * @param rawSettings The raw settings object to migrate
	 *
	 * @returns A new object on the newest format
	 */
	static migrate(rawSettings: SettingProperties): object {
		// Make a clone, to not operate directly on the provided object
		const settings = R.clone(rawSettings);

		// 2019-11-08: Turn `ignoreCommands` into `relayCommands`, as `ignoreCommands` accidently did the opposite of what it was supposed to do
		/*for (const bridge of settings.bridges) {
			if (R.isNil(bridge.telegram.relayCommands)) {
				bridge.telegram.relayCommands = bridge.telegram.ignoreCommands!;
			}
			delete bridge.telegram.ignoreCommands;
		}*/

		// 2019-11-08: Remove the `serverId` setting from the discord part of the bridges
		for (const bridge of settings.bridges) {
			delete bridge.discord.serverId;
			if (bridge.threadMap) {
				bridge.topicBridges = bridge.threadMap;
				delete bridge.threadMap;
			}
		}

		// 2020-02-09: Removed the `displayTelegramReplies` option from Discord
		if (!settings.discord.displayTelegramReplies) {
			//@ts-ignore
			delete settings.discord.displayTelegramReplies;
		}

		// 2020-06-30: Added `bridge.telegram.crossDeleteOnDiscord` option
		for (const bridge of settings.bridges) {
			if (R.isNil(bridge.telegram.crossDeleteOnDiscord)) {
				bridge.telegram.crossDeleteOnDiscord = true;
			}
		}

		// All done!
		return settings;
	}

	/**
	 * Creates a new settings object from a plain object
	 *
	 * @param obj The object to create a settings object from
	 *
	 * @returns The settings object
	 */
	static fromObj(obj: any): Settings {
		return R.compose<any, any>(
			R.construct(Settings),
			//@ts-ignore
			Settings.migrate,
			Settings.applyDefaults
		)(obj) as any as Settings;
	}

	/** Default settings */
	static get DEFAULTS() {
		return {
			telegram: TelegramSettings.DEFAULTS,
			discord: DiscordSettings.DEFAULTS,
			bridges: [],
			messageTimeoutAmount: 24,
			messageTimeoutUnit: "hours",
			persistentMessageMap: false,
			debug: false
		} as any;
	}
}

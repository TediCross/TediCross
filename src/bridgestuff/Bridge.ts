import { BridgeSettingsTelegram } from "./BridgeSettingsTelegram";
import { BridgeSettingsDiscord } from "./BridgeSettingsDiscord";
import { BridgeSettingsTelegramProperties } from "./BridgeSettingsTelegram";
import { BridgeSettingsDiscordProperties } from "./BridgeSettingsDiscord";

export interface BridgeProperties {
	name: string;
	telegram: BridgeSettingsTelegramProperties;
	discord: BridgeSettingsDiscordProperties;
	direction: "both" | "d2t" | "t2d";
	threadMap: any[] | undefined;
	tgThread: number | undefined;
}

/********************
 * The Bridge class *
 ********************/

/** A bridge between Discord and Telegram */
export class Bridge {
	public name: string;
	public direction: BridgeProperties["direction"];
	public telegram: BridgeSettingsTelegramProperties;
	public discord: BridgeSettingsDiscordProperties;
	public threadMap: any[] | undefined;
	public tgThread: number | undefined;
	/**
	 * Creates a new bridge
	 *
	 * @param settings Settings for the bridge
	 * @param settings.name Name of the bridge
	 * @param settings.telegram Settings for the Telegram side of the bridge. See the constructor for {@link BridgeSettingsTelegram}
	 * @param settings.discord Settings for the Discord side of the bridge. See the constructor for {@link BridgeSettingsDiscord}
	 *
	 * @throws If the settings object does not validate
	 */
	constructor(settings: BridgeProperties) {
		// Check that the settings object is valid
		Bridge.validate(settings);

		/** Name of the bridge */
		this.name = settings.name;

		/** Direction of the bridge */
		this.direction = settings.direction;

		/** Settings for the Telegram side of the bridge */
		this.telegram = new BridgeSettingsTelegram(settings.telegram);

		/** Settings for the Discord side of the bridge */
		this.discord = new BridgeSettingsDiscord(settings.discord);

		/** Settings for the Threads mapping */
		this.threadMap = settings.threadMap;
	}

	/**
	 * Validates a raw settings object, checking if it is usable for creating a Bridge object
	 *
	 * @param settings The object to validate
	 *
	 * @throws If the object is not suitable. The error message says what the problem is
	 */
	static validate(settings: BridgeProperties) {
		// Check the direction
		if (
			![
				Bridge.DIRECTION_BOTH,
				Bridge.DIRECTION_DISCORD_TO_TELEGRAM,
				Bridge.DIRECTION_TELEGRAM_TO_DISCORD
			].includes(settings.direction)
		) {
			throw new Error("`settings.direction` is not a valid bridge direction");
		}

		// Check the Telegram settings
		BridgeSettingsTelegram.validate(settings.telegram);

		// Check the Discord settings
		BridgeSettingsDiscord.validate(settings.discord);
	}

	/** Constant for a bidirectional bridge */
	static get DIRECTION_BOTH(): "both" {
		return "both";
	}

	/** Constant for a bridge going from Discord to Telegram */
	static get DIRECTION_DISCORD_TO_TELEGRAM(): "d2t" {
		return "d2t";
	}

	/** Constant for a bridge going from Telegram to Discord */
	static get DIRECTION_TELEGRAM_TO_DISCORD(): "t2d" {
		return "t2d";
	}
}

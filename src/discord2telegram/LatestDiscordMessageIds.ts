import fs from "fs";
import { Bridge } from "../bridgestuff/Bridge";
import { Logger } from "../Logger";
const promisify = require("util").promisify;

/*************************************
 * The LatestDiscordMessageIds class *
 *************************************/

/**
 * Persistently keeps track of the ID of the latest Discord message per bridge
 */
export class LatestDiscordMessageIds {
	private _logger: Logger;
	private _filepath: string;
	private _map: Record<string, any>;
	private _finishedWriting: Promise<void>;

	/**
	 * Creates a new instance which keeps track of messages and bridges
	 *
	 * @param logger	The Logger instance to log messages to
	 * @param filepath	Path to the file to persistently store the map in
	 */
	constructor(logger: Logger, filepath: string) {
		/** The Logger instance to log messages to */
		this._logger = logger;

		/** The path of the file this map is connected to */
		this._filepath = filepath;

		/** The actual map */
		this._map = {};

		try {
			// Check if the file exists. This throws if it doesn't
			fs.accessSync(this._filepath, fs.constants.F_OK);
		} catch (e) {
			// Nope, it doesn't. Create it
			fs.writeFileSync(this._filepath, JSON.stringify({}));
		}

		// Read the file
		let data = null;
		try {
			//TODO added encoding. Check if it still works
			data = fs.readFileSync(this._filepath, "utf8");
		} catch (err) {
			// Well, the file has been confirmed to exist, so there must be no read access
			this._logger.error(`Cannot read the file ${this._filepath}:`, err);
			data = JSON.stringify({});
		}

		try {
			// Read the contents as JSON
			this._map = JSON.parse(data);
		} catch (err) {
			// Invalid JSON
			this._logger.error(`Could not read or parse the file ${this._filepath}:`, err);
			this._map = {};
		}

		/** Promise which resolves when writing has finished. Meant to be chained with every write operation */
		this._finishedWriting = Promise.resolve();

		// Bind methods to avoid problems with `this`
		this.setLatest = this.setLatest.bind(this);
		this.getLatest = this.getLatest.bind(this);
	}

	/**
	 * Tells the map the latest message for a bridge
	 *
	 * @param message The latest message from Discord on the bridge
	 * @param bridge The bridge
	 */
	setLatest(messageId: string, bridge: Bridge) {
		// Update the bridge map
		this._map[bridge.name] = messageId;

		// Write it to file when previous writes have completed
		this._finishedWriting = this._finishedWriting
			.then(() => promisify(fs.writeFile)(this._filepath, JSON.stringify(this._map, null, "\t")))
			.catch(err => this._logger.error("Writing last Discord message ID to file failed!", err));
	}

	/**
	 * Gets the latest message ID for a bridge, or `null` if none was found
	 *
	 * @param bridge The bridge to get the message ID from
	 *
	 * @returns ID of the latest Discord message that passed over the bridge
	 */
	getLatest(bridge: Bridge) {
		return this._map[bridge.name] === undefined ? null : this._map[bridge.name];
	}
}

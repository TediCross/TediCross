import fs from "fs";
import { Logger } from "./Logger";
const promisify = require("util").promisify;

/*************************************
 * The PersistentMessageMap class *
 *************************************/

/**
 * Allows TediCross to persist the MessageMap across restarts.
 */
export class PersistentMessageMap {
	private _logger: Logger;
	private _filepath: string;
	private _map: Map<string, any>;
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
		this._map = new Map();

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
			this._map = new Map(JSON.parse(data, reviver));
		} catch (err) {
			// Invalid JSON
			this._logger.error(`Could not read or parse the file ${this._filepath}:`, err);
			this._map = new Map();
		}

		/** Promise which resolves when writing has finished. Meant to be chained with every write operation */
		this._finishedWriting = Promise.resolve();

		// Bind methods to avoid problems with `this`
		this.updateMap = this.updateMap.bind(this);
		this.getMap = this.getMap.bind(this);
	}

	/**
	 * Update the Persistent MessageMap with the current MessageMap
	 *
	 * @param map The current map from MessageMap
	 */
	updateMap(map: Map<string, any>) {
		// Update the bridge map
		this._map = map;

		// Write it to file when previous writes have completed
		this._finishedWriting = this._finishedWriting
			.then(() => promisify(fs.writeFile)(this._filepath, JSON.stringify(this._map, replacer, "\t")))
			.catch(err => this._logger.error("Writing last Discord message ID to file failed!", err));
	}

	/**
	 * Get the current Persistent MessageMap
	 *
	 * @returns Map of the current Persistent MessageMap
	 */
	getMap() {
		return this._map;
	}
}

// Replacer function to stringify MessageMap
function replacer(key: string, value: any) {
	if (value instanceof Map) {
		return {
			dataType: 'Map',
			value: Array.from(value.entries()), // or with spread: value: [...value]
		};
	} else if (value instanceof Set) {
		return {
			dataType: 'Set',
			value: Array.from(value.values()), // or with spread: value: [...value]
		};
	} else {
		return value;
	}
}

// Reviver function to parse MessageMap
function reviver(key: string, value: any) {
	if (typeof value === 'object' && value !== null) {
		if (value.dataType === 'Map') {
			return new Map(value.value);
		} else if (value.dataType === 'Set') {
			return new Set(value.value);
		}
	}
	return value;
}
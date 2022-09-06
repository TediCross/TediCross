import fs from "fs";
import { Logger } from "./Logger";
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Bridge } from "./bridgestuff/Bridge";
import { forEach } from "ramda";
type Direction = "d2t" | "t2d";

/*************************************
 * The PersistentMessageMap class *
 *************************************/

/**
 * Allows TediCross to persist the MessageMap across restarts.
 */
export class PersistentMessageMap {
	private _logger: Logger;
	private _filepath: string;
	private _db: Promise<Database<sqlite3.Database, sqlite3.Statement>>;

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

		try {
			// Check if the file exists. This throws if it doesn't
			fs.accessSync(this._filepath, fs.constants.F_OK);
		} catch (e) {
			// Nope, it doesn't. Create it
			open({
				filename: this._filepath,
				driver: sqlite3.cached.Database
			}).then(async (db) => {
				await db.exec('CREATE TABLE Bridges (BridgeName TEXT PRIMARY KEY)');
				await db.exec('CREATE TABLE KeysToIds ("Key" TEXT PRIMARY KEY, BridgeName REFERENCES Bridges (BridgeName))');
				await db.exec('CREATE TABLE ToIds (Ids TEXT PRIMARY KEY, "Key" TEXT REFERENCES KeysToIds ("Key"))');
				await db.close();
			}).catch(err => this._logger.error("Error Creating Database", err));
		}

		this._db = open({
			filename: this._filepath,
			driver: sqlite3.cached.Database
		});
	}

	insert(direction: Direction, bridge: Bridge, fromId: string, toId: string) {
		this._db.then(async (db) => {
			const bridgeCheck = await db.get("SELECT BridgeName FROM Bridges WHERE BridgeName = :sqlBridgeName",
				{
					':sqlBridgeName': bridge.name
				});
			if (bridgeCheck === undefined) {
				await db.run("INSERT INTO Bridges (BridgeName) VALUES (:sqlBridgeName)",
					{
						':sqlBridgeName': bridge.name
					});
			}
			await db.run("INSERT INTO KeysToIds ([Key],BridgeName) VALUES (:sqlKey,:sqlBridgeName)",
				{
					':sqlKey': `${direction} ${fromId}`,
					':sqlBridgeName': bridge.name
				});
			await db.run("INSERT INTO ToIds (Ids,[Key]) VALUES (:sqlIds,:sqlKey)",
				{
					':sqlIds': toId,
					':sqlKey': `${direction} ${fromId}`
				});
		}).catch(err => this._logger.error("Error Inserting into Database", err));
	}

	async getCorresponding(direction: Direction, bridge: Bridge, fromId: string) {
		let toId: string[] = [];
		const results = await this._db.then(async (db) => {

			const result = await db.all('SELECT Ids FROM ToIds WHERE [Key] = (SELECT [Key] FROM KeysToIds WHERE [Key] = :sqlKey AND BridgeName = :sqlBridgeName)',
				{
					':sqlKey': `${direction} ${fromId}`,
					':sqlBridgeName': bridge.name
				});
			return result;
		}).catch(err => this._logger.error("Error getting Corresponding from Database", err));
		if (results !== undefined) {
			results.forEach((id) => { toId.push(id.Ids); });
		}
		// this._logger.log("getCorresponding for: " + bridge.name + " " + direction + " " + fromId);
		// this._logger.log(results);
		// this._logger.log(toId);
		return toId;
	}

	async getCorrespondingReverse(bridge: Bridge, toId: string) {
		let fromId = "";
		const results = await this._db.then(async (db) => {
			const result = await db.get('SELECT [Key] FROM KeysToIds WHERE BridgeName = :sqlBridgeName AND [Key] = (SELECT [Key] FROM ToIds WHERE Ids = :sqlIds)',
				{
					':sqlBridgeName': bridge.name,
					':sqlIds': toId
				});
			return result;
		}).catch(err => this._logger.error("Error getting Corresponding Reverse from Database", err));
		if (results !== undefined) {
			fromId = results.Key;
		}
		// this._logger.log("getCorrespondingReverse for: " + bridge.name + " " + toId);
		// this._logger.log(results);
		// this._logger.log(fromId);
		return fromId;
	}
}
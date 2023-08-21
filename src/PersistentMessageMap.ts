import fs from "fs";
import { Logger } from "./Logger";
import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { Bridge } from "./bridgestuff/Bridge";
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

		let dbExists = true;

		try {
			// Check if the file exists. This throws if it doesn't
			fs.accessSync(this._filepath, fs.constants.F_OK);
		} catch (e) {
			// Nope, it doesn't. Create it
			dbExists = false;
		}

		this._db = open({
			filename: this._filepath,
			driver: sqlite3.cached.Database
		});

		if (!dbExists) {
			this._db
				.then(async db => {
					await db.exec("CREATE TABLE Bridges (pk INTEGER PRIMARY KEY AUTOINCREMENT, BridgeName TEXT)");
					await db.exec(
						"CREATE TABLE KeysToIds (pk INTEGER PRIMARY KEY AUTOINCREMENT, [Bridges.pk] INTEGER REFERENCES Bridges (pk), Keys TEXT)"
					);
					await db.exec(
						"CREATE TABLE ToIds (pk INTEGER PRIMARY KEY AUTOINCREMENT, [KeysToIds.pk] INTEGER REFERENCES KeysToIds (pk), Ids TEXT)"
					);
				})
				.catch(err => this._logger.error("Error Creating Database", err));
		}
	}

	insert(direction: Direction, bridge: Bridge, fromId: string, toId: string) {
		this._db
			.then(async db => {
				const bridgeCheck = await db.get("SELECT BridgeName FROM Bridges WHERE BridgeName = :sqlBridgeName", {
					":sqlBridgeName": bridge.name
				});
				if (bridgeCheck === undefined) {
					await db.run("INSERT INTO Bridges (BridgeName) VALUES (:sqlBridgeName)", {
						":sqlBridgeName": bridge.name
					});
				}
				await db.run(
					"INSERT INTO KeysToIds ([Bridges.pk], Keys) VALUES ((SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName), :sqlKey)",
					{
						":sqlKey": `${direction} ${fromId}`,
						":sqlBridgeName": bridge.name
					}
				);
				await db.run(
					"INSERT INTO ToIds ([KeysToIds.pk],Ids) VALUES ((SELECT pk FROM KeysToIds WHERE Keys = :sqlKey and [Bridges.pk] = (SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName)),:sqlIds)",
					{
						":sqlIds": toId,
						":sqlBridgeName": bridge.name,
						":sqlKey": `${direction} ${fromId}`
					}
				);
			})
			.catch(err => this._logger.error("Error Inserting into Database", err));
	}

	async getCorresponding(direction: Direction, bridge: Bridge, fromId: string) {
		const toId: string[] = [];
		const results = await this._db
			.then(async db => {
				const result = await db.all(
					"SELECT Ids FROM ToIds WHERE [KeysToIds.pk] = (SELECT pk FROM KeysToIds WHERE Keys = :sqlKey and [Bridges.pk] = (SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName))",
					{
						":sqlKey": `${direction} ${fromId}`,
						":sqlBridgeName": bridge.name
					}
				);
				return result;
			})
			.catch(err => this._logger.error("Error getting Corresponding from Database", err));
		if (results !== undefined) {
			results.forEach(id => {
				toId.push(id.Ids);
			});
		}
		//this._logger.log("getCorresponding for: " + bridge.name + " " + direction + " " + fromId);
		//this._logger.log(results);
		//this._logger.log(toId);
		return toId;
	}

	async getCorrespondingReverse(bridge: Bridge, toId: string) {
		let fromId = "";
		const results = await this._db
			.then(async db => {
				const result = await db.get(
					"SELECT Keys FROM KeysToIds WHERE [Bridges.pk] = (SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName) AND pk = (SELECT [KeysToIds.pk] FROM ToIds WHERE Ids = :sqlIds)",
					{
						":sqlBridgeName": bridge.name,
						":sqlIds": toId
					}
				);
				return result;
			})
			.catch(err => this._logger.error("Error getting Corresponding Reverse from Database", err));
		if (results !== undefined) {
			fromId = results.Keys;
		}
		//this._logger.log("getCorrespondingReverse for: " + bridge.name + " " + toId);
		//this._logger.log(results);
		//this._logger.log(fromId);
		return fromId;
	}
}

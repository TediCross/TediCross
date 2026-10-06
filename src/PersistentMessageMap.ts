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
	private _dbOperationQueue: Promise<void> = Promise.resolve();

	private enqueueDbOperation<T>(operation: () => Promise<T>): Promise<T> {
		const result = this._dbOperationQueue.then(operation);
		this._dbOperationQueue = result.then(
			() => undefined,
			() => undefined
		);
		return result;
	}

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
		}).then(async db => {
			if (!dbExists) {
				await db.exec("CREATE TABLE Bridges (pk INTEGER PRIMARY KEY AUTOINCREMENT, BridgeName TEXT)");
				await db.exec(
					"CREATE TABLE KeysToIds (pk INTEGER PRIMARY KEY AUTOINCREMENT, [Bridges.pk] INTEGER REFERENCES Bridges (pk), Keys TEXT)"
				);
				await db.exec(
					"CREATE TABLE ToIds (pk INTEGER PRIMARY KEY AUTOINCREMENT, [KeysToIds.pk] INTEGER REFERENCES KeysToIds (pk), Ids TEXT)"
				);
			}
			return db;
		});
	}

	insert(direction: Direction, bridge: Bridge, fromId: string, toId: string) {
		this.enqueueDbOperation(async () => {
			const db = await this._db;
			let bridgeRow = await db.get("SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName", {
				":sqlBridgeName": bridge.name
			});
			if (bridgeRow === undefined) {
				await db.run("INSERT INTO Bridges (BridgeName) VALUES (:sqlBridgeName)", {
					":sqlBridgeName": bridge.name
				});
				bridgeRow = await db.get("SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName", {
					":sqlBridgeName": bridge.name
				});
			}
			const key = `${direction} ${fromId}`;
			let keyRow = await db.get(
				"SELECT pk FROM KeysToIds WHERE [Bridges.pk] = :bridge AND Keys = :key ORDER BY pk LIMIT 1",
				{ ":bridge": bridgeRow.pk, ":key": key }
			);
			if (keyRow === undefined) {
				const inserted = await db.run("INSERT INTO KeysToIds ([Bridges.pk], Keys) VALUES (:bridge, :key)", {
					":bridge": bridgeRow.pk,
					":key": key
				});
				keyRow = { pk: inserted.lastID };
			}
			await db.run("INSERT INTO ToIds ([KeysToIds.pk], Ids) VALUES (:key, :id)", {
				":key": keyRow.pk,
				":id": toId
			});
		}).catch(err => this._logger.error("Error Inserting into Database", err));
	}

	async replace(direction: Direction, bridge: Bridge, fromId: string, toIds: string[]) {
		return this.enqueueDbOperation(async () => {
			const db = await this._db;
			await db.run("BEGIN");
			try {
				let bridgeRow = await db.get("SELECT pk FROM Bridges WHERE BridgeName = :name", {
					":name": bridge.name
				});
				if (!bridgeRow) {
					await db.run("INSERT INTO Bridges (BridgeName) VALUES (:name)", { ":name": bridge.name });
					bridgeRow = await db.get("SELECT pk FROM Bridges WHERE BridgeName = :name", {
						":name": bridge.name
					});
				}
				const key = `${direction} ${fromId}`;
				await db.run(
					"DELETE FROM ToIds WHERE [KeysToIds.pk] IN (SELECT pk FROM KeysToIds WHERE [Bridges.pk] = :bridge AND Keys = :key)",
					{ ":bridge": bridgeRow.pk, ":key": key }
				);
				await db.run("DELETE FROM KeysToIds WHERE [Bridges.pk] = :bridge AND Keys = :key", {
					":bridge": bridgeRow.pk,
					":key": key
				});
				if (toIds.length > 0) {
					const inserted = await db.run("INSERT INTO KeysToIds ([Bridges.pk], Keys) VALUES (:bridge, :key)", {
						":bridge": bridgeRow.pk,
						":key": key
					});
					for (const id of toIds) {
						await db.run("INSERT INTO ToIds ([KeysToIds.pk], Ids) VALUES (:key, :id)", {
							":key": inserted.lastID,
							":id": id
						});
					}
				}
				await db.run("COMMIT");
			} catch (error) {
				await db.run("ROLLBACK");
				throw error;
			}
		});
	}

	async getCorresponding(direction: Direction, bridge: Bridge, fromId: string) {
		const toId: string[] = [];
		const results = await this.enqueueDbOperation(async () => {
			const db = await this._db;
			const result = await db.all(
				"SELECT DISTINCT t.Ids FROM ToIds t INNER JOIN KeysToIds k ON t.[KeysToIds.pk] = k.pk WHERE k.Keys = :sqlKey AND k.[Bridges.pk] = (SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName) ORDER BY t.pk",
				{
					":sqlKey": `${direction} ${fromId}`,
					":sqlBridgeName": bridge.name
				}
			);
			return result;
		}).catch(err => this._logger.error("Error getting Corresponding from Database", err));
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

	async getCorrespondingReverse(direction: Direction, bridge: Bridge, toId: string) {
		const result = await this.enqueueDbOperation(async () => {
			const db = await this._db;
			return db.get(
				"SELECT k.Keys FROM KeysToIds k INNER JOIN ToIds t ON t.[KeysToIds.pk] = k.pk WHERE k.[Bridges.pk] = (SELECT pk FROM Bridges WHERE BridgeName = :sqlBridgeName) AND t.Ids = :sqlIds AND k.Keys LIKE :sqlDirection ORDER BY k.pk DESC LIMIT 1",
				{
					":sqlBridgeName": bridge.name,
					":sqlIds": toId,
					":sqlDirection": `${direction} %`
				}
			);
		});
		return result?.Keys;
	}
}

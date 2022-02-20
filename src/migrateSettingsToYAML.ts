/**************************
 * Import important stuff *
 **************************/

import fs from "fs";
import jsYaml from "js-yaml";

/**************************
 * The migration function *
 **************************/

export function migrateSettingsToYAML(jsonPath: fs.PathLike, yamlPath: fs.PathOrFileDescriptor) {
	try {
		// Read the file and parse it
		const settings = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

		// Save it back as YAML
		//TODO replaced saveDump with dump. Support for saveDump was removed. Check if it still works as expected.
		fs.writeFileSync(yamlPath, jsYaml.dump(settings));

		// Remove settings.json
		fs.unlinkSync(jsonPath);
	} catch (err: any) {
		// Could not read it. Check if it exists
		if (err.code !== "ENOENT") {
			// It does exist, but can't be read... Pass on the error
			throw err;
		}
		// else it doesn't exist, and has probably already been migrated. Don't do anything
	}
}


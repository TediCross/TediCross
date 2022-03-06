import R from "ramda";
import moment from "moment";

const dummy = R.always(undefined);

/** Logger utility which works just like the ordinary 'console' but prefixes any message with a timestamp and type of message */
// eslint-disable-next-line no-console
export class Logger extends console.Console {
	private _debugEnabled: boolean;
	/**
	 * Creates a new logger
	 *
	 * @param debug Whether to print debug messages
	 */
	constructor(debug: boolean) {
		super(process.stdout, process.stderr);

		this._debugEnabled = debug;

		// Wrap the output methods
		this.log = Logger._wrapper((...args: unknown[]) => super.log(...args), "LOG");
		this.info = Logger._wrapper((...args: unknown[]) => super.info(...args), "INFO");
		this.error = Logger._wrapper((...args: unknown[]) => super.error(...args), "ERR");
		this.warn = Logger._wrapper((...args: unknown[]) => super.warn(...args), "WARN");
		this.debug = this._debugEnabled ? Logger._wrapper((...args: unknown[]) => this.debug(...args), "DEBUG") : dummy;
	}

	/**
	 * Wraps the console print methods so they print a bit more info
	 *
	 * @param method	The console method to wrap
	 * @param tag	Tag to prefix all calls to this method with
	 *
	 * @returns A function which works just like the given method, but also prints extra data
	 */
	private static _wrapper(method: (...args: unknown[]) => void, tag: string) {
		return (...args: unknown[]) => {
			// Create the stamp
			const stamp = `${Logger.timestamp} [${tag}]`;
			// Put the stamp as the first argument, preserving the inspection of whatever the first argument is
			return method(stamp, ...args);
		};
	}

	/** The current timestamp on string format */
	static get timestamp() {
		return moment().format("YYYY-MM-DD HH:mm:ss");
	}
}

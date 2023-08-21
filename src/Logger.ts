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
		this.log = this._wrapper(this.log, "LOG");
		this.info = this._wrapper(this.info, "INFO");
		this.error = this._wrapper(this.error, "ERR");
		this.warn = this._wrapper(this.warn, "WARN");
		this.debug = this._debugEnabled ? this._wrapper(this.debug, "DEBUG") : dummy;
	}

	/**
	 * Wraps the console print methods so they print a bit more info
	 *
	 * @param method	The console method to wrap
	 * @param tag	Tag to prefix all calls to this method with
	 *
	 * @returns A function which works just like the given method, but also prints extra data
	 */
	// eslint-disable-next-line no-unused-vars, class-methods-use-this
	_wrapper(method: (...args: any[]) => void, tag: string) {
		return (...args: any[]) => {
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

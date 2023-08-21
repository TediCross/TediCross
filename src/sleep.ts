import util from "util";
import R from "ramda";
import moment from "moment";

/**
 * Makes a promise which resolves after a set number of milliseconds
 *
 * @param ms	Number of milliseconds to slieep
 * @param [arg]	Optional argument to resolve the promise to
 *
 * @returns Promise resolving after the given number of ms
 */
export const sleep = util.promisify(setTimeout);

/**
 * Makes a promise which resolves after one minute
 *
 * @param [arg]	Optional argument to resolve the promise to
 *
 * @returns Promise resolving after one minute
 */
export const sleepOneMinute = R.partial(sleep, [moment.duration(1, "minute").asMilliseconds()]);

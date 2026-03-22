/**
 * @typedef {Object} Station
 * @property {string} name
 * @property {string} ref
 */

/**
 * @typedef {Object} DepartureArrivalTime
 * @property {string} [planned]
 * @property {string} [estimated]
 */

/**
 * @typedef {Object} Platform
 * @property {string} [planned]
 * @property {string} [estimated]
 */

/**
 * @typedef {Object} Stop
 * @property {Station} station
 * @property {Platform} [platform]
 * @property {DepartureArrivalTime} [departure]
 * @property {DepartureArrivalTime} [arrival]
 * @property {boolean} [cancelled]
 */

/**
 * @typedef {Object} Journey
 * @property {string} journeyRef
 * @property {string} operatingDayRef
 * @property {string} name
 * @property {Station} origin
 * @property {Station} destination
 * @property {Stop} stop
 * @property {boolean} [cancelled]
 * @property {string} [attribute]
 */

module.exports = {};

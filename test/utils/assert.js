/* eslint-disable no-console */

'use strict';


const assert = require('assert');
const _ = require('lodash');


function deepEqual(result, expected, message) {

    try {
        assert.deepEqual(result, expected, message);
    } catch (e) {
        console.log(`Expected:\n${JSON.stringify(expected, null, 2)}`);
        console.log(`Result:\n${JSON.stringify(result, null, 2)}`);
        throw e;
    }

}


/**
 * Asserts whether the return status was as expected
 */
function status(res, expected) {

    deepEqual(res.status, expected,
        `Expected status to be ${expected}, but was ${res.status}`);

}


/**
 * Asserts whether content type was as expected
 */
function contentType(res, expectedRegexString) {

    const actual = res.headers['content-type'];
    assert.ok(RegExp(expectedRegexString).test(actual),
        `Expected content-type to match ${expectedRegexString}, but was ${actual}`);

}


function isDeepEqual(result, expected, message) {

    try {
        assert.deepEqual(result, expected, message);
        return true;
    } catch (e) {
        return false;
    }

}


function notDeepEqual(result, expected, message) {

    try {
        assert.notDeepEqual(result, expected, message);
    } catch (e) {
        console.log(`Not expected:\n${JSON.stringify(expected, null, 2)}`);
        console.log(`Result:\n${JSON.stringify(result, null, 2)}`);
        throw e;
    }

}


function fails(promise, onRejected) {

    let failed = false;

    function trackFailure(e) {
        failed = true;
        return onRejected(e);
    }

    function check() {
        if (!failed) {
            throw new Error('expected error was not thrown');
        }
    }

    return promise.catch(trackFailure).then(check);

}

/**
 * @param {?number} result
 * @param {!number} expected
 * @param {!number} delta
 * @param {?string} message
 */
function closeTo(result, expected, delta, message) {
    assert.ok(_.isNumber(result) && Math.abs(result - expected) <= delta,
        message || `Result is ${result}; expected ${expected} ± ${delta}`);
}





module.exports.ok             = assert.ok;
module.exports.throws         = assert.throws;
module.exports.fails          = fails;
module.exports.deepEqual      = deepEqual;
module.exports.isDeepEqual    = isDeepEqual;
module.exports.notDeepEqual   = notDeepEqual;
module.exports.contentType    = contentType;
module.exports.status         = status;
module.exports.closeTo        = closeTo;


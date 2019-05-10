/**
 * Featured article of the day
 */

'use strict';

const util = require('../lib/util');
const featured = require('../lib/featured');

/**
 * The main router object
 */
const router = util.router();

/**
 * The main application object reported when this module is require()d
 */
let app;

/**
 * GET {domain}/v1/page/featured/{year}/{month}/{day}
 * Gets the title for a featured article of a given date.
 */
router.get('/featured/:yyyy/:mm/:dd', (req, res) => {
    return featured.promise(app, req)
        .then((response) => {
            res.status(!response.payload ? 204 : 200);
            util.setETag(res, response.meta && response.meta.etag);
            util.setContentType(res, util.CONTENT_TYPES.unpublished);
            res.json(response.payload || null).end();
        });
});

module.exports = function (appObj) {
    app = appObj;
    return {
        path: '/page',
        api_version: 1,
        router
    };
};

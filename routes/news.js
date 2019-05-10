'use strict';

const util = require('../lib/util');
const news = require('../lib/news');

/**
 * The main router object
 */
const router = util.router();

/**
 * The main application object reported when this module is require()d
 */
let app;

/**
 * GET {domain}/api/rest_v1/page/news
 *
 * Get descriptions of current events and related article links.
 * Experimental and English-only.
 */
router.get('/news', (req, res) => {
    return news.promise(app, req)
    .then((response) => {
        res.status(!response.payload ? 204 : 200);
        util.setETag(res, response.meta && response.meta.etag);
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

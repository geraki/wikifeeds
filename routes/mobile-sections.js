/**
 * mobileapp provides page content for the Mobile Apps.
 * The goal is to avoid having to use a web view and style the content natively inside the app
 * using plain TextViews.
 * The payload should not have any extra data, and should be easy to consume by the apps.
 *
 * Status: Experimental
 * Currently using the mobileview action MW API, and removing some data we don't display.
 * TODO: add more transformations that currently are being done by the apps
 */

'use strict';

const BBPromise = require('bluebird');
const domino = require('domino');
const mwapi = require('../lib/mwapi');
const mUtil = require('../lib/mobile-util');
const parse = require('../lib/parseProperty');
const parsoid = require('../lib/parsoid-access');
const sUtil = require('../lib/util');
const transforms = require('../lib/transforms');

/**
 * The main router object
 */
const router = sUtil.router();

/**
 * The main application object reported when this module is require()d
 */
let app;

/** Returns a promise to retrieve the page content from MW API mobileview */
function pageContentForMainPagePromise(req) {
    return mwapi.getAllSections(app, req)
    .then((response) => {
        const page = response.body.mobileview;
        const sections = page.sections;
        let section;

        // transform all sections
        for (let idx = 0; idx < sections.length; idx++) {
            section = sections[idx];
            section.text = transforms.runMainPageDomTransforms(section.text);
        }

        page.sections = sections;
        return page;
    });
}

/** Returns a promise to retrieve the page content from MW API mobileview */
function pageMetadataPromise(req) {
    return mwapi.getMetadata(app, req)
    .then((response) => {
        return response.body.mobileview;
    });
}

function buildLeadSections(sections) {
    const len = sections.length;
    const out = [];

    out.push(sections[0]);
    for (let i = 1; i < len; i++) {
        const section = sections[i];
        const item = {
            id: section.id,
            toclevel: section.toclevel,
            anchor: section.anchor,
            line: section.line
        };
        out.push(item);
    }
    return out;
}

/*
 * @param {Object} input
 * @param {Boolean} [removeNodes] whether to remove nodes from the lead text
 * @return {Object} lead json
 */
function buildLead(input, removeNodes) {
    const lead = domino.createDocument(input.page.sections[0].text);

    if (!removeNodes) {
        // Move the first good paragraph up for any page except main pages.
        // It's ok to do unconditionally since we throw away the page
        // content if this turns out to be a main page.
        //
        // TODO: should we also exclude file and other special pages?
        transforms.relocateFirstParagraph(lead);
    }
    const hatnotes = transforms.extractHatnotes(lead, removeNodes);
    const pronunciation = parse.parsePronunciation(lead, input.meta.displaytitle);
    const issues = transforms.extractPageIssues(lead, removeNodes);

    let infobox;
    let intro;
    let sections;
    let text;

    if (removeNodes) {
        if (input.page.sections.length > 1) {
            infobox = transforms.extractInfobox(lead);
            intro = transforms.extractLeadIntroduction(lead);
        }
        text = lead.body.innerHTML;
    } else {
        // update text after extractions have taken place
        sections = buildLeadSections(input.page.sections);
        input.page.sections[0].text = lead.body.innerHTML;
    }

    return {
        ns: input.meta.ns,
        id: input.meta.id,
        issues,
        revision: input.page.revision,
        lastmodified: input.page.lastmodified,
        lastmodifier: input.meta.lastmodifiedby || { anon: true },
        displaytitle: input.meta.displaytitle,
        normalizedtitle: input.meta.normalizedtitle,
        redirected: input.meta.redirected,
        wikibase_item: input.meta.pageprops && input.meta.pageprops.wikibase_item,
        description: input.meta.description,
        protection: input.meta.protection,
        editable: input.meta.editable,
        mainpage: input.meta.mainpage,
        languagecount: input.meta.languagecount,
        image: mUtil.defaultVal(mUtil.filterEmpty({
            file: input.meta.image && input.meta.image.file,
            urls: input.meta.thumb && mwapi.buildLeadImageUrls(input.meta.thumb.url)
        })),
        pronunciation,
        spoken: input.page.spoken,
        hatnotes,
        infobox,
        intro,
        geo: input.page.geo,
        sections,
        text
    };
}

function buildRemaining(input) {
    // don't repeat the first section in remaining
    const sections = input.page.sections.slice(1);
    // mark references sections with a flag (if no sections its a stub or main page)
    if (sections.length) {
        transforms.markReferenceSections(sections, false);
    }
    return {
        sections
    };
}

/*
 * Build a response which contains only reference sections
 * @param {Object} input
 * @return {Object}
 */
function buildReferences(input) {
    const remaining = buildRemaining(input);
    const sections = [];
    remaining.sections.forEach((section) => {
        if (section.isReferenceSection) {
            sections.push(section);
        }
    });
    return {
        sections
    };
}

/*
 * @param {Object} input
 * @param {Boolean} [removeNodes] whether to remove nodes from the lead text
 * @return {Object}
 */
function buildAll(input, removeNodes) {
    return {
        lead: buildLead(input, removeNodes),
        remaining: buildRemaining(input)
    };
}

/**
 * For main page only, switch to mobileview content because Parsoid doesn't
 * provide a good mobile presentation of main pages.
 */
function mainPageFixPromise(req, response) {
    return pageContentForMainPagePromise(req)
    .then((mainPageContent) => {
        return {
            page: mainPageContent,
            meta: response.meta,
            extract: response.extract
        };
    });
}

function buildAllResponse(req, res, removeNodes) {
    return BBPromise.props({
        page: parsoid.pageContentPromise(app, req),
        meta: pageMetadataPromise(req)
    }).then((response) => {
        if (response.meta.mainpage) {
            return mainPageFixPromise(req, response);
        }
        return response;
    }).then((response) => {
        response = buildAll(response, removeNodes);
        res.status(200);
        mUtil.setETag(res, response.lead.revision);
        mUtil.setContentType(res, mUtil.CONTENT_TYPES.mobileSections);
        res.json(response).end();
    });
}

function buildLeadResponse(req, res, removeNodes) {
    return BBPromise.props({
        page: parsoid.pageContentPromise(app, req),
        meta: pageMetadataPromise(req),
        extract: mwapi.requestExtract(app, req)
    }).then((response) => {
        if (response.meta.mainpage) {
            return mainPageFixPromise(req, response);
        }
        return response;
    }).then((response) => {
        response = buildLead(response, removeNodes);
        res.status(200);
        mUtil.setETag(res, response.revision);
        mUtil.setContentType(res, mUtil.CONTENT_TYPES.mobileSections);
        res.json(response).end();
    });
}
/**
 * GET {domain}/v1/page/mobile-sections/{title}
 * Gets the mobile app version of a given wiki page.
 */
router.get('/mobile-sections/:title/:revision?', (req, res) => {
    return buildAllResponse(req, res, false);
});

/**
 * GET {domain}/v1/page/mobile-sections-lead/{title}
 * Gets the lead section for the mobile app version of a given wiki page.
 */
router.get('/mobile-sections-lead/:title/:revision?', (req, res) => {
    return buildLeadResponse(req, res, false);
});

/**
 * GET {domain}/v1/page/mobile-sections-remaining/{title}
 * Gets the remaining sections for the mobile app version of a given wiki page.
 */
router.get('/mobile-sections-remaining/:title/:revision?', (req, res) => {
    return BBPromise.props({
        page: parsoid.pageContentPromise(app, req)
    }).then((response) => {
        res.status(200);
        mUtil.setETag(res, response.page.revision);
        mUtil.setContentType(res, mUtil.CONTENT_TYPES.mobileSections);
        res.json(buildRemaining(response)).end();
    });
});

/**
 * GET {domain}/v1/page/references/{title}/{revision:?}
 * Gets any sections which are part of a reference sections for a given wiki page.
 */
router.get('/references/:title/:revision?', (req, res) => {
    return BBPromise.props({
        page: parsoid.pageContentPromise(app, req)
    }).then((response) => {
        res.status(200);
        mUtil.setETag(res, response.page.revision);
        mUtil.setContentType(res, mUtil.CONTENT_TYPES.mobileSections);
        res.json(buildReferences(response)).end();
    });
});

/**
* GET {domain}/v1/page/formatted/{title}/{revision?}
* Gets a formatted version of a given wiki page rather than a blob of wikitext.
*/
router.get('/formatted/:title/:revision?', (req, res) => {
    return buildAllResponse(req, res, true);
});

/**
* GET {domain}/v1/page/formatted-lead/{title}/{revision?}
* Gets a formatted version of a given wiki page rather than a blob of wikitext.
*/
router.get('/formatted-lead/:title/:revision?', (req, res) => {
    return buildLeadResponse(req, res, true);
});

module.exports = function(appObj) {
    app = appObj;
    return {
        path: '/page',
        api_version: 1,
        router
    };
};

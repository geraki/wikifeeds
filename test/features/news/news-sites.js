/* eslint-env mocha */

'use strict';

const assert = require('../../utils/assert');
const domino = require('domino');
const fs = require('fs');
const NEWS_SITES = require('../../../etc/news-sites');

describe('news headline selectors', function() {
    this.timeout(20000); // eslint-disable-line no-invalid-this

    /**
     * @param {!string} lang
     * @return {!Document}
    */
    function readTestDoc(lang) {
        const filename = `test/fixtures/news-site-${lang}.html`;
        const html = fs.readFileSync(filename);
        return domino.createDocument(html);
    }

    for (const lang of Object.keys(NEWS_SITES)) {
        it(`${lang} news headlines should be general not categorical`, () => {
            const doc = readTestDoc(lang);
            const headlines = doc.querySelectorAll(NEWS_SITES[lang].headlineSelectorAll);
            assert.closeTo(headlines.length, 5, 3);
        });

        it(`${lang} news headline topics should be nonnull`, () => {
            const doc = readTestDoc(lang);
            const headlines = doc.querySelectorAll(NEWS_SITES[lang].headlineSelectorAll);
            const topic = headlines[0].querySelector(NEWS_SITES[lang].topicAnchorSelector);
            assert.ok(topic !== null);
        });
    }

    it('news headline topic should be the first bold link', () => {
        const lang = 'en';
        const doc = readTestDoc(lang);
        const headlines = doc.querySelectorAll(NEWS_SITES[lang].headlineSelectorAll);
        const topic = headlines[2].querySelector(NEWS_SITES[lang].topicAnchorSelector);
        assert.deepEqual(topic.getAttribute('href'), './Poisoning_of_Sergei_and_Yulia_Skripal');
    });

    it('news headline topic should be the first link when no link is bolded', () => {
        const lang = 'es';
        const doc = readTestDoc(lang);
        const headlines = doc.querySelectorAll(NEWS_SITES[lang].headlineSelectorAll);
        const topic = headlines[1].querySelector(NEWS_SITES[lang].topicAnchorSelector);
        assert.deepEqual(topic.getAttribute('href'),
            './Campeonato_Mundial_de_Patinaje_Artístico_sobre_Hielo_de_2018');
    });
});

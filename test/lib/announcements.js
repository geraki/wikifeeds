'use strict';

const domino = require('domino');
const assert = require('../utils/assert');
const mut = require('../../lib/announcements.js'); // module under test
const config = require('../../etc/announcements');

const inactiveAnnouncementDomain = 'cs.wikipedia.org';
const activeAnnouncementDomain = 'en.wikipedia.org';

const fundraisingCampaigns = config.campaigns.filter((campaign) =>
    campaign.type == config.AnnouncementType.FUNDRAISING
);

const surveyCampaigns = config.campaigns.filter((campaign) =>
    campaign.type == config.AnnouncementType.SURVEY
);

const fundraisingAndSurveyCampaigns = config.campaigns.filter((campaign) =>
    campaign.type == config.AnnouncementType.SURVEY || campaign.type == config.AnnouncementType.FUNDRAISING
);

describe('lib:announcements', () => {
    it('should return no announcement for inactive wiki', () => {
        const res = mut.getAnnouncements(inactiveAnnouncementDomain);
        assert.ok(res.announce.length === 0);
    });

    it('should return one or more announcements for active wiki', () => {
        const res = mut.getAnnouncements(activeAnnouncementDomain);

        const fundraisingCampaign = fundraisingCampaigns[0];
        const surveyCampaign = surveyCampaigns[0];
        if (mut.testing.hasEnded(fundraisingCampaign, new Date()) && mut.testing.hasEnded(surveyCampaign, new Date())) {
            assert.ok(res.announce.length === 0);
        } else if (mut.testing.hasEnded(fundraisingCampaign, new Date())) {
            assert.ok(res.announce.length === 1);
        } else if (mut.testing.hasEnded(surveyCampaign, new Date())) {
            assert.ok(res.announce.length === 18);
        } else {
            assert.ok(res.announce.length === 19);
        }
    });
});

describe('lib:announcements:etc', () => {

    fundraisingCampaigns.forEach((fundraisingCampaign) => {

        const announcements = mut.testing.getAnnouncementsForCampaign(fundraisingCampaign);
        it('should return no image_url', () => {
            announcements.forEach((announcement) => {
                assert.ok(!announcement.image_url);
            });
        });

        it('should return correct type', () => {
            announcements.forEach((elem) => {
                assert.ok(elem.type === config.AnnouncementType.FUNDRAISING);
            });
        });

        it('countries is an array of strings', () => {
            announcements.forEach((elem) => {
                assert.ok(elem.countries.every(value => typeof value === 'string'));
            });
        });

        it('should not deliver HTML in certain legacy iOS announcements fields', () => {
            const doc = domino.createDocument();
            const iosAnnouncement = mut.testing.getLegacyiOSFundraisingAnnouncements(fundraisingCampaign)[0];
            // destructure 'id', 'text' and 'action.title' from the iOS announcement
            const { text, action: { title } } = iosAnnouncement;
            const fieldsToCheck = { text, title };
            for (const textOnlyFieldName of Object.keys(fieldsToCheck)) {
                const textToCheck = fieldsToCheck[textOnlyFieldName];
                const element = doc.createElement('div');
                element.innerHTML = textToCheck;
                // Comparing innerHTML and textContent lengths catches even non-tag html,
                // such as '&nbsp;';
                assert.deepEqual(
                    element.innerHTML.length, element.textContent.length,
                    `iOS does not support HTML in the "${textOnlyFieldName}" field`
                );
            }
        });

        it('iOS legacy fundraising announcement should have the proper platform ID', () => {
            const announcements = mut.testing.getLegacyiOSFundraisingAnnouncements(fundraisingCampaign);
            announcements.forEach((announcement) => {
                assert.ok(announcement.platforms.includes('iOSApp'));
                assert.ok(!announcement.platforms.includes('iOSAppV2'));
                assert.ok(!announcement.platforms.includes('iOSAppV3'));
            });
        });

        it('iOS fundraising announcement should have the proper platform ID', () => {
            const announcements = mut.testing.getiOSFundraisingAnnouncements(fundraisingCampaign);
            announcements.forEach((announcement) => {
                assert.ok(!announcement.platforms.includes('iOSApp'));
                assert.ok(announcement.platforms.includes('iOSAppV2'));
                assert.ok(!announcement.platforms.includes('iOSAppV3'));
            });
        });

        it('should deliver HTML in certain V2 announcements fields', () => {
            const doc = domino.createDocument();
            const v2Announcement = mut.testing.getAndroidFundraisingAnnouncements(fundraisingCampaign)[0];
            const { text } = v2Announcement;
            const fieldsToCheck = { text };
            for (const textOnlyFieldName of Object.keys(fieldsToCheck)) {
                const textToCheck = fieldsToCheck[textOnlyFieldName];
                const element = doc.createElement('div');
                element.innerHTML = textToCheck;

                // Looking for <br> tags
                assert.ok(
                    element.querySelector('BR'),
                    // eslint-disable-next-line max-len
                    `V2 announcements should have some HTML line breaks in the "${textOnlyFieldName}" field`
                );
            }
        });

        it('caption_HTML on iOS should be inside a paragraph', () => {
            // eslint-disable-next-line camelcase
            const { caption_HTML } = mut.testing.getLegacyiOSFundraisingAnnouncements(fundraisingCampaign)[0];
            const doc = domino.createDocument(caption_HTML);
            assert.deepEqual(doc.body.firstElementChild.tagName, 'P');
        });

        it('caption_HTML on Android should not be inside a paragraph', () => {
            // eslint-disable-next-line camelcase
            const { caption_HTML } = mut.testing.getAndroidFundraisingAnnouncements(fundraisingCampaign)[0];
            const doc = domino.createDocument(caption_HTML);
            assert.notDeepEqual(doc.body.firstElementChild.tagName, 'P');
        });
    });

    fundraisingAndSurveyCampaigns.forEach(campaign => {
        it('buildId should not return lower case characters', () => {
            const id = mut.testing.buildId(campaign, 'IOS', 'US');
            assert.deepEqual(id, id.toUpperCase());
        });
    });

    surveyCampaigns.forEach(campaign => {

        const announcements = mut.testing.getAnnouncementsForCampaign(campaign);

        it('iOS survey announcement should have at least one normalized string in article titles', () => {
            announcements.forEach((announcement) => {
                assert.ok(announcement.articleTitles.length > 0);
                announcement.articleTitles.forEach((title) => {
                    assert.ok(typeof title == 'string');
                    assert.ok(!title.includes('_'))
                });
            });
        });

        it('iOS survey announcement should have a displayDelay number > 0', () => {
            announcements.forEach((announcement) => {
                assert.ok(typeof announcement.displayDelay == 'number');
                assert.ok(announcement.displayDelay > 0);
            });
        });

        it('iOS survey announcement should have the proper platform ID', () => {
            announcements.forEach((announcement) => {
                assert.ok(!announcement.platforms.includes('iOSApp'));
                assert.ok(!announcement.platforms.includes('iOSAppV2'));
                assert.ok(announcement.platforms.includes('iOSAppV3'));
            });
        });
    });

    describe('.hasEnded', () => {
        const fundraisingCampaign = fundraisingCampaigns[0];
        let oldEndTime;

        beforeEach(() => {
            oldEndTime = fundraisingCampaign.endTime;
        });

        afterEach(() => {
            fundraisingCampaign.endTime = oldEndTime;
        });

        it('invalid endTime', () => {
            fundraisingCampaign.endTime = 'INVALID';
            assert.throws(() => {
                mut.testing.hasEnded(fundraisingCampaign, Date(Date.UTC(2030, 5, 1)));
            }, /config_error/);
        });

        it('endTime has passed', () => {
            fundraisingCampaign.endTime = '2017-12-20T23:59:00Z';
            assert.ok(mut.testing.hasEnded(fundraisingCampaign, new Date(Date.UTC(2017, 11, 21))));
        });

        it('endTime has not passed yet', () => {
            fundraisingCampaign.endTime = '2017-12-20T23:59:00Z';
            assert.ok(!mut.testing.hasEnded(fundraisingCampaign, new Date(Date.UTC(2017, 11, 20))));
        });
    });

    describe('announcements-unit-config', () => {
        const THIS_YEAR = new Date().getUTCFullYear();

        // Example: '2017-11-30T16:00:00Z'
        const SIMPLIFIED_ISO8610_REGEX
            = /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)$/;

        function checkValidDateStringFormat(dateString, label) {
            assert.ok(SIMPLIFIED_ISO8610_REGEX.test(dateString),
                `invalid date string format in ${label}`);
        }

        function checkYear(date, label) {
            const res = date.getUTCFullYear();
            assert.ok(THIS_YEAR - 1 < res || res < THIS_YEAR + 1,
                `invalid year ${res} in ${label}`);
        }

        function checkValidDate(date, label) {
            assert.ok(!isNaN(date.getTime()), `invalid date in ${label}`);
        }

        function checkDate(date, dateString, label) {
            checkValidDateStringFormat(dateString, label);
            checkValidDate(date, label);
            checkYear(date, label);
        }

        it('all dates should be valid', () => {

            fundraisingAndSurveyCampaigns.forEach(campaign => {
                const startDate = new Date(campaign.startTime);
                const endDate = new Date(campaign.endTime);

                checkDate(startDate, campaign.startTime, 'startTime');
                checkDate(endDate, campaign.endTime, 'endTime');
                assert.ok(startDate < endDate, 'endTime should be greater than startTime!');
            });
        });
    });
});

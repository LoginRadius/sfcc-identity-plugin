/* global empty, session */

'use strict';

/**
 * Account.js
 * LoginRadius-specific appends/prepends for the default app_storefront_base
 * Account.js controller.
 */

// SFRA Includes
var LoginRadiusService = require('~/cartridge/scripts/service/loginRadiusService');
var server = require('server');
var assets = require('*/cartridge/scripts/assets');

server.extend(module.superModule);


/**
 * Takes the profile returned by the LoginrRadius API and returns it in a format
 * suitable for displaying via SFRA's view system.
 *
 * @param {Object} profile - The customer's LoginRadius profile.
 * @returns {{FirstName: string, LastName: string, Email: string}} - Returns the
 *      LoginRadius profile information that is needed as an abbreviated Object.
 */
function formatLoginRadiusProfile(profile) {
    // pull out the primary email from the list sent over by LoginRadius
    var primaryEmail;
    for (var i = 0; i < profile.Email.length; i++) {
        if (!empty(profile.Email[i].Type) && !empty(profile.Email[i].Value) &&
            (profile.Email[i].Type === 'Primary')
        ) {
            primaryEmail = profile.Email[i].Value;
            break;
        }
    }

    // return the fields editable in the profile section
    return {
        FirstName: profile.FirstName,
        LastName: profile.LastName,
        Email: primaryEmail
    };
}

/**
 * Prepend callback to initialize response with prefs, assets and view data.
 *
 * @param {Object} req - The request
 * @param {Object} res - The response
 * @param {function} next - A callback function to pass control to the next
 *      middleware function in the chain.
 *
 * @returns {null} - Returns the return value of the next() callback, wich
 *      evaluates as null.
 */
function initializeLoginRadius(req, res, next) {
    var LoginRadius = require('*/cartridge/models/loginRadius');
    // Get the view data object to append data to.
    var viewData = res.getViewData();
    var loginRadius = new LoginRadius();
    viewData.loginRadius = loginRadius;

    // If LoginRadius is enabled, add the JS resource for LR, fetch the LR
    // profile, and pass it as part of the view data.
    if (loginRadius.enabled) {
        assets.addJs('https://auth.lrcontent.com/v2/js/LoginRadiusV2.js');
        var UID = session.customer.profile.credentials.login;
        var profile = LoginRadiusService.getProfileByUID(UID);
        viewData.loginRadiusProfile = formatLoginRadiusProfile(profile);
    }

    res.setViewData(viewData);
    return next();
}

/**
 * Prepends SFRA's Account-EditProfile controller handler to include the user's profile
 * (if logged in and LoginRadius is enabled).
 */
server.prepend('EditProfile', initializeLoginRadius);


/**
 * Prepends SFRA's Account-EditProfile controller handler to include the user's profile
 * (if logged in and LoginRadius is enabled).
 */
server.prepend('EditPassword', initializeLoginRadius);

module.exports = server.exports();


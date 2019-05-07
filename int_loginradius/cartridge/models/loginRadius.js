/* global empty */

'use strict';

/**
 * models/loginRadius.js
 * This model class provides a the controller an interface for consistently
 * passing data to the view with a defined format.
 */

function loginRadius(args) {
    // SFCC API class imports
    var Site = require('dw/system/Site');
    var URLUtils = require('dw/web/URLUtils');

    // Get site pref values.
    var site = Site.getCurrent();

    // Set instance var values.
    this.enabled = !empty(site.getCustomPreferenceValue('loginRadiusIsEnabled')
        ) ? site.getCustomPreferenceValue('loginRadiusIsEnabled') : false;
    this.resetPasswordUrl = this.enabled ?
        URLUtils.https('LoginRadius-PasswordResetForm') :
        URLUtils.https('Account-PasswordResetDialogForm');
    this.key = !empty(site.getCustomPreferenceValue('loginRadiusApiKey')) ?
        site.getCustomPreferenceValue('loginRadiusApiKey') : '';
    this.googleRecaptchaSiteKey = !empty(site.getCustomPreferenceValue('loginRadiusGoogleRecaptchaSiteKey')) ?
        site.getCustomPreferenceValue('loginRadiusGoogleRecaptchaSiteKey') : '';
    this.siteName = !empty(site.getCustomPreferenceValue('loginRadiusSiteName')) ?
        site.getCustomPreferenceValue('loginRadiusSiteName') : '';
}

module.exports = loginRadius;

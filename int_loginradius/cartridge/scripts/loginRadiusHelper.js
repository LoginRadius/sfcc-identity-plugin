/* global empty */

'use strict';

/**
 * loginRadiusHelper.js
 *
 * Provides exported helper functions for performing LoginRadius related
 * business logic and keeping the controllers 'thin'. This module's helper
 * methods provide a wrapper for easily making calls to the LoginRadius (LR)
 * service. This wrapper is responsible for making the appropriate token refresh
 * calls that are needed periodically to access and update user profile
 * information, and handles error logging for exception conditions.
 *
 * @module loginRadiusHelper
 */

// SFCC API Includes
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');

// LoginRadius Includes
var LoginRadiusService = require(
    '~/cartridge/scripts/service/loginRadiusService');

/**
 * Loggs all the keys from an object to the error logs for better error messages.
 *
 * @param {Ojbect} e - An error Object to be logged to the SFCC error logs.
 * @param {string[]} [args] - Any optional arguments to be passed to the SFCC
 * Logger instance methods as the args param.
 */
function logLRError(e, args) {
    var lrLogger = Logger.getLogger('loginradius', 'loginradius');
    var errMsg = 'ERROR in loginRadiusHelper.js';

    Object.keys(e).forEach(function (key) {
        errMsg += '\n' + key + ': ' + e[key];
    });

    if (!args) {
        lrLogger.error(errMsg);
    } else {
        lrLogger.error(errMsg, args);
    }
}

/**
 * A convenience method for getting an error with an 'unexpected error' message
 * for displaying to the user. This method also logs the passed in result object
 * to the error logs.
 *
 * @param {Object} [err] - An error result to log to the SFCC error logs.
 * @returns {{success: bool, status: string, message: string}} - Returns a view
 *      data error object that is already in the correct format to be passed
 *      back to the client
 */
function getUnexpectedError(err) {
    // If an error was passed, log it to the loginradius category error logs.
    if (err) {
        logLRError(err);
    }

    return {
        success: false,
        status: 'ERROR',
        message: Resource.msg('loginradius.error.unexpectederror',
            'loginradius', null)
    };
}

/**
 * This helper method calls the LoginRdius (LR) service to first get a new
 * refreshToken, and then uses that token to get a new access token.
 *
 * @param {string} accessToken - The access token that has expired.
 * @param {string} refreshToken - The refresh token, used to get a new access
 *      token from the LR API.
 * @returns {Object} - Returns the results from the call to refresh the access
 *      token.
 */
function refreshAccessToken(accessToken, refreshToken) {
    var newRefreshToken = '';
    var refreshData = {};

    // If no refresh token was included, then get one using the access token.
    if (!refreshToken) {
        // Get a new refresh token.
        refreshData = LoginRadiusService.refreshToken(accessToken);

        // If thee was not an error, use the refresh token to refresh the access
        // token for the current user session.
        if (!empty(refreshData.ErrorCode) && refreshData.ErrorCode === 905) {
            return getUnexpectedError(refreshData);
            /**
             * @todo: Handle error code 905: invalid refresh token.
             */
        } else if (!empty(refreshData.ErrorCode)) {
            return getUnexpectedError(refreshData);
        }

        // If no error was returned, get the refresh token from the result.
        newRefreshToken = refreshData.refresh_token;
    }

    // Get the access token using the refresh token.
    refreshData = LoginRadiusService.refreshAccessToken(newRefreshToken);

    // Return any errors while refreshing the access code from teh refresh code.
    if (!empty(refreshData.ErrorCode)) {
        return getUnexpectedError(refreshData);
    }

    refreshData.success = true;

    return refreshData;
}

/**
 * This helper method uses the accessToken to retrieve the user's profile from
 * the LoginRadius API.
 *
 * @param {string} accessToken - The current access token.
 * @returns {Object} - Returns the
 */
function getLoginRadiusProfile(accessToken) {
    // get the LR profile with the token returned
    var lrProfile = LoginRadiusService.getProfileByToken(accessToken);

    // If the token is expired, then refresh and try again.
    if (!empty(lrProfile.ErrorCode) && lrProfile.ErrorCode === 906) {
        var tokenRefreshData = refreshAccessToken(accessToken);

        // If there is still an error returned handle.
        if (!tokenRefreshData.success) {
            return getUnexpectedError(tokenRefreshData);
        }

        var newAccessToken = tokenRefreshData.access_token;
        lrProfile = LoginRadiusService.getProfileByToken(newAccessToken);
    } else if (!empty(lrProfile.ErrorCode)) {
        return getUnexpectedError(lrProfile);
    }

    // If the call was a success, then return the LoginRadius profile.
    return {
        success: true,
        status: 'OK',
        profile: lrProfile
    };
}

/**
 * This helper method makes a call to the LoginRadius (LR) service's update
 * profile method to set the 'emailVerified' flag to false. If the emailVerified
 * flag is set to true, then the user can no longer change their email address.
 * The user is verified if they perform a password reset, from a forgot password
 * email.
 *
 * @param {string} accessToken - The access token for retrieving and making
 *      changes to the current user account in the LR interface.
 * @returns {Object} - Retunrs the result of the API call which should be an
 *      errorMessage Object instance, or a LR profile instance.
 */
function unverifyAccount(accessToken) {
    // Get the LR profile from the access token in order to get the UID.
    var profObj = getLoginRadiusProfile(accessToken);

    // Get the customer's UID from the profile.
    if (!empty(profObj.profile)) {
        var lrProfile = profObj.profile;
        var UID = lrProfile.Uid;

        // Call the LR service to un-verify the email address on the account.
        return LoginRadiusService.unverifyAccount(UID, accessToken);
    }

    return {};
}

module.exports = {
    getLoginRadiusProfile: getLoginRadiusProfile,
    getUnexpectedError: getUnexpectedError,
    logLRError: logLRError,
    refreshAccessToken: refreshAccessToken,
    unverifyAccount: unverifyAccount
};

/* global empty */

'use strict';

/**
 * LoginRadius API integration service definition.
 *
 * Used to access LoginRadius API:
 * - https://docs.loginradius.com/api/v2/getting-started/introduction
 */

// SFCC API includes
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Logger = require('dw/system/Logger');
var Site = require('dw/system/Site');

// Custom Logger Instance
var lrLogger = Logger.getLogger('loginradius', 'loginradius');
var site = Site.getCurrent();
var enableDebugLogging = !empty(site
    .getCustomPreferenceValue('loginRadiusDebuggingEnabled')) ?
    site.getCustomPreferenceValue('loginRadiusDebuggingEnabled') : false;

/* Private Helper Methods
   ========================================================================== */

/**
 * Takes a JS object and returns a string with each key/value property pair
 * on a new line for log formatting.
 *
 * @param {string} response - An object to get a string for in order to log it
 *      to the custom error logs.
 * @returns {Object} - Returns a string created from all of the object's
 *      key / value properties.
 */
function getLogMsgFromResponse(response) {
    var logMsg = '';

    if (typeof response !== 'string') {
        Object.keys(response).forEach(function (key) {
            logMsg += '\n' + key + ': ' + response[key];
        });
    } else {
        return response;
    }

    return logMsg;
}

/**
 * Gets any query parameters from the arguments object supplied to the service
 * call, and returns them as a formated query string.
 *
 * @param {Object} args - The key/value pair containing any arguments passed to
 *      the service call.
 * @param {string} apiPath - The URI path for the REST API call.
 * @param {string} apiKey - The API key from the service credentials (username).
 * @param {string} apiSecret - The API secret from the service credentials
 *      (password).
 * @returns {string} - Returns the formated query string parameter string.
 */
function getURLParams(args, apiPath, apiKey, apiSecret) {
    var urlParams = '';

    urlParams += !empty(args.UID) ?
        (apiPath + '/' + args.UID + '?apikey=' + apiKey) :
        (apiPath + '?apikey=' + apiKey);


    if (!empty(args.includeApiSecret) && args.includeApiSecret) {
        // two different parameter names here depending on API endpoint
        if (apiPath.slice(0, 4) === 'api/') {
            urlParams += '&secret=' + apiSecret;
        } else {
            urlParams += '&apisecret=' + apiSecret;
        }
    }

    if (!empty(args.accessTokenParam)) {
        urlParams += '&access_token=' + args.accessTokenParam;
    }

    if (!empty(args.refreshToken)) {
        urlParams += '&refresh_token=' + args.refreshToken;
    }

    if (!empty(args.nullSupport)) {
        urlParams += '&nullsupport=' + args.nullSupport;
    }

    if (!empty(args.verificationTokenParam)) {
        urlParams += '&verificationtoken=' + args.verificationToken;
    }

    return urlParams;
}

/* Public / Exported Methods
   ========================================================================== */

/**
 * Gets the service instance from the local service registry and configures it
 * for use.
 *
 * @return {dw.svc.HTTPService} - Returns the loginradius.http service instance.
 */
function getService() {
    var lrService = LocalServiceRegistry.createService('loginradius.http', {
        /**
         * @param {dw.svc.Service} svc - The service instance for the call.
         * @param {Object} args - Parameters given to the call method.
         * @param {string} [args.requestMethod] - The HTTP verb to be used for
         *      the request to the LoginRadius API.
         * @returns {Object} - Request object to give to the execute method.
         */
        createRequest: function (svc, args) {
            var apiPath = args.apiPath;
            var apiKey = site.getCustomPreferenceValue('loginRadiusApiKey');
            var serviceConfiguration = svc.getConfiguration();
            var credential = serviceConfiguration.getCredential();
            var missing = '';
            var contentType = !empty(args.contentTypeHeader) ?
                args.contentTypeHeader : 'application/json';
            var requestMethod = !empty(args.requestMethod) ?
                args.requestMethod : 'GET';

            if (enableDebugLogging) {
                lrLogger.info('loginradius.http called with params: {0}', args);
            }

            if (empty(credential) || empty(apiKey)) {
                missing = empty(credential) ? 'credentials' : 'API Key';
                lrLogger.error('loginradius.http missing ' + missing);
                return { error: true };
            }

            // If adding the access token as an Authorization Bearer token was
            // specified in the arguments, then add the header.
            if (!empty(args.accessTokenHeader)) {
                svc.addHeader(
                    'Authorization', 'Bearer ' + args.accessTokenHeader);
            }

            var apiSecret = credential.getPassword();
            var URL = credential.getURL();

            URL += getURLParams(args, apiPath, apiKey, apiSecret);

            svc.setRequestMethod(requestMethod);
            svc.setURL(URL);
            svc.addHeader('charset', 'utf-8');
            svc.addHeader('Content-Type', contentType);

            // If call data for the body of the request was passed, then return
            // it so that it will be added to the call.
            if (!empty(args.callData)) {
                return args.callData;
            }

            return {};
        },

        parseResponse: function (svc, client) {
            if (enableDebugLogging) {
                lrLogger.info('loginradius.http response: {0}', client.text);
            }

            return client.text;
        },

        filterLogMessage: function (msg) {
            return msg;
        }
    });

    return lrService;
}

/**
 * Generates a Secured-One-Time-Token (SOTT) wich is needed for new
 * account registration.
 *
 * @returns {Object} - Returns the results from the API call.
 */
function generateSott() {
    var svc = getService();
    var callParams = {
        requestMethod: 'GET',
        apiPath: 'identity/v2/manage/account/sott',
        includeApiSecret: true
    };

    var result = svc.call(callParams);

    return JSON.parse(result.object);
}

/**
 * Gets the customer's profile from their access token.
 *
 * @param {string} accessToken - The customer's access token.
 * @returns {Object} - Returns either the results object or the error
 *      message object.
 */
function getProfileByToken(accessToken) {
    var svc = getService();
    var callParams = {
        requestMethod: 'GET',
        apiPath: 'identity/v2/auth/account',
        includeApiSecret: false,
        accessTokenHeader: accessToken
    };

    var result = svc.call(callParams);
    return result.ok ? JSON.parse(result.object) :
        JSON.parse(result.errorMessage);
}

/**
 * Gets the user's profile based on a passed in Unique Identifier.
 *
 * @param {string} UID - The user's unique ID which corresponds to their
 *      customer ID in SFCC.
 * @returns {Object} - Returns the reuslts from the API call.
 */
function getProfileByUID(UID) {
    var svc = getService();

    var result = svc.call({
        requestMethod: 'GET',
        apiPath: 'identity/v2/manage/account',
        includeApiSecret: true,
        UID: UID
    });

    return JSON.parse(result.object);
}

/**
 * Gets a refresh token that can be used to obtain an updated access
 * token for the customer.
 *
 * @param {sting} accessToken - The customer's access token.
 * @returns {Object} - Reutnrs the reuslt of the API call.
 */
function refreshToken(accessToken) {
    lrLogger.info('INFO: refreshToken called with access token: ' + accessToken);

    var svc = getService();

    var result = svc.call({
        requestMethod: 'GET',
        apiPath: 'api/v2/access_token/refresh',
        includeApiSecret: true,
        accessTokenParam: accessToken
    });

    var parsedResp = !empty(result.object) ? JSON.parse(result.object) :
        JSON.parse(result.errorMessage);

    lrLogger.info('INFO: refreshToken response: {0}',
        getLogMsgFromResponse(parsedResp));

    return parsedResp;
}

/**
 * Gets a new access token for the current cutomer from a refresh token.
 *
 * @param {string} refreshTokenParam - A refresh token for the current
 * @returns {Object} - Returns the result of the the API call.
 */
function refreshAccessToken(refreshTokenParam) {
    lrLogger.info('INFO: refreshAccessToken called with refresh token: ' + refreshTokenParam);

    var svc = getService();

    var result = svc.call({
        requestMethod: 'GET',
        apiPath: 'identity/v2/manage/account/access_token/refresh',
        includeApiSecret: true,
        refreshToken: refreshTokenParam
    });

    var parsedResp = !empty(result.object) ? JSON.parse(result.object) :
        JSON.parse(result.errorMessage);

    lrLogger.info('INFO: refreshAccessToken response: {0}',
        getLogMsgFromResponse(parsedResp));

    return parsedResp;
}

/**
 * Updates the customer profile in the LR system by setting the emailVerified
 * flag to false.
 *
 * @param {string} UID - The customer's unique ID which maps to the SFCC
 *      customer ID filed.
 * @param {string} accessToken - The access token for the customer account.
 * @returns {Object} - Returns the result of the API call.
 */
function unverifyAccount(UID, accessToken) {
    var svc = getService();
    var callParams = {
        requestMethod: 'PUT',
        apiPath: 'identity/v2/manage/account',
        includeApiSecret: true,
        accessTokenParam: accessToken,
        UID: UID,
        nullSupport: false,
        // eslint-disable-next-line
        callData: JSON.stringify({ "EmailVerified": false })
    };

    var result = svc.call(callParams);
    var parsedResult = !empty(result.object) ? JSON.parse(result.object) :
        JSON.parse(result.errorMessage);

    return parsedResult;
}

module.exports = {
    generateSott: generateSott,
    getProfileByToken: getProfileByToken,
    getProfileByUID: getProfileByUID,
    refreshToken: refreshToken,
    refreshAccessToken: refreshAccessToken,
    unverifyAccount: unverifyAccount
};

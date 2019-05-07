'use strict';

/**
 * profileUpdater.js
 *
 * This module provides an update function for sychronizing a user's SFCC
 * customer profile with changes that were made to thier LoginRadius profile. It
 * does this by making calls to the Ajax endpoints 'LoginRadius-UpdateProfile'
 * and 'LoginRadius-UpdateEmail'.
 */

/**
 * A constructor function that initializes an instance of the ProfileUpdater
 * object prototype. This obect type can be used to make calls to the
 * LoginRadius API and the SFCC API to update both profiles when the user makes
 * changes to their profile information.
 *
 * @constructor
 * @param {JQuery} $form - The profile form that was submitted.
 * @param {Object} LRObject - An instance of the global object LoginRadiusV2.
 */
function ProfileUpdater($form, LRObject) {
    this.$profileErrorDiv = $('.js-loginradius-error-updateprofile');
    this.$profileForm = $form;
    this.tokenRefreshAttempted = false;
    this.token = localStorage.getItem('LRTokenKey');
    this.acctHomeUrl = this.$profileForm.data('lrAccountHomeUrl');
    this.tokenRefreshUrl = this.$profileForm.data('lrTokenRefreshUrl');
    this.updateProfileUrl = this.$profileForm.data('lrUpdateProfileUrl');
    this.requiredFieldMsg = this.$profileForm.data('lrRequiredFieldMessage');
    this.LRObject = LRObject;

    // Get the update data from the form fields.
    this.updateData = {
        firstName: this.$profileForm.find('input#firstName').val(),
        lastName: this.$profileForm.find('input#lastName').val(),
        email: this.$profileForm.find('input#email').val()
    };

    // This schema is supposed to enable validation on the service side.
    // This doesn't appear to be working.
    this.schema = [{
        type: 'string',
        name: 'firstname',
        rules: 'required',
        permission: 'w'
    }, {
        type: 'string',
        name: 'lastname',
        rules: 'required',
        permission: 'w'
    }, {
        type: 'string',
        name: 'email',
        rules: 'required',
        permission: 'w'
    }];
}

function updateProfile() {
    this.updateLRProfile();
}

/**
 * Checks the fields from the LoginRadius update-profile form to see if any are
 * empty. If any empty fields are found they are added as key/value pairs
 * to the errors object.
 *
 * @param {{fields: Object}} errors - An object literal holding key/value pairs
 *      denoting any fields that did not validate and need to be marked as
 *      errors.
 * @returns {{fields: Object}} - Returns an updated version of the passed in
 *      errors object with any empty field errors appended to the .fields
 *      property as key/value pairs where the key is the HTML element ID, and
 *      the value is an error message to display for that field.
 */
function checkForEmptyFields(errors) {
    // Loop through the form fields and check if they have a value.
    ['firstName', 'lastName', 'email'].forEach(function (fieldId) {
        var selector = '#' + fieldId;
        var $ele = $(selector);

        if ($ele.length && !$ele.val().trim().length) {
            errors.fields[fieldId] = this.requiredFieldMsg;
        }
    });

    return errors;
}

/**
 * Used to make a POST call to LoginRadius-UpdateProfile in order to update the
 * customer's SFCC profile information to reflect any changes made to the LR
 * profile.
 *
 * @param {Object} updateData - The JSON object to be passed to the
 *      LoginRadius.js controller endpoint.
 */
function updateSFCCProfile(updateData) {
    var instance = this;
    var postUrl = this.updateProfileUrl;

    // Make call to LoginRadius-UpdateProfile, OR LoginRadius-UpdateEmail.
    $.ajax({
        url: postUrl,
        method: 'POST',
        data: updateData
    })
    .done(function (result) {
        if (result.status === 'ERROR') {
            instance.$profileErrorDiv.text(result.message);
            instance.$profileErrorDiv.show();
        } else {
            // Reset the flag so another token refresh can take place if
            // needed and redirect to the Account home page.
            instance.tokenRefreshAttempted = false;
            window.location = instance.acctHomeUrl;
        }
    })
    .fail(function (errors) {
        var errMsg = errors.length && errors[0].Description ?
            errors[0].Description : 'Error occured updating profile.';
        instance.$profileErrorDiv.text(errMsg);
        instance.$profileErrorDiv.show();
    });
}

/**
 * This function is responsible for making the call to the LoginRadius object
 * to update the LR profile. When this is complete, the updateSFCCProfile method
 * is called if the udpate was successful, and the handleLRErrors method is
 * called for error conditions.
 */
function updateLRProfile() {
    var instance = this;
    var data = {
        email: this.updateData.email,
        firstname: this.updateData.firstName,
        lastname: this.updateData.lastName
    };

    // Update the LoginRadius first & last name.
    this.LRObject.api.updateData(
        this.schema, data, this.token,
        // Success callback for LoginRadius profile update.
        function (lrNameResult) {
            var sfccUpdateData = { response: JSON.stringify(lrNameResult) };
            instance.updateSFCCProfile(sfccUpdateData);
        },
        // Failure callback for LoginRadius profile update.
        this.handleLRErrors.bind(this)
    );
}

/**
 * Displays the error message from the first error in the error collection,
 * and returns a value indicating if another attempt to update the profile data
 * should be made.
 *
 * @param {Object[]} errors - An array of error objects.
 */
function handleLRErrors(errors) {
    var instance = this;

    if (errors.length &&
        errors[0].ErrorCode === 906 &&
        !this.tokenRefreshAttempted
    ) {
        this.refreshToken(function (success) {
            // If the token refresh was successful, then try to update the
            // LoginRadius profile again.
            if (success) {
                instance.updateLRProfile();
            }
        });
    } else if (errors.length) {
        this.$profileErrorDiv.text(errors[0].Description);
        this.$profileErrorDiv.show();
    }
}

/**
 * Refreshes an expired LoginRadius access token using the controller endpoint
 * LoginRadius-RefreshToken to make a secure call to LoginRadius.
 *
 * @param {function} callback - A callback method that is executed once the new
 * access token has been stored to the SFCCProfileUpdater instance.
 */
function refreshToken(callback) {
    var refreshUrl = this.tokenRefreshUrl;
    this.tokenRefreshAttempted = true;

    $.ajax({
        url: refreshUrl,
        method: 'GET',
        data: { access_token: this.token }
    })
    .done(function (resData) {
        if (resData.access_token) {
            // Assign the new token to the instance.
            this.token = resData.access_token;

            // Store the access token in local storage variable that is used
            // by LoginRadius. Because this was refreshed from the server, it is
            // not updated automatically.
            localStorage.setItem('LRTokenKey', resData.access_token);
        }

        // If a callback was specified, pass the result to the callback.
        if (callback) {
            callback(true);
        }
    })
    .fail(function (errors) {
        if (errors.length) {
            this.$profileErrorDiv.text(errors[0].Description);
            this.$profileErrorDiv.show();
        }

        // If a callback was specified, pass the result to the callback.
        if (callback) {
            callback(false);
        }
    });
}

ProfileUpdater.prototype.refreshToken = refreshToken;
ProfileUpdater.prototype.updateSFCCProfile = updateSFCCProfile;
ProfileUpdater.prototype.checkForEmptyFields = checkForEmptyFields;
ProfileUpdater.prototype.handleLRErrors = handleLRErrors;
ProfileUpdater.prototype.updateLRProfile = updateLRProfile;
ProfileUpdater.prototype.updateProfile = updateProfile;

module.exports = ProfileUpdater;

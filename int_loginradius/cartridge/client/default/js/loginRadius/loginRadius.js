/* global LoginRadiusV2 */

'use strict';

/**
 * loginRadius.js
 *
 * @module login/loginRadius
 * Exports a constructor function that defines a loginRadius type. There are
 * also several prototype functions defined that act as a wrapper for fetching
 * LoginRadius (LR) forms that are used for customer authentication related UI
 * tasks.
 *
 * @see {@link './README.md#loginRadius'}
 *
 * The loginRadius type can be used to fetch a specific form by adding an HTML
 * data attribute to an HTML element (usually a form, input, or button) that
 * matches the HTML id attribute of a container element that the form should be
 * rendered within (usually a div or span). For an explanation of what each
 * data attribute does see the list of data attributes in the README.md file
 * located in the root directory of the int_loginradius cartridge.
 */

const LOGIN_RADIUS_DATA_ATTRIBUTES = ['type', 'key', 'enabled',
    'resetPasswordUrl'
];
const MAX_SCRIPT_LOAD_ATTEMPTS = 100;

/**
 * Creates a new LoginRadius (LR) module instance with helper methods and
 * properties for easily getting LR interfaces.
 * @constructor
 */
function loginRadius() {
    // Set default member values.
    this.enabled = false;
    this.containerIds = {};
    this.readyCallbacks = [];
}

/* Define Prototype Properties
   ========================================================================== */

/**
 *  Initializes the LoginRadius form instances for the login/registration page.
 *
 * @param {{type: string, options: Object}[]} forms - An array of form objects
 *      which consist of a single key/vlaue pair. The key represents the type
 *      of LoginRadius form that will be initialized, and value is an object
 *      literal with key/value pairs for the required service call parameters,
 *      and any callback URLs that are needed for the sepecific form type.
 */
function initForms(forms) {
    const instance = this;

    // Create an options object to configure the LoginRadiusV2 instance.
    const commonOptions = {};
    commonOptions.apiKey = instance.key;
    commonOptions.verificationUrl = window.location.href;
    commonOptions.appName = '<APP NAME>';
    commonOptions.hashTemplate = true;

    if (instance.resetPasswordUrl) {
        commonOptions.resetPasswordUrl = instance.resetPasswordUrl;
    }

    forms.forEach(function (form) {
        // Create all non-registration forms.
        if (form.type !== 'registration') {
            // Create the LoginRadiusV2 instance.
            const LRObject = new LoginRadiusV2(commonOptions);

            // Initialize all non-registration forms.
            LRObject.util.ready(function () {
                // When initializing the social login form, a custom interface
                // needs to be initialized first.
                if (form.type === 'socialLogin') {
                    // social login custom interface configuration
                    let customInterfaceOptions = {};
                    customInterfaceOptions.templateName =
                        'loginradiuscustom_tmpl';
                    LRObject.customInterface(
                        '.loginradius-social-login-interface-container',
                        customInterfaceOptions
                    );
                }

                // Initialize each form.
                LRObject.init(form.type, form.options);
                if (form.options) {
                    $(`.${form.options.container}, #${form.options.container}`).spinner().stop();
                }
            });

            // Because this form isn't loaded until the button is clicked,
            // it should not wait for the ready callback, since this has already
            // occured by the time this code is run.
            if (form.type === 'forgotPassword') {
                LRObject.init(form.type, form.options);
                if (form.options) {
                    $(`.${form.options.container}, #${form.options.container}`).spinner().stop();
                }
            }
        } else {
            // Generate single one time token (necessary for registration)
            $.ajax({
                url: $('#js-loginradius-container-registration')
                    .data(
                        'lrGenerateSottUrl'),
                success: function (data) {
                    commonOptions.sott = data.Sott;

                    var googleRecaptchaSiteKey = $('#js-loginradius-container-registration').data('lrGoogleRecaptchaSiteKey');
                    if (googleRecaptchaSiteKey.length) {
                        commonOptions.v2Recaptcha = true;
                        commonOptions.v2RecaptchaSiteKey = googleRecaptchaSiteKey;
                    }

                    // Create a new LoginRadiusV2 instance.
                    const LRObjReg = new LoginRadiusV2(
                        commonOptions);
                    // Register a callback for the LoginRadiusV2 Object instance
                    // that initializes the form when the LoginRadius code has
                    // been properly initialized.
                    LRObjReg.util.ready(function () {
                        // Initialize the form.
                        LRObjReg.init(form.type,
                            form.options);

                        if (form.options) {
                            $(`.${form.options.container}, #${form.options.container}`).spinner().stop();
                        }
                    });
                }
            });
        }
    });
}

/**
 * This is a callback function that gets executed once the LoginRadius script
 * has been loaded to the page and the global LoginRadiusV2 object has been
 * initialized for use.
 *
 * @param {function(success: bool, errorMessage: string)} callback - A
 *      callback function that gets executed once the script has loaded, or
 *      waiting for the load exceeds the maximum attempts limit.
 */
function onLRReady(callback) {
    const instance = this;

    // Check if the global LoginRadiusV2 object exists.
    if (typeof LoginRadiusV2 === 'undefined') {
        let intAttempts = 0;
        // If the LoginRadiusV2 global object is not present, then we need to
        // try to load the script again from it's source.
        const el = document.createElement('script');
        el.src = 'https://auth.lrcontent2.com/v2/js/LoginRadiusV2.js';
        el.type = 'text/javascript';
        document.getElementsByTagName('head')[0].appendChild(el);

        // Check back until the script is loaded or max attempts is reached.
        const lrloadInterval = setInterval(function () {
            var isReady = false;

            if (intAttempts > instance.maxAttempts ||
                typeof LoginRadiusV2 !== 'undefined'
            ) {
                clearInterval(lrloadInterval);

                // If the script was loaded successfully then call the success
                // callback function.
                isReady = typeof LoginRadiusV2 !== 'undefined';
                callback(isReady);

                // Call any callback methods registered to the onReady
                // instance event.
                if (instance.readyCallbacks.length) {
                    instance.readyCallbacks.forEach(function (eventCallback) {
                        eventCallback(isReady);
                    });
                }
            } else {
                intAttempts++;
            }
        }, 100);
    } else {
        callback(true);

        // Call any callback methods registered to the onReady
        // instance event.
        if (instance.readyCallbacks.length) {
            instance.readyCallbacks.forEach(
                function (eventCallback) {
                    eventCallback(true);
                }
            );
        }
    }
}

/**
 * This function provides a generic way to create a LoginRadius (LR) interface
 * by passing in a JQuery Element that triggered the initialization of the LR
 * interface (i.e. button that was pressed, or form that was submitted). This
 * context element that is passed in must have the proper HTML data attributes
 * described in the paramter docs below.
 *
 * @param {JQuery} $elements - A JQuery Element that has the HTML data attribue
 *      lrContainer (data-lr-container). This attribute's value should match the
 *      HTML id attribute for the element that the LoginRadius form should be
 *      rendered within.
 *      -- NOTE: The element used to load the interface, and the container for
 *          rendering the form can be the same element.
 */
function loadForms($elements) {
    const instance = this;
    const forms = [];

    // Get the options for all forms passed in.
    $.each($elements, function (i, ele) {
        const $ele = $(ele);
        let form = {};
        const elementData = instance.getDataFromElement($ele);
        form.type = !elementData || !elementData.type ? '' :
            elementData.type;
        form.options = instance.getOptions(form.type);
        forms.push(form);

        if (form.type !== 'socialLogin') {
            $ele.spinner().start();
        }
    });

    // Wrap the loading of the forms in a callback to ensure that the script
    // has loaded and the global object created.
    instance.onLRReady(function (scriptLoadedSuccessfully) {
        if (scriptLoadedSuccessfully) {
            instance.initForms(forms);
        } else {
            $('.js-loginradius-error-login').text('There was an error loading' +
                ' third party scripts. Please try logging in again later.');
        }
    });
}

/**
 * Gets all of the LoginRadius data attributes from an HTML element, assigns
 * them to the instance as instance variables, and assigns them to a return
 * object.
 * @param {JQuery} $ele - A JQuery Element with data attributes containing all
 *      of the necessary data to instantiate the LoginRadius interface.
 * @returns {Object} - Returns an object literal with key value pairs created
 *      from all of the data attributes prefixed with 'lr' on the passed in
 *      element.
 */
function getDataFromElement($ele) {
    const result = {};
    const instance = this;

    // Get the id of the container element if the data attribute is set.
    let containerId = $ele.data('lrContainer') ?
        $ele.data('lrContainer') : '';

    // If there is not a data attribute, then use the passed elements ID.
    if (!containerId && typeof $ele.is('[id]')) {
        containerId = $ele.attr('id');
    }

    // Get the values of any data attributes defined on the container element.
    const $container = $('#' + containerId);
    const eleData = $container.length ? $container.data() : {};

    // Get the values from any LoginRadius data attributes that exist on the
    // calling element and are included in the LOGIN_RADIUS_DATA_ATTRIBUTES
    // constant defined at the top of the code in the file.
    if (eleData) {
        Object.keys(eleData).forEach(function (key) {
            // Only interested in LoginRadius data attributes.
            if (key.indexOf('lr') > -1) {
                // If this is the data-lr-type attribute, then use the type as
                // the key storing the container element's Id.
                if (key.toLowerCase().indexOf('type') > -1) {
                    instance.containerIds[eleData[key]] = containerId;
                }

                /*
                 * Filter out any attributes that are not in the declared data
                 * fields for LoginRadius. These may be used in the callback
                 * functions, but are not needed for creating the LoginRadius
                 * form instances. This is declared as a constant at the top of
                 * this file, named: LOGIN_RADIUS_DATA_ATTRIBUTES.
                 */
                LOGIN_RADIUS_DATA_ATTRIBUTES.forEach(function (attr) {
                    if (key.toLowerCase().indexOf(attr.toLowerCase()) >
                        -1) {
                        // If the attribute is valid, then assign it as an
                        // instance member property.
                        instance[attr] = eleData[key];
                        result[attr] = eleData[key];
                    }
                });
            }
        });
    }

    return result;
}

/**
 * Gets the options object for the specified type of LRObject.init() call that
 * you are making.
 * @param {string} formType - The type of form that you are handling with the
 *      LRObject init call.
 * @returns {Object} - Returns an object literal to pass to the LRObject.init()
 *      function when creating forms for an event type. Example: forgotPassword
 */
function getOptions(formType) {
    // Get references to the correct elements.
    const errSelector = '.js-loginradius-error-' + formType.toLowerCase();
    const $errorMessaging = $(errSelector);
    const formSelector = '.js-loginradius-' + formType.toLowerCase();
    const $el = $(formSelector);
    let result = {
        container: this.containerIds[formType]
    };

    // On input, clear validation errors.
    if ($el && $el.length) {
        $el.on('input', 'input', function () {
            $errorMessaging.text('');
            $errorMessaging.hide();
        });
    }

    // Assign the matching success callback, and the generic error callback.
    result.onSuccess = this.handleResult[formType];
    result.onError = function (errors) {
        if (errors.length > 0) {
            // Map the username taken message to a more user friendly version.
            if (typeof errors[0].ErrorCode !== 'undefined' &&
                errors[0].ErrorCode === 936 &&
                typeof $errorMessaging.data('lrEmailUsedMsg') !== 'undefined'
            ) {
                errors[0].Message = $errorMessaging.data('lrEmailUsedMsg');
            }

            // Check for both because reCaptcha returns error with lowercase message field
            $errorMessaging.text(errors[0].Message || errors[0].message);
            $errorMessaging.show();

            // Scroll to the error message + 120 px for header and possibly
            // banner.
            $([document.documentElement, document.body]).animate({
                scrollTop: $errorMessaging.offset().top - 120
            }, 300);
        }
    };

    return result;
}

/**
 * Registers a callback function that will be executed when the LoginRadius
 * custom JS has been fully loaded and is ready to be interacted with.
 *
 * @param {function} callback - A callback to be executed once the LoginRadius
 *      JS script has been successfully loaded to the page. The callback should
 *      take a single boolean argument that represents the success of the script
 *      load. If the script was loaded successfully the callback will be called
 *      passing true as the parameter, and false otherwise.
 */
function onReady(callback) {
    this.readyCallbacks.push(callback);
}

// A simple object literal to hold all of the response handling methods.
const handleResult = {
    /**
     * Handles the submission of the changePassword form, validates the form,
     * then submits it to the LR API changePassword method.
     *
     * @param {Event} e - The Event context object from the form submission.
     */
    changePassword: function (e) {
        e.preventDefault();

        // Define the commonOptions object properties.
        let commonOptions = {};
        const $form = $(this);
        commonOptions.apiKey = $form.data('lrApiKey');
        commonOptions.appName = $form.data('lrSiteName');
        commonOptions.hashTemplate = true;

        // Create the LRObject instance.
        const LRChangePassObj = new LoginRadiusV2(commonOptions);

        // Init the API to call LR.
        LRChangePassObj.util.ready(function () {
            LRChangePassObj.api.init(commonOptions);
        });

        let $errorMessaging = $form.find(
            '.js-loginradius-error-changepassword');

        // Module Imports.
        const formValidation = require('base/components/formValidation');

        $form.on('input',
            '#currentPassword, #newPassword, #confirmNewPassword',
            function () {
                const $err = $('.js-loginradius-error-changepassword');
                $err.text('');
                $err.hide();
            }
        );

        // we need to do frontend form validation since loginradius is
        // not doing required field checking.
        let fieldErrors = {};
        fieldErrors.fields = {};
        const reqFieldMsg = $form.data('lrRequiredFieldMessage');

        if ($('#currentPassword').val().trim().length === 0) {
            fieldErrors.fields.currentPassword = reqFieldMsg;
        }
        if ($('#newPassword').val().trim().length === 0) {
            fieldErrors.fields.newPassword = reqFieldMsg;
        }
        if ($('#confirmNewPassword').val().trim().length === 0) {
            fieldErrors.fields.confirmNewPassword = reqFieldMsg;
        }

        // Show any field errors that were found.
        formValidation($form, fieldErrors);

        // Get the values from the form fields to pass to the server.
        let data = {
            oldpassword: $('#currentPassword').val(),
            newpassword: $('#newPassword').val(),
            confirmpassword: $('#confirmNewPassword').val()
        };

        // Call the LoginRadius API to change the user's password.
        LRChangePassObj.api.changePassword(
            data,
            // Success Handler
            function (response) {
                window.location = $form.data(
                    'lrAccountHomeUrl');
            },
            // Error Handler
            function (errors) {
                $errorMessaging = $('.js-loginradius-error-changepassword');
                // service-originating error message
                if (errors.length) {
                    if (typeof errors[0].ErrorCode !== 'undefined' &&
                        errors[0].ErrorCode === 906
                    ) {
                        const refreshUrl = $form.data('lrTokenRefreshUrl');
                        const accessToken = localStorage.getItem('LRTokenKey');

                        // Call LoginRadius-RefreshToken
                        $.ajax({
                            url: refreshUrl,
                            method: 'GET',
                            data: { access_token: accessToken }
                        })
                        .done(function (resData) {
                            if (resData.access_token) {
                                const token = resData.access_token;
                                // Store the access token back in local storage variable.
                                localStorage.setItem('LRTokenKey', token);

                                // Call the LR API again with the refreshed access token.
                                LRChangePassObj.api.changePassword(data,
                                    // Success Handler
                                    function (response) {
                                        window.location = $form.data(
                                            'lrAccountHomeUrl');
                                    },
                                    function (errors3) {
                                        if (errors3.length) {
                                            // Handle errors for 2nd try to the LRObject's
                                            // changePassword function.
                                            $errorMessaging = $('.js-loginradius-error-changepassword');
                                            $errorMessaging.text(errors3[0].Description);
                                            $errorMessaging.show();
                                        }
                                    }
                                );
                            } else if (resData.message) {
                                // Handle errors returned from the call to the
                                // LoginRadius-RefreshToken endpoint.
                                $errorMessaging = $('.js-loginradius-error-changepassword');
                                $errorMessaging.text(resData.message);
                                $errorMessaging.show();
                            }
                        })
                        .fail(function (errors2) {
                            if (errors2.message) {
                                // Handle failed call to the
                                // LoginRadius-RefreshToken endpoint.
                                $errorMessaging.text(errors2.message);
                                $errorMessaging.show();
                            }
                        });
                    } else if (typeof errors[0].ErrorCode !== 'undefined') {
                        // Handle errors from first call to LRObject.api.changePassword
                        // if the error returned was not === 906.
                        $errorMessaging.text(errors[0].Description);
                        $errorMessaging.show();
                    }
                }
            }
        );
    },

    /**
     * Handle the posted result to the LoginRadius API from the LRObject form.
     * @param {{isPosted: bool}} response - An object with a single key/value
     *      pair indicating if the request for a forgot-my-password email was
     *      successfully made.
     */
    forgotPassword: function (response) {
        const $forgotModal = $('.js-loginradius-modal-forgotpassword');

        if ($forgotModal.length) {
            const $modalBody = $forgotModal.find('.modal-content');

            if ($modalBody.length) {
                if (typeof response.IsPosted !== 'undefined' &&
                    response.IsPosted
                ) {
                    $modalBody.html(
                        `<div class="modal-header">
                            <h4 class="modal-title">forgot password</h4>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
                        </div>
                        <div class="modal-body">
                            <p>Success! Check your email for password reset instructions.</p>
                            <button type="button" class="mb-3 mt-3" data-dismiss="modal" aria-label="Close">Return to Login</button>
                        </div>
                        `
                    );
                }
            }
        }
    },

    login: function (response) {
        const $loginRadiusLoginContainer = $('#js-loginradius-container-login');
        const $loginRadiusErrorLogin = $('.js-loginradius-error-login');
        let aToken;

        // Add remember me flag from localstorage
        response.remember_me = false;
        if (typeof localStorage['lr-rememberme'] !== 'undefined' &&
            localStorage['lr-rememberme'] === 'true'
        ) {
            response.remember_me = true;
        }

        if (response.access_token) {
            aToken = response.access_token;
            // Store the access token in local storage variable that is used
            // by LoginRadius. Because this was refreshed from the server, it is
            // not updated automatically.
            localStorage.setItem('LRTokenKey', aToken);
        }

        // Make the call to the server to
        $.ajax({
            url: $loginRadiusLoginContainer.data(
                'lrLoginRegistrationUrl'),
            method: 'POST',
            data: {
                response: JSON.stringify(response)
            },
            success: function (userLoginData) {
                if (userLoginData.status === 'ERROR') {
                    $loginRadiusErrorLogin.text(
                        userLoginData.message);
                    $loginRadiusErrorLogin.show();
                    return;
                }
                window.location =
                    $loginRadiusLoginContainer.data(
                        'lrForwardingUrl');
            }
        });
    },

    registration: function (response) {
        const $loginRadiusRegistrationContainer = $(
            '#js-loginradius-container-registration');
        const $loginRadiusErrorRegistration = $(
            '.js-loginradius-error-registration');

        $.ajax({
            url: $loginRadiusRegistrationContainer.data(
                'lrLoginRegistrationUrl'),
            method: 'POST',
            data: {
                response: JSON.stringify(response)
            },
            success: function (userRegistrationData) {
                if (userRegistrationData.status === 'ERROR') {
                    $loginRadiusErrorRegistration.text(
                        userRegistrationData.message);
                    $loginRadiusErrorRegistration.show();
                    return;
                }
                window.location =
                    $loginRadiusRegistrationContainer.data(
                        'lrForwardingUrl');
            }
        });
    },

    resetPassword: function (response) {
        if (typeof response.IsPosted !== 'undefined' && response.IsPosted) {
            const $resetContainer = $('#js-loginradius-container-resetpassword');
            let URL = $resetContainer.data('lrSuccessUrl');
            URL += '?access_token=' + localStorage.getItem('LRTokenKey');

            if ($resetContainer.length) {
                $.ajax({
                    url: URL,
                    method: 'GET',
                    success: function (template) {
                        // Clear the form fields.
                        $resetContainer.find('input[type=password]').val('');

                        // Add the returned template to the page.
                        $('body').append(template);

                        const $modal = $('.js-resetpassword-success-modal');

                        // Show the hidden modal.
                        $.spinner().start();
                        $modal.show();
                        $modal.first('a.btn').focus();
                    }
                });
            }
        }
    },

    socialLogin: function (response) {
        const $loginRadiusSocialLoginContainer = $(
            '#js-loginradius-container-sociallogin');

        $.ajax({
            url: $loginRadiusSocialLoginContainer.data(
                'lrLoginRegistrationUrl'),
            method: 'POST',
            data: {
                response: JSON.stringify(response)
            },
            success: function (userRegistrationData) {
                window.location =
                    $loginRadiusSocialLoginContainer.data(
                        'lrForwardingUrl');
            }
        });
    }
};

const formInitializers = {
    changePassword: function () {
        // Register a handler method to handle the change-password form
        // submit action to do manual form validation and then submit to LR.
        const $loginRadiusChangePassword = $('#js-loginradius-changepassword');
        $loginRadiusChangePassword.submit(handleResult.changePassword);
    },

    updateProfile: function () {
        let commonOptions = {};
        const $lrUpdateProfile = $('#js-loginradius-updateprofile');
        commonOptions.apiKey = $lrUpdateProfile.data('lrApiKey');
        commonOptions.appName = $lrUpdateProfile.data('lrAppName');
        commonOptions.hashTemplate = true;

        // Create the LRObject instance.
        const LRUpdateObj = new LoginRadiusV2(commonOptions);

        // Register the callback for the LRObject instance's ready event.
        LRUpdateObj.util.ready(function () {
            // Handle submission of the LoginRadius Update-Profile form.
            $lrUpdateProfile.submit(function (e) {
                e.preventDefault();

                // Module Imports
                const formValidation = require(
                    'base/components/formValidation');
                const ProfileUpdater = require(
                    'int_loginradius/loginRadius/profileUpdater');

                // Cache refs to DOM.
                const $form = $(this);
                const $errorMessaging = $form.find(
                    '.js-loginradius-error-updateprofile');

                // Create an instance of the ProfileUpdater module.
                const profileUpdater = new ProfileUpdater($form, LRUpdateObj);

                // Add event handler to clear error messages on input.
                $form.on(
                    'input', '#firstName, #lastName, #email', function () {
                        $errorMessaging.text('');
                        $errorMessaging.hide();
                    }
                );

                // we need to do frontend form validation since loginradius is
                // not performing required field checking.
                let errors = {};
                errors.fields = {};
                errors = profileUpdater.checkForEmptyFields(errors);
                formValidation($form, errors);

                // If there are field errors, don't update the profile.
                if (Object.keys(errors.fields).length) {
                    return;
                }

                // Update the LoginRadius Profile.
                profileUpdater.updateProfile();
            });
        });
    }
};

// Assign Prototype Properties to prototype of function.
loginRadius.prototype.getOptions = getOptions;
loginRadius.prototype.formInitializers = formInitializers;
loginRadius.prototype.handleResult = handleResult;
loginRadius.prototype.initForms = initForms;
loginRadius.prototype.loadForms = loadForms;
loginRadius.prototype.getDataFromElement = getDataFromElement;
loginRadius.prototype.onLRReady = onLRReady;
loginRadius.prototype.onReady = onReady;
loginRadius.prototype.maxAttempts = MAX_SCRIPT_LOAD_ATTEMPTS;

module.exports = loginRadius;

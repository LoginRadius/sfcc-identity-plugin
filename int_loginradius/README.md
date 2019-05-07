Documentation for the LoginRadius integration cartridge: __int_loginradius__

# Summary

The LoginRadius (LR) integration cartridge can be added to an SFCC website based on the SalesForce Reference Architecture (SFRA) to override the default authentication provider. This document is intended to give an overview of the cartridge, and how it can be implemented within an SFRA site.
# Front-end JS

#### Modules List:
* [loginRadius.js](#mardown-header-loginradius-js)

## loginRadius.js

Path: __cartridge/client/default/js/loginRadius/loginRadius.js__

Exports a constructor function that defines a loginRadius type. The type instances have functions defined that act as a wrapper for fetching LoginRadius (LR) forms that are used for customer authentication related UI tasks.

When initialized, the loginRadius instance provides member methods to fetch LoginRadius (LR) interfaces by simply passing in a JQuery Element. This approach is used because it is easy to pass a calling button that was pressed, or form that was submitted, as a parameter.

### How to setup:

1. Add the cartridge to the site cartridge path.
2. Add the __int_loginradius/cartridge/client/default/js/loginRadius__ directory to the webpack build config as an alias:

```JavaScript
    resolve: {
        alias: {
            loginRadius: path.resolve(__dirname, 'int_loginradius/cartridge/client/default/js/loginRadius'),
        }
    }
```

3. Create the system attribute definitions necessary for the integration. TODO: Create export file for all necessary SFCC imports (System Object Definitions, etc.) to be included with the cartridge.


### How to use

1. #### Add a [container element](#markdown-header-container-element) with data attributes and an ID attribute to the template that needs a LoginRadius form rendered.

    1.1 If the form needs to be loaded dynamically (not on page load), add the `data-lr-container` attribute the calling element. If the form should be loaded when the page load event fires, then the js class `js-loginradius-onload` class should be added to the container element to. To get a better idea what the data attributes and `js-` classes do, take a look at the more detailed information [below](#markdown-header-data-attribute-details).

    The optional calling element can be any HTML element that you can easily reference at the place in your code where the form needs to be created. In the example below, the calling element is a button because the form needs to be created when the button gets pressed.

2. #### Import the `loginRadius` module.

    The `loginRadius` module is a constructor function that is exported as a module, so it can be included with a require statement:
    ```JavaScript
    var LoginRadius = require('login/loginRadius');
    ```
3. #### Create an instance of the `loginRadius` module.

    This can be done using the `new` keyword:
    ```JavaScript
    var loginRadius = new LoginRadius();
    ```

4. #### Call the loadForms() function for any forms that need to be created.
```JavaScript
    loginRadius: function () {
        // Cache references to DOM objects.
        var $forgotBtn = $('.js-forgot-password-btn');

        // Import the LoginRadius module.
        var LoginRadius = require('./loginRadius');
        var loginRadius = new LoginRadius();

        // Init forms that should be created on page load.
        const $elements = $('.js-loginradius-onload');
        loginRadius.loadForms($elements);

        // Add the LoginRadius click handler to the forgot-password button.
        if ($forgotBtn.length) {
            $forgotBtn.on('click.lr', function (event) {
                var $this = $(this);

                // Load the form for the forgot-password UI.
                loginRadius.loadForms([$this]);
            });
        }
    }
```


### Data Attribute Details


* #### Container Element
    The container element is the element that the created form should be renedered inside of. Which element this is should be specified by adding the container attribute with the value matching the ID of the container element.

    * __data-lr-type__: The type of LR interface to fetch. This needs to match one of the allowed LoginRadius action types (See [Documentation for LR action types here](https://docs.loginradius.com/api/v2/deployment/js-libraries/getting-started#initmethod4)).
    * __data-lr-enabled:__ A flag indicating if LR is enabled for authentication.
    * __data-lr-api-key:__ The LoginRadius API key. This is stored as a site preference named logidata-lr-nRadiusIsEnabled.
    * __data-lr-url:__ The callback URL if the user has to navigate away from the website to complete the flow (i.e. verification email, or password reset email). This is only needed for some of the form types.


    #### Data Attributes Example #1 (HTML):
    ```HTML
        <!-- DATA ATTRIBUTES EXAMPLE: Markup usage for LoginRadius form creation using a container element and the js-loginradius-onload class. -->

        <!-- Container Element -->
        <div id="lr-div"
            class="js-loginradius-onload"
            data-lr-type="forgotPassword"
            data-lr-enabled="true"
            data-lr-api-key="<your login radius API key>"
            data-lr-url="http://yoursite.com/resetpassword"
        >
            <!-- Form will be added here -->
        </div>
    ```

    #### Data Attributes Example #1 (JS):
    ```JavaScript
        /**
         * JS example usage for LoginRadius form creation with a container element.
         */
        $('.js-example-button').on('click', function(event) {
            // Import LoginRadius type
            var LoginRadius = require('./loginRadius.js');
            // Initialize an instance.
            var loginRadius = new LoginRadius();
            // Get a JQuery reference to the calling element.
            var $calling = $(this);

            // Call the initInterface() method to create the form.
            loginRadius.initInterface($calling);
        });
    ```

* #### Calling Element (Used for forms that don't load at page-load time).

    The calling element can be any HTML element that allows data attributes. It can be adventageous to add this to a button or input if you don't need to fetch the form on page load. Either the calling element with the `data-lr-container` attribute, or the Container element with the required data attributes can be passed. If a container element has the JS class `js-loginradius-onload`, then no calling element is needed, and the
    form will be initialized at the time of the page 'onLoad' event.

    * __data-lr-container:__ This attribute should be the HTML id for the element that the LR interface will be rendered within.

    #### Data Attributes Example #2 (HTML) -- With Calling Element:
    ```HTML
        <!-- DATA ATTRIBUTES EXAMPLE: Markup usage for LoginRadius form creation using a container element. -->

        <!-- Container Element -->
        <div id="lr-div"
            data-lr-type="forgotPassword"
            data-lr-enabled="true"
            data-lr-api-key="<your login radius API key>"
            data-lr-url="http://yoursite.com/resetpassword"
        >
            <!-- Form will be added here -->
        </div>

        <!-- Calling Element -->
        <button class="js-example-button" data-lr-value="forgotPassword" data-lr-container="lr-div">
            <span>forgot password...</span>
        </button>
    ```

    #### Data Attributes Example #2 (JS) -- With Calling Element:
    ```JavaScript
        /**
         * JS example usage for LoginRadius form creation with a container element.
         */
        $('.js-example-button').on('click', function(event) {
            // Import LoginRadius type
            var LoginRadius = require('./loginRadius.js');
            // Initialize an instance.
            var loginRadius = new LoginRadius();
            // Get a JQuery reference to the calling element.
            var $calling = $(this);

            // Call the initInterface() method to create the form.
            loginRadius.initInterface($calling);
        });
    ```
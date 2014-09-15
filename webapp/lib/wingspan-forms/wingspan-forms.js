(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'underscore', 'react', 'jquery', 'underscore.string', 'kendo', 'q'
        ], factory);
    } else {
        root.WingspanForms = factory(root._, root.React, root.$, root._s, root.kendo, root.Q);
    }
}(this, function (_, React, $, _s, kendo, Q) {
/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("almond", function(){});

define('ImmutableOptimizations',[
    'underscore'
], function (_) {
    'use strict';

    var ImmutableOptimizations = {
        shouldComponentUpdate: function (nextProps, nextState) {
            return !_.isEqual(nextProps, this.props) || !_.isEqual(nextState, this.state);
        }
    };

    return ImmutableOptimizations;
});

/** @jsx React.DOM */
define('controls/KendoText',[
    'underscore', 'jquery', 'react',
    '../ImmutableOptimizations'
], function (_, $, React, ImmutableOptimizations) {
    'use strict';


    return React.createClass({
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldInput'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: function () {},
                placeholder: '',
                disabled: false,
                isValid: [true, ''],
                readonly: false,
                noControl: false,
                minLength: undefined,
                maxLength: undefined,
                id: undefined
            };
        },

        render: function () {

            /*jshint ignore:start */
            return (this.props.noControl ? (React.DOM.span(null, this.props.value || '')) : (
                React.DOM.input( {className:"k-textbox", value:this.props.value || '', onChange:this.onChange,
                    placeholder:this.props.placeholder, id:this.props.id,
                    readOnly:this.props.readonly,
                    disabled:this.props.disabled} )
            ));
            /*jshint ignore:end */
        },

        onChange: function (event) {
            if (this.props.readonly) {
                return;
            }
            var val = event.target.value;
            if (this.props.maxLength && val.length > this.props.maxLength) {
                return;
            }
            this.props.onChange(val);
        }

    });

});

/** @jsx React.DOM */
define('controls/MultilineText',[
    'underscore', 'react',
    '../ImmutableOptimizations'
], function (_, React, ImmutableOptimizations) {
    'use strict';


    var MultilineText = React.createClass({displayName: 'MultilineText',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldTextarea'; } },

        getDefaultProps: function () {
            return {
                disabled: false,
                readonly: false,
                onChange: function () {},
                isValid: [true, ''],
                noControl: false,
                placeholder: '',
                minLength: undefined,
                maxLength: undefined,
                id: undefined,
                value: undefined
            };
        },

        /* jshint ignore:start */
        render: function () {
            if (this.props.noControl) {
                // Use a <pre> tag because there are newlines in the text that should be preserved.
                return (React.DOM.pre(null, this.props.value));
            }
            return (
                React.DOM.textarea( {className:"k-textbox",
                    value:this.props.value || '',
                    id:this.props.id,
                    onChange:this.onChange,
                    onBlur:this.props.onBlur,
                    placeholder:this.props.placeholder,
                    readOnly:this.props.readonly,
                    disabled:this.props.disabled} )
            );
        },
        /* jshint ignore:end */

        onChange: function (event) {
            var val = event.target.value;
            if (this.props.maxLength && val.length > this.props.maxLength) {
                return;
            }
            this.props.onChange(val);
        }

    });


    return MultilineText;
});
/** @jsx React.DOM */
define('controls/SwitchBox',[
    'underscore', 'jquery', 'react',
    '../ImmutableOptimizations'
], function (_, $, React, ImmutableOptimizations) {
    'use strict';

    var SPACE_KEY = 32;
    var SPAN_STYLE = {
        display: 'inline-block',
        height: '38px'
    };

    function ignoreClick() { }

    var SwitchBox = React.createClass({displayName: 'SwitchBox',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldSwitch'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: function () {},
                isValid: [true, ''],
                disabled: false,
                readonly: false,
                noControl: false,    // does this even make sense on a switchbox?
                id: undefined
            };
        },

        /*jshint ignore:start */
        render: function () {


            if (this.props.noControl) {
                return (React.DOM.span(null, this.getDisplayValue()));
            }

            var yes = this.props.value === true;
            var no = this.props.value === false;

            var clickYes = this.props.readonly ? ignoreClick : _.partial(this.props.onChange, true);
            var clickNo =  this.props.readonly ? ignoreClick : _.partial(this.props.onChange, false);

            // this <label> is part of the switchbox markup, not the <FormField>'s label
            // < span style={SPAN_STYLE}
            return (
                React.DOM.div( {tabIndex:"0", className:"switch"}, 
                    React.DOM.ul(null, 
                        React.DOM.li( {className:yes ? 'active' : '', onClick:clickYes}, React.DOM.span( {className:yes ? 'pos' : ''}, "Yes")),
                        React.DOM.li( {className:no ? 'active' : '', onClick:clickNo}, React.DOM.span( {className:no ? 'neg' : ''}, "No"))
                    )
                )
            );
        },
        /*jshint ignore:end */

        componentDidMount: function () {
            var self = this,
                $el = $(this.getDOMNode());

            $el.on('keypress', function (e) {
                if (e.keyCode === SPACE_KEY) {
                    self.props.onChange(!self.props.value);
                }
            });
        },

        componentWillUnmount: function () {
            $(this.getDOMNode()).off('keypress');
        },

        getDisplayValue: function () {
            return !!this.props.value ? 'Yes' : 'No'; // l10n requires thought, no locale manager all the way down here.
            // Also need to localize the switchbox images as the words "on" "off" appear.
        }
    });

    void SPAN_STYLE;

    return SwitchBox;

});

define('ControlCommon',[
    'underscore', 'jquery', 'kendo'
], function (_, $, kendo) {
    'use strict';

    var NOW = new Date();
    var DEFAULTS = kendo.ui.DateTimePicker.fn.options;

    function quadState(disabled, readonly, isValid, noControl) {
        if (noControl) {
            return 'noControl';
        } else if (disabled) {
            // disabled beats readonly
            return 'formFieldDisabled';
        } else if (readonly) {
            return 'formFieldReadonly';
        } else if (!isValid[0]) {
            return 'formFieldError';
        } else {
            return null;
        }
    }

    /**
     * Handle the unusual format used by TypeInfo for specifying the current time.
     * @param date
     * @returns {Date}
     */
    function parseDate(date) {
        return (date === 'NOW') ? NOW : date;
    }


    function setKendoDateState(kendoWidget, valueAsDate, disabled, readonly, max, min) {
        kendoWidget.value(valueAsDate);
        kendoWidget.min(parseDate(min || DEFAULTS.min));
        kendoWidget.max(parseDate(max || DEFAULTS.max));
        setKendoDisabledReadonly(kendoWidget, disabled, readonly);
    }

    function setKendoNumberState(kendoWidget, value, disabled, readonly) {
        setKendoNumberValue(kendoWidget, value);
        setKendoDisabledReadonly(kendoWidget, disabled, readonly);
    }

    function setKendoNumberValue(kendoWidget, value) {
        kendoWidget.value(value);
    }

    function setKendoDisabledReadonly(kendoWidget, disabled, readonly) {
        if (disabled) {
            // disabled beats readonly
            kendoWidget.enable(false);
        } else if (readonly) {
            kendoWidget.readonly(true);
        } else {
            kendoWidget.enable(true);
        }
    }

    function attachFormTooltips($body) {

        // The tooltip for the [i] button and the label
        $body.kendoTooltip({
            prefix: 'Info',
            filter: '.hasTooltip .formLabel',
            position: 'top',
            showOn: 'click',
            width: 320,
            content: function (e) {
                return e.target.parents('.hasTooltip').attr('data-tooltip');
            },
            show: function () {
                this.popup.element.addClass('formTooltip');
            }
        });

        // and the tooltip for invalid fields
        $body.kendoTooltip({
            prefix: 'Error',
            filter: '.hasErrorTooltip .formElement',
            position: 'bottom',
            showOn: 'mouseenter',
            showAfter: 1000,
            width: 240,
            content: function (e) {
                return e.target.parents('.formFieldError').attr('data-error-tooltip');
            },
            show: function () {
                this.popup.element.addClass('formErrorTooltip');
            }
        });
    }

    function hideErrorTooltip() {
        var $body = $('body');

        $body.data('kendoErrorTooltip').hide();
    }

    function refreshErrorTooltip() {
        var $body = $('body');
        $body.data('kendoErrorTooltip').refresh();
    }

    kendo.ui.Tooltip.fn.hide = function () {
        if (this.popup) {
            this.popup.close();
        }
        // (AHG) If we're in the middle of a delay to show the popup, we want to cancel the delayed show too.
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    };

    return {
        quadState: quadState,
        parseDate: parseDate,
        attachFormTooltips: attachFormTooltips,
        hideErrorTooltip: hideErrorTooltip,
        refreshErrorTooltip: refreshErrorTooltip,
        setKendoDateState: setKendoDateState,
        setKendoNumberState: setKendoNumberState,
        setKendoNumberValue: setKendoNumberValue,
        setKendoDisabledReadonly: setKendoDisabledReadonly
    };
});
/** @jsx React.DOM */
define('controls/KendoNumber',[
    'underscore', 'jquery', 'react', 'kendo',
    '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, ControlCommon, ImmutableOptimizations) {
    'use strict';


    var KendoNumber = React.createClass({displayName: 'KendoNumber',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldNumeric'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: function () {},
                id: undefined,

                placeholder: '',
                decimals: undefined,
                format: '',
                spinners: false,
                step: 1,

                disabled: false,
                isValid: [true, ''],
                readonly: false,
                noControl: false
            };
        },

        /*jshint ignore:start */
        render: function () {
            return (this.props.noControl
                ? (React.DOM.span(null, kendo.toString(this.props.value, this.props.format)))
                // KendoNumeric requires multiple onChange handlers, because kendo change event doesn't happen
                // until blur. We need an event on each keyup on the input, as well as spin events on the widget.
                : (React.DOM.input( {id:this.props.id, type:"text", onChange:this.onInputChange} )));
        },
        /*jshint ignore:end */

        componentDidMount: function () {
            var $el = $(this.getDOMNode());
            console.assert($el);

            if (this.props.noControl) {
                // Everything was done in JSX.
                return;
            }

            $el.kendoNumericTextBox({
                format: this.props.format,
                min: this.props.min,
                max: this.props.max,
                step: this.props.step,
                spinners: this.props.spinners,
                // No change event - we get change events from the underlying react <input>,
                // because react gives us an onChange for each keystroke which is needed for flux
                spin: this.onSpinChange
            });

            ControlCommon.setKendoNumberState(
                $el.data('kendoNumericTextBox'),
                this.props.value, this.props.disabled, this.props.readonly);
        },

        componentDidUpdate: function (prevProps, prevState) {
            var $el = $(this.getDOMNode());
            console.assert($el);

            if (this.props.noControl) {
                // Everything was done in JSX.
                return;
            }

            var kendoWidget = $el.data('kendoNumericTextBox');

            if (prevProps.value !== this.props.value) {
                ControlCommon.setKendoNumberValue(kendoWidget, this.props.value);
            }
            if (
                (prevProps.disabled !== this.props.disabled) ||
                (prevProps.readonly !== this.props.readonly)
            ) {
                ControlCommon.setKendoDisabledReadonly(kendoWidget, this.props.disabled, this.props.readonly);
            }
        },

        onSpinChange: function (event) {
            var val = event.sender.value();
            this.props.onChange(val);
        },

        onInputChange: function (event) {
            if (this.props.readonly) {
                return;
            }
            var val = event.target.value;
            this.props.onChange(val);
        }
    });

    return KendoNumber;

});

define('util/util',[
    'underscore', 'underscore.string', 'jquery', 'kendo'
], function (_, str, $, kendo) {
    'use strict';

    var exports = {};

    exports.orElse = function (value, fallback) {
        return _(value).isBlank() ? fallback : value;
    };

    /**
     * perform multiple requests in parallel, returning a Promise[Map[Key, Response]]
     * @fBuildUrl function that can build a URL from a key
     * @fAsyncRequest function of one argument that returns a promise
     * @keys the things to load, that fBuildUrl can build a URL from
     *
     * use case: takes a list of componentIDs to load, relative to componentRoot
     * returns a promise to the map of (ComponentID -> componentCfg)
     */
    exports.asyncParallel = function (fBuildUrl, fAsyncRequest, keys) {
        var responses = {};
        var asyncLoadOne = function (key) {
            var url = fBuildUrl(key);
            return fAsyncRequest(url).then(function (data) {
                responses[key] = data;
            });
        };
        var promises = _.map(keys, asyncLoadOne);
        return Q.all(promises).then(function () {
            return responses;
        });
    };
    /**
     * functional map over js objects:
     *
     *     var m={'a': 10, 'b': 20, 'c': 30};
     *     mapo(m, function(v,k){return [k, v+1];});
     *
     *       => {"a":11,"b":21,"c":31}
     */
    exports.mapo = _.compose(_.object, _.map);
    exports.identity = function (o) {
        return o;
    };

    /**
     * Util method to retrieve a field from the typeInfo since it may be nested and not directly accessible
     * @param fieldName name of the field
     * @param typeInfo typeInfo for the data
     * @returns {the found entry in typeInfo or throws}
     */
    exports.findFieldInfo = function (fieldName, typeInfo) {
        var fieldInfo = typeInfo.properties[fieldName];
        if (!fieldInfo) {
            fieldInfo = _.chain(typeInfo.types)
                .values()
                .pluck('properties')
                .compact()
                .pluck(fieldName)
                .value();

            fieldInfo = _.isArray(fieldInfo) ? fieldInfo[0] : fieldInfo;
        }
        console.assert(_.isObject(fieldInfo), 'Unable to find fieldInfo for: ' + fieldName);
        return fieldInfo;
    };

    /**
     * Converts a value of a typed object from the server into a display. This will usually be Orm Data
     * @param value value to convert (could be string, bool, etc, or complex type user, dictionary, enum, etc...)
     * @param fieldName name of the field
     * @param typeInfo typeInfo of the
     * @param localeManager locale manager.
     * @returns {*}
     */
    exports.typedObjectValueToDisplayValue = function (value, fieldName, typeInfo, localeManager) {
        if (null === value || undefined === value) {
            return '';
        }
        var fieldInfo = exports.findFieldInfo(fieldName, typeInfo);
        return exports.typedObjectValueToDisplayValue2(value, fieldName, fieldInfo, localeManager);
    };

    exports.typedObjectValueToDisplayValue2 = function (value, fieldName, fieldInfo, localeManager) {
        if (null === value || undefined === value) {
            return '';
        }
        console.assert(_.isObject(fieldInfo), 'Unable to find fieldInfo for: ' + fieldName);
        // not sure why _.isArray not working - JY
        if (_.isArray(value) || (value.length !== undefined && value.push !== undefined && value.pop !== undefined)) {
            return _.map(value, function (v) { return exports.typedObjectValueToDisplayValue2(v, fieldName, fieldInfo, localeManager); }).join(', ');
        }

        var dataType = fieldInfo.dataType;
        if ('text' === dataType) {
            return value;
        }
        if ('number' === dataType) {
            return value;
        }
        if ('boolean' === dataType) {
            return localeManager.localize(value === true ? 'true' : 'false');
        }

        // TODO DATE NEEDS TO COME FROM SERVER CONFIGURATION
        if ('datetime' === dataType && _.isString(value)) {
            return kendo.toString(value, 'dd-MMM-yyyy h:mm tt');
        }
        // todo need to be able to handle date only fields here
        if ('date' === dataType && _.isString(value)) {
            return kendo.toString(value, 'dd-MMM-yyyy');
        }

        // so it's a complex object, and we'll just try to sort it out at the moment
        // we probably want to try to add the names of the id and display fields to the typeinfo to make this much more explicit
        if (value.displayName !== undefined) {  // userorgroup
            return value.displayName;
        }
        if (value.fullName !== undefined) {  // users
            return value.fullName;
        }
        if (value.name !== undefined) {
            return value.name;
        }
        if (value.value !== undefined) {
            return value.value;
        }
        if (value.id !== undefined) {
            return value.id;
        }
        return value;
    };

    exports.typedObjectValueToValueField = function (value) {
        if (!!value.id) {
            return value.id;
        }
        if (!!value.value) {
            return value.value;
        }
        return exports.hashRecord(value);
    };

    /**
     * Searches for data attributes by name and value, i.e. data-[name]="[value]".
     * This returns all found elements. It does not assert on the number returned.
     */
    function findData(html, name, value) {
        if (_.isUndefined(html) || _.isNull(html)) {
            throw 'No html for findData.';
        }
        if (_.isUndefined(name) || _.isNull(name) || '' === name) {
            throw 'Attribute name required for findData.';
        }
        if (_.isUndefined(value) || _.isNull(value) || '' === value) {
            throw 'Attribute value required for findData.';
        }
        var attr = 'data-' + name;
        return html.find('[' + attr + '=\'' + value + '\']');
    }

    exports.findData = findData;
    /**
     * Searches for tagged attributes (data-wspt-[key]="[value]") in the target dom.  Fails if a single, unique element is not found.
     * @param html the html to search.
     * @param key the suffix to data-wspt-
     * @param value The value of the data-snippet attribute.
     */
    function snippet(html, key, value) {
        // if we used this value without checking findData would not complain.
        if (_.isUndefined(key) || _.isNull(key) || '' === key) {
            throw 'Key required for snippet.';
        }
        var q = findData(html, 'wspt-' + key, value);
        if (1 !== q.size()) {
            var sErr = str.sprintf('Expected one target at `%s`=`%s` but found `%s` in the current DOM.', key, value, q.size());
            debugger;
            throw sErr;
        }
        return q;
    }

    exports.snippet = snippet;
    /**
     * Attempts to show some HTML as a string.
     */
    function showHTML(h) {
        try {
            return $('<div/>').append(h).html();
        }
        catch (e) {
            // Since we only call this when we're in trouble (e.g. about to throw an exception) in makes sense to
            // just leave this debugger statement in.
            debugger;
            return str.sprintf('Can\'t show HTML: %s\n%s', h, _.escape(e.toString()));
        }
    }

    exports.showHTML = showHTML;
    /**
     * Represent an object as a JSON string.  This can easily fail for complicated/recursive JSON objects.
     * @param o an object.
     */
    function showObject(o) {
        try {
            return JSON.stringify(o);
        }
        catch (e) {
            // Since we only call this when we're in trouble (e.g. about to throw an exception) it makes sense to just leave this debugger statement in.
            debugger;
            return str.sprintf('Can\'t show JSON: %s\n%s', o, _.escape(e.toString()));
        }
    }

    exports.showObject = showObject;
    function barf(msg /* ... */) {
        void msg;
        var arr = Array.prototype.slice.call(arguments, 0);
        arr.unshift(false);
        debugger;
        console.assert.apply(null, arr);
    }

    exports.barf = barf;
    function test(cond, msg /* ... */) {
        void msg;
        if (! cond) {
            barf.apply(null, _.tail(arguments));
        }
    }

    exports.test = test;
    /**
     * Asserts that a reference is defined and not null or throws the message.
     * This returns the object being tested which makes for a very convenient formulation of test and extract, which we do a lot of.
     * @param o The object to test.
     * @param msg The message to throw.
     * @returns o
     */
    function exists(o, msg /* ... */) {
        void msg;
        _.partial(test, ! (_.isUndefined(o) || _.isNull(o))).apply(null, _.tail(arguments));
        return o;
    }

    exports.exists = exists;

    /**
     * Asserts that object o has field named m (with something in it).
     * @param object the containing object.
     * @param fieldName the name of the field (which will also be used in any thrown errors).
     * @returns {*} The field.
     */
    function fieldExists(object, fieldName) {
        return _.partial(exists, object[fieldName]).call(null, 'Missing: \'%s\'', fieldName);
    }

    exports.fieldExists = fieldExists;

    function hasField(object, fieldName) {
        var field = object[fieldName];
        return ! (_.isUndefined(field) || _.isNull(field));
    }

    exports.hasField = hasField;

    /**
     * We commonly get array of id based objects and need to look them up by id.
     * To this end, this function takes an array and converts it to an object whose fields are named by the id fields in the array elements.
     * The fields' values are the individual corresponding array elements.
     * @param array
     * @returns {*}
     */
    function arrayToMap(array) {
        if (! _.isArray(array)) {
            throw 'Array required.';
        }
        return _.reduce(array, function (obj, item) {
            var id = exists(item.id, 'missing id');
            if (undefined !== obj[id]) {
                throw 'Duplicate id ' + id + ' in array mapping.';
            }
            obj[id] = item;
            return obj;
        }, {});
    }

    exports.arrayToMap = arrayToMap;

    /**
     * Finds all the elements with tooltip content, sees if they've been localized, localizes them.
     * @param The html to scour.
     * @localeManager to handle the localization.
     */
    exports.updateTooltips = function ($el, localeManager) {
        var dataTT = 'tooltip-content';
        // this prefix indicates that the tooltip has not been localized.
        var pref = 'l10n:';
        var tooltips = $el.find('[data-' + dataTT + ']');
        _.each(tooltips, function (tooltip) {
            var elem = $(tooltip);
            var tt = elem.data(dataTT);
            if (0 === tt.indexOf(pref)) {
                var t = tt.substring(pref.length);
                var r = localeManager.localize(t);
                elem.attr('data-' + dataTT, r);
            }
        });
    };
    /**
     * Makes the page busy and then makes it unbusy when the promise finished (reject or fulfilled).
     * @param promise
     * @return {promise} The promise for fluency.
     */
    exports.busyPromise = function (promise) {
        $('html').addClass('busy');
        promise.fin(function () {
            $(this).removeClass('busy');
        });
        return promise; // fluency
    };


    /**
     * Hash of a javascript string
     *
     * http://stackoverflow.com/a/7616484/20003
     */
    exports.hashString = function (str) {
        var hash = 0, i, ch, l;
        if (str.length === 0) {
            return hash;
        }
        for (i = 0, l = str.length; i < l; i++) {
            ch  = str.charCodeAt(i);
            hash  = ((hash << 5) - hash) + ch;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    exports.hashRecord = function (record) {
        return exports.hashString(JSON.stringify(record));
    };


    /*
     All this stuff should be in underscore. :(
     */
    function prependToAll(x, xs) {
        if (0 === xs.length) {
            return xs;
        } else {
            return [x, _.head(xs)].concat(prependToAll(x, _.tail(xs)));
        }
    }
    exports.prependToAll = prependToAll;


    function intersperse(x, xs) {
        if (0 === xs.length) {
            return xs;
        } else {
            return [_.head(xs)].concat(prependToAll(x, _.tail(xs)));
        }
    }
    exports.intersperse = intersperse;

    /**
     * Turns an array into a comma separated string of its items.
     * @param items An array of items or a single item.
     * @returns {string}
     */
    function commaSeparateList(items) {
        var str = '';
        var first = true;
        if (_.isArray(items)) {
            _.each(items, function (item) {
                if (first) { first = false; }
                else { str += ', '; }
                str += item;
            });
        } else {
            str += items;
        }
        return str;
    }
    exports.commaSeparateList = commaSeparateList;

    function firstWhere(array, selector) {
        function impl(n) {
            if (n >= array.length) {
                return null;
            }
            if (selector(array[n])) {
                return array[n];
            }
            return impl(n + 1);
        }
        return impl(0);
    }
    exports.firstWhere = firstWhere;

    function deepClone(obj) {
        // Harness the native JSON code in the browser to efficiently copy all the data
        return JSON.parse(JSON.stringify(obj));
    }
    exports.deepClone = deepClone;

    function containsDeep(haystack, needle) {
        return !!_.find(haystack, function (h) {
            return _.isEqual(h, needle);  // deep value equality
        });
    }
    exports.containsDeep = containsDeep;

    function uniqueDeep(xs) {
        return _.reduce(xs, function (acc, x) {
            return (!containsDeep(acc, x)
                ? acc.concat(x) // this returns a new array, does not mutate inline
                : acc);
        }, []);
    }
    exports.uniqueDeep = uniqueDeep;

    /**
     *    _.union([{b:2}, {a: 1}], [{a: 1}]);   // => set of length 3 due to reference equality (bad!)
     *    util.unionDeep([{b:2}, {a: 1}], [{a: 1}]);   //=> [{b:2}, {a: 1}]   (proper length, value equality)
     */
    exports.unionDeep = function (/* set1, set2, ... */) {
        return uniqueDeep(_.flatten(arguments));
    };

    /**
     * util.differenceDeep([{z: 0}, {b: 2}, {a: 3}], {a: 3}, {z: 0})   // => [{b: 2}]
     */
    exports.differenceDeep = function (/* set1, set2, ... */) {
        var removeTheseItems = _.flatten(_.tail(arguments));
        var fromTheseItems = _.head(arguments);
        return _.filter(fromTheseItems, function (x) {
            // if the current item in the first set exists in any of the other sets,
            // it should not be in the difference.
            var shouldRemove = containsDeep(removeTheseItems, x);
            return !shouldRemove;
        });
    };

    /**
     * @param record  "JSON" or "POJO" value which will have his fields filtered by the predicate
     * @param predicate which will be passed one argument, a list [key, value]
     * @returns new record with fewer keys
     *
     *
     *   filterRecordKeys( {}, function (pair)
     *
     */
    exports.filterRecordKeys = function (record, predicate) {
        return _.object(_.filter(_.pairs(record), predicate));
    };

    /**
     * Return all elements from records whose id properties are not found in the ids list
     *
     * @param records
     * @param ids
     * @returns {*}
     */
    exports.differenceById = function (records, ids) {
        return _.reject(records, function (record) {
            return _.contains(ids, record.id);
        });
    };

    /**
     * Return a copy of `original` with undefined values filled in from `defaults`.
     */
    exports.defaults = function (original, defaults, predicate) {
        predicate = predicate || _.isUndefined;

        var copy = _.extend({}, original);
        for (var prop in defaults) {
            if (predicate(original[prop])) {
                copy[prop] = defaults[prop];
            }
        }
        return copy;
    };


    var ISO_DATE_ONLY = 'yyyy-MM-dd';
    exports.formatISODate = function (date) {
        return kendo.toString(date, ISO_DATE_ONLY);
    };
    exports.formatISODateTime = function (date) {
        return date.toISOString();
    };
    exports.parseISODate = function (dateStr) {
        return kendo.parseDate(dateStr, ISO_DATE_ONLY);
    };
    exports.parseISODateTime = function (dateStr) {
        return new Date(Date.parse(dateStr));
    };

    return exports;
});

/** @jsx React.DOM */
define('controls/KendoDatetime',[
    'underscore', 'jquery', 'react', 'kendo',
    '../util/util',
    '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, util, ControlCommon, ImmutableOptimizations) {
    'use strict';


    var KendoDateTime = React.createClass({displayName: 'KendoDateTime',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldDatetimepicker'; } },

        getDefaultProps: function () {
            return {
                value: undefined, // ISO 8601 string, NOT a js date instance
                onChange: function () {},
                id: undefined,
                disabled: false,
                isValid: [true, ''],
                readonly: false,
                noControl: false,
                format: 'MM/dd/yyyy h:mm tt'
            };
        },

        /*jshint ignore:start */
        render: function () {
            return (this.props.noControl
                ? (React.DOM.span(null, this.props.value ? kendo.toString(util.parseISODateTime(this.props.value), this.props.format) : ''))
                : (React.DOM.input( {id:this.props.id, type:"text"} )));
        },
        /*jshint ignore:end */

        componentDidMount: function () {

            if (this.props.noControl) {
                // Everything was done in JSX.
                return;
            }

            var $el = $(this.getDOMNode());

            $el.kendoDateTimePicker({
                change: this.onChange,
                format: this.props.format
            });

            ControlCommon.setKendoDateState(
                $el.data('kendoDateTimePicker'),
                util.parseISODateTime(this.props.value), this.props.disabled, this.props.readonly,
                this.props.max, this.props.min);
        },

        componentDidUpdate: function (prevProps, prevState) {

            if (this.props.noControl) {
                // Everything was done in JSX.
                return;
            }

            var $el = $(this.getDOMNode());

            ControlCommon.setKendoDateState(
                $el.data('kendoDateTimePicker'),
                util.parseISODateTime(this.props.value), this.props.disabled, this.props.readonly,
                this.props.max, this.props.min);
        },

        onChange: function (event) {
            var kendoWidget = event.sender;
            var val = util.formatISODateTime(kendoWidget.value());
            this.props.onChange(val);
        }
    });

    return KendoDateTime;
});

/** @jsx React.DOM */
define('controls/KendoDate',[
    'underscore', 'jquery', 'react', 'kendo',
    '../util/util',
    '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, util, ControlCommon, ImmutableOptimizations) {
    'use strict';


    var KendoDate = React.createClass({displayName: 'KendoDate',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldDatepicker'; } },

        getDefaultProps: function () {
            return {
                format: 'dd-MMM-yyyy',
                value: undefined,
                id: undefined,
                onChange: function () {},
                disabled: false,
                isValid: [true, ''],
                readonly: false,
                noControl: false
            };
        },

        /*jshint ignore:start */
        render: function () {
            return (this.props.noControl
                ? (React.DOM.span(null, this.props.value ? kendo.toString(util.parseISODate(this.props.value), this.props.format) : ''))
                : (React.DOM.input( {id:this.props.id, type:"text"} )));
        },
        /*jshint ignore:end */

        componentDidMount: function () {

            if (this.props.noControl) {
                // Everything was done in JSX.
                return;
            }

            var $el = $(this.getDOMNode());
            console.assert($el);

            $el.kendoDatePicker({
                change: this.onChange,
                format: this.props.format
            });

            ControlCommon.setKendoDateState(
                $el.data('kendoDatePicker'),
                util.parseISODate(this.props.value), this.props.disabled, this.props.readonly,
                this.props.max, this.props.min);
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (this.props.noControl) {
                // Everything was done in JSX.
                return;
            }

            var $el = $(this.getDOMNode());
            console.assert($el);

            ControlCommon.setKendoDateState(
                $el.data('kendoDatePicker'),
                util.parseISODate(this.props.value), this.props.disabled, this.props.readonly,
                this.props.max, this.props.min);
        },

        onChange: function (event) {
            var kendoWidget = event.sender;
            var val = util.formatISODate(kendoWidget.value());
            this.props.onChange(val);
        }
    });

    return KendoDate;
});

/** @jsx React.DOM */
define('controls/KendoComboBox',[
    'underscore', 'jquery', 'react', 'kendo',
    '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, ControlCommon, ImmutableOptimizations) {
    'use strict';


    function getDisplayValue(value, displayField) {
        return _.isObject(value) ? value[displayField] : '';
    }

    function setComboValue(comboWidget, props) {
        var value = props.value;

        // (AHG) If we have an object (with both display text and value), set both the text and the value. The value needs to be set
        // so the widget knows if the value changes and needs to fire the event. The text needs to be set in case the store has no
        // data.
        if (_.isObject(value)) {
            comboWidget.value(value[props.valueField]);
            comboWidget.text(value[props.displayField]);
        }
        else if (value !== undefined) {
            comboWidget.value(value);

            // We are papering over a bug in kendo ComboBox wherein it doesn't refresh its html representation of the
            // old dataSource models when it gets a new dataSource but no value was previously set.
            // When a truthy value is passed into the comboWidget.value(), the comboWidget will fetch() the dataSource,
            // refresh()-ing itself as well.
            if (!value) {
                comboWidget.refresh();
            }
        }
    }

    var KendoComboBox = React.createClass({displayName: 'KendoComboBox',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldCombobox'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: $.noop,
                id: undefined,
                displayField: undefined,
                valueField: undefined,
                dataSource: undefined,
                template: undefined,
                filter: 'startswith',
                width: null, // use default width whatever that is...
                disabled: false,
                readonly: false,
                noControl: false,
                placeholder: ''
            };
        },

        componentWillMount: function () {
            console.assert(this.props.displayField);
            console.assert(this.props.valueField);

            if (!this.props.noControl) {
                console.assert(this.props.dataSource);
            }
        },

        /*jshint ignore:start */
        render: function () {
            return (this.props.noControl
                ? (React.DOM.span( {id:this.props.id}, getDisplayValue(this.props.value, this.props.displayField)))
                : (React.DOM.select( {id:this.props.id})));
        },
        /*jshint ignore:end */

        componentDidMount: function () {
            var $el = $(this.getDOMNode()),
                props = this.props;

            if (props.noControl) {
                this.setNoControlValue($el);
            }
            else {
                if (props.width) {
                    $el.width(props.width);
                }
                $el.kendoComboBox({
                    autoBind: false,
                    filter: this.props.filter,
                    highlightFirst: false,
                    dataTextField: props.displayField,
                    dataValueField: props.valueField,
                    dataSource: props.dataSource,
                    placeholder: props.placeholder,
                    template: props.template,
                    change: this.onChange
                });

                setComboValue($el.data('kendoComboBox'), props);
                ControlCommon.setKendoDisabledReadonly($el.data('kendoComboBox'), props.disabled, props.readonly);
            }
        },

        componentWillUnmount: function () {
            var kendoWidget = $(this.getDOMNode()).data('kendoComboBox');

            if (kendoWidget) {
                kendoWidget.destroy();
            }
        },

        componentWillReceiveProps: function (nextProps) {
            var cantChange = ['template', 'valueField', 'displayField', 'placeholder', 'filter'];
            console.assert(_.isEqual(_.pick(nextProps, cantChange), _.pick(this.props, cantChange)), 'these props cant change after mount');
        },

        componentDidUpdate: function (prevProps, prevState) {
            var $el = $(this.getDOMNode())

            if (this.props.noControl) {
                this.setNoControlValue($el);
            }
            else {
                var kendoWidget = $el.data('kendoComboBox');

                if (prevProps.dataSource !== this.props.dataSource) {
                    kendoWidget.setDataSource(this.props.dataSource);
                }

                setComboValue(kendoWidget, this.props);
                ControlCommon.setKendoDisabledReadonly(kendoWidget, this.props.disabled, this.props.readonly);
            }
        },

        onChange: function (event) {
            var model = event.sender.dataItem();

            // pass up the same structure as was originally passed down to us.
            var nextValue;
            if (_.isString(this.props.value) || _.isNumber(this.props.value)) {
                nextValue = (model ? model.get(this.props.valueField) : model);
            } else {
                // Do not return the internal kendo model objects, since they're an implementation detail of the combo/store.
                nextValue = (model instanceof kendo.data.Model) ? model.toJSON() : model;
            }

            // the KendoCombo maintains its own value state, which has just been set by a user interaction,
            // and in fact we just extracted the value from the model. Rewind the state to the prior value,
            // to support the Flux loop, it will be set if the controller accepts the change.
            setComboValue($(this.getDOMNode()).data('kendoComboBox'), this.props);

            this.props.onChange(nextValue);
        },

        setNoControlValue: function ($el) {

            if (_.contains(['', null, undefined], this.props.value)) {
                $el.text('');
                return;
            }

            // If the value is just an ID, we need to fetch data from the server to get the display value.
            if (!_.isObject(this.props.value)) {
                // However, if the ID is the display value, we can use it as is.
                if (this.props.valueField === this.props.displayField) {
                    $el.text(this.props.value);
                    return;
                }
                var self = this;
                this.props.dataSource.fetch().then(function () {
                    $el.text(getDisplayValue(self.props.dataSource.get(self.props.value), self.props.displayField));
                }).done();
            }
            else {
                // valueAsOption, so can skip the query.
                $el.text(getDisplayValue(this.props.value, this.props.displayField));
            }
        }
    });

    void getDisplayValue;
    void KendoComboBox;

    return KendoComboBox;
});

/** @jsx React.DOM */
define('controls/UserPicker',[
    'underscore', 'jquery', 'react', 'kendo',
    '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, controlCommon, ImmutableOptimizations) {
    'use strict';

    void controlCommon;
    var userPickerTemplate = '<div class="user"># if ((typeof currentlyOutOfOffice !== "undefined" && currentlyOutOfOffice) || (typeof status !== "undefined" && status) === "UNAVAILABLE") { #<div class="outOfOffice"></div># } #<p class="fullName">#: fullName #</p><p class="emailAddress">#: emailAddress #</p></div>';

    var UserPicker = React.createClass({displayName: 'UserPicker',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldAutocomplete'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: function () {},
                id: undefined,
                placeholder: 'Select User...', // l10n requires thought, no strings down here
                template: userPickerTemplate,
                dataTextField: 'nameOrEmail',
                listClass: 'userPicker',
                disabled: false,
                isValid: [true, ''],
                readonly: false,
                noControl: false
            };
        },

        componentWillMount: function () {
            console.assert(this.props.dataSource);
        },

        componentDidMount: function () {
            var $el = $(this.getDOMNode());

            var header = $('<h2></h2>'),
                autoComplete;

            $el.kendoAutoComplete({
                dataSource: this.props.dataSource,
                dataTextField: this.props.dataTextField,
                placeholder: this.props.placeholder,
                highlightFirst: true,
                suggest: false,
                template: this.props.template,
                close: function (e) {
                    var widget = e.sender;
                    // Don't close the picker on an empty search result because we want to tell the user about it.
                    if (widget._typing && widget.dataSource.total() === 0) {
                        e.preventDefault();
                    }
                },
                dataBound: function (e) {
                    var widget = e.sender,
                        dataSource = widget.dataSource;

                    header.text(dataSource.message);

                    if (dataSource.total() === 0) {
                        widget.popup.open();
                    }
                },
                change: this.onChange,
                select: this.onSelect
            }).on('blur', this.onBlur);

            autoComplete = $el.data('kendoAutoComplete');

            if (this.props.listClass) {
                // Add a special class to the popup element so we can style the list items
                autoComplete.list.addClass(this.props.listClass);
            }

            if (this.props.value) {
                autoComplete.value(this.props.value.fullName);
            }
            if (this.props.disabled) {
                autoComplete.enable(false);
            }
            else if (this.props.readonly) {
                autoComplete.readonly(true);
            }
            // Add an element to contain some text above the list of users
            header.prependTo(autoComplete.list);
        },

        componentWillUnmount: function () {
            var $el = $(this.getDOMNode());

            $el.data('kendoAutoComplete').destroy();
        },

        componentDidUpdate: function (prevProps, prevState) {
            var $el = $(this.getDOMNode()),
                autoComplete = $el.data('kendoAutoComplete');

            if (prevProps.dataSource !== this.props.dataSource) {
                autoComplete.setDataSource(this.props.dataSource);
            }

            autoComplete.value(this.props.value ? this.props.value.fullName : null);

            if (this.props.disabled) {
                autoComplete.enable(false);
            }
            else {
                autoComplete.readonly(this.props.readonly);
            }
        },

        onBlur: function (e) {
            var autoComplete = $(e.target).data('kendoAutoComplete');

            if (autoComplete) {
                // Always reset the text back to the current value, in case they typed stuff that didn't match anything
                autoComplete.value(this.props.value ? this.props.value.fullName : null);
            }
        },

        /*jshint ignore:start */
        render: function () {
            console.assert(!this.props.noControl);
            return (React.DOM.input( {type:"text", id:this.props.id, className:"k-textbox"}));
        },
        /*jshint ignore:end */

        onChange: function (e) {
            var widget = e.sender;

            if (widget.dataSource.total() === 1) {
                // Exact match - so raise the change event
                this.props.onChange(widget.dataItem(0));
            }
        },
        onSelect: function(e) {
            var widget = e.sender;
            this.props.onChange(widget.dataItem(e.item.index()));
        }
    });

    return UserPicker;

});

define('AutoControl',[
    'underscore', 'react',
    './controls/KendoText',
    './controls/MultilineText',
    './controls/SwitchBox',
    './controls/KendoNumber',
    './controls/KendoDatetime',
    './controls/KendoDate',
    './controls/KendoComboBox',
    './controls/UserPicker',
    './ImmutableOptimizations'
], function (_, React, KendoText, MultilineText, SwitchBox, KendoNumber, KendoDatetime, KendoDate, KendoComboBox,
             UserPicker, ImmutableOptimizations) {
    'use strict';

    var TYPE_TO_CONTROL = {
        'text' : KendoText,
        'text:multiLine' : MultilineText,
        'number' : KendoNumber,
        'date' : KendoDate,
        'datetime' : KendoDatetime,
        'boolean' : SwitchBox
    };
    var CONTROL_PROPS = ['id', 'value', 'onChange', 'isValid', 'disabled', 'noControl'];

    function controlForField(fieldInfo) {
        var dataType = fieldInfo.dataType;

        if (fieldInfo.options) {
            if (dataType === 'User') {
                return UserPicker;
            }
            else {
                return KendoComboBox;
            }
        }
        if (fieldInfo.multiLine) {
            dataType = dataType + ':multiLine';
        }

        return TYPE_TO_CONTROL[dataType];
    }

    var AutoControl = React.createClass({
        mixins: [ImmutableOptimizations],

        statics: {
            /**
             * Static method needed by FormField to determine the underlying field class for the generated control.
             *
             * @param fieldInfo
             * @returns {*}
             */
            fieldClassForField: function (fieldInfo) {
                return controlForField(fieldInfo).fieldClass();
            }
        },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: undefined,
                dataSource: undefined, // optional, usually comes as fieldInfo.options.dataSource. Only use here if the fieldInfo is stored in react state and you don't want to put a DataSource in react state.
                id: undefined,
                fieldInfo: undefined,
                isValid: [true, ''],
                disabled: false,
                readonly: false,
                noControl: false
            };
        },

        render: function () {
            var fieldInfo = this.props.fieldInfo;
            var Control = controlForField(fieldInfo);
            var controlProps = _.pick(this.props, CONTROL_PROPS);

            controlProps.name = fieldInfo.name; // to help with debugging in the presence of asynchronous rendering

            // Add placeholder text
            controlProps.placeholder = fieldInfo.placeholder;

            // Either fieldInfo or parent component can specify readonly status
            controlProps.readonly = this.props.readonly || fieldInfo.readOnly;

            // Add in some constraints from typeInfo
            controlProps.min = fieldInfo.minValue;
            controlProps.max = fieldInfo.maxValue;
            controlProps.step = fieldInfo.stepValue;
            controlProps.minLength = fieldInfo.minLength;
            controlProps.maxLength = fieldInfo.maxLength;

            if (fieldInfo.options) {
                controlProps.dataSource = this.props.dataSource || fieldInfo.options.dataSource;
                controlProps.valueField = fieldInfo.options.metadata.idProperty;
                controlProps.displayField = fieldInfo.options.metadata.nameProperty;
            }

            return Control(controlProps);
        }
    });

    return AutoControl;
});

/*
    fieldInfo looks like this:

{
    "name": "tmfItemId",
    "label": "ID",
    "dataType": "text",
    "placeholder": "100.02",
    "helpText": "Unique identifier for the List Item (####.##)",
    "array": false,
    "readonly": false,
    "required": true,
    "multiLine": false,
    "options": null,
    "maxLength": 32,
    "minLength": 32,
    "pattern": "^[a-zA-Z0-9]{1,5}\\.[a-zA-Z0-9]{1,3}$",
    "maxValue": null,
    "minValue": null,
    "decimals": 0,
    "stepValue": 1.0
}
*/
;
/** @jsx React.DOM */
define('FormField',[
    'underscore', 'react',
    './AutoControl',
    './ControlCommon',
    './ImmutableOptimizations'
], function (_, React, AutoControl, ControlCommon, ImmutableOptimizations) {
    'use strict';

    function determineFieldClass(children) {
        if (_.isArray(children)) {
            children = children[0];
        }

        if (children && _.isUndefined(children.type.fieldClass)) {
            // Support a textnode child, which won't have a fieldinfo
            if (children.props && children.props.fieldInfo) {
                return AutoControl.fieldClassForField(children.props.fieldInfo);
            }
            //console.warn('Unknown fieldClass for child component', children);

            return 'formFieldInput';
        }

        return children && children.type.fieldClass();
    }

    var FormField = React.createClass({displayName: 'FormField',
        mixins: [ImmutableOptimizations],

        getDefaultProps: function () {
            return {
                fieldInfo: {},
                layout: 'formField',
                noControl: false,
                isValid: [true, ''],
                lockable: false,
                locked: false,
                onStickyChange: function (isLocked) { /* set or clear a sticky */},
                width: '100%',
                marginLeft: '0'
            };
        },

        /* jshint ignore:start */
        render: function () {
            var fieldInfo = _.defaults(this.props.fieldInfo, {
                readOnly: false,
                disabled: false,
                label: '',
                helpText: ''
            });

            var hasInfoTooltip = !!fieldInfo.helpText;
            var hasErrorTooltip = (!this.props.isValid[0] && (this.props.isValid[1] || '').length > 0);

            var classes = _.compact([
                this.props.layout,
                determineFieldClass(this.props.children),
                ControlCommon.quadState(fieldInfo.disabled, fieldInfo.readOnly, this.props.isValid, this.props.noControl),
                hasInfoTooltip ? 'hasTooltip' : null,
                hasErrorTooltip ? 'hasErrorTooltip' : null,
                this.props.lockable ? 'lockable' : null
            ]);

            var lockedClasses = _.compact(['fieldLock', this.props.locked ? 'fieldLockOn' : null]);
            var lockDiv = this.props.lockable ? (React.DOM.div( {className:lockedClasses.join(' '), onClick:this.toggleLock} )) : null;

            var styles = {
               'width': this.props.width,
               'margin-left': this.props.marginLeft
            };

            var statusIcon = (hasInfoTooltip ? (React.DOM.span( {className:"statusIcon"} )) : null);

            // If there is no label and no icon, we must render &nbsp; so the fields line up right.


            var label = ((fieldInfo.label || '').length === 0 && statusIcon === null
                ? (React.DOM.label( {className:"formLabel"}, '\u00A0')) // unicode &nbsp; to work around JSX bug:  https://groups.google.com/forum/?fromgroups=#!topic/reactjs/7FmlIyJBofA
                : (React.DOM.label( {className:"formLabel"}, fieldInfo.label,statusIcon)));

            return (
                React.DOM.div( {className:classes.join(' '), 'data-tooltip':fieldInfo.helpText, 'data-error-tooltip':this.props.isValid[1], style:styles}, 
                    label,
                    React.DOM.div( {className:"formElement"}, 
                        this.props.children
                    ),
                    lockDiv
                )
            );
        },
        /* jshint ignore:end */

        componentWillReceiveProps: function (newProps) {
            var wasInvalid = !this.props.isValid[0];

            // If the field has become valid, hide the error tooltip.
            if (wasInvalid && newProps.isValid[0]) {
                ControlCommon.hideErrorTooltip();
            }
        },

        componentDidUpdate: function (prevProps) {
            var wasInvalid = prevProps.isValid[0] === false,
                isStillInvalid = this.props.isValid[0] === false,
                validationMessageChanged = prevProps.isValid[1] !== this.props.isValid[1];

            if (wasInvalid && isStillInvalid && validationMessageChanged) {
                ControlCommon.refreshErrorTooltip();
            }
        },

        toggleLock: function () {
            var isLocked = !this.props.locked;
            this.props.onStickyChange(isLocked);
            this.setState({ locked: isLocked });
        }
    });

    return FormField;
});

/** @jsx React.DOM */
define('controls/Button',[
    'underscore', 'react',
    '../ImmutableOptimizations'
], function (_, React, ImmutableOptimizations) {
    'use strict';


    var Button = React.createClass({displayName: 'Button',
        mixins: [ImmutableOptimizations],

        getDefaultProps: function () {
            return {
                onClick: undefined,
                disabled: false,
                className: undefined // one string, space delimited (if you want to specify more than one class)
            };
        },

        render: function () {
            var classes = _.compact([
                this.props.className,
                this.props.disabled ? 'buttonDisabled' : null
            ]);
            return (React.DOM.button( {className:classes.join(' '), onClick:this.props.onClick, disabled:this.props.disabled}, this.props.children));
        }
    });

    return Button;
});
/** @jsx React.DOM */
define('controls/Carousel',[
    'underscore', 'underscore.string', 'react', 'jquery',
    '../ImmutableOptimizations'
], function (_, str, React, $, ImmutableOptimizations) {
    'use strict';


    /**
     * Small inline carousel which is basically a tabpanel styled differently.
     *
     * Takes these props:
     *   - options: the available records to slide between
     *   - value: the currently selected record, which is required except if options === []
     *
     * This is a tricky contract to get right but it keeps everything well defined through
     * all the possible corner cases.
     */
    var Carousel = React.createClass({displayName: 'Carousel',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldCarousel'; } },

        getDefaultProps: function () {
            return {
                value: undefined,    // integer - the selected index (0-based)
                onChange: $.noop,    // fluxes up the index as an integer
                placeholder: '',
                disabled: false,
                isValid: [true, ''],
                readonly: false,
                noControl: false,
                id: undefined,

                onEdit: $.noop,
                options: undefined, // value compared to options via === i think
                displayTextFn: undefined
            };
        },

        render: function () {
            var i = this.props.value;
            var N = this.props.options.length;

            if (this.props.options.length === 0) {
                // If we have zero options (which can make sense sometimes),
                // a selected value does not make sense.
                console.assert(_.contains([undefined, null], this.props.value));
            }

            return (
                React.DOM.div( {className:"carousel"}, 
                    React.DOM.button( {disabled:N < 2, className:"carouselButton backButton", onClick:_.partial(this.onChange, 'left')}, React.DOM.i( {className:"icon iconPrev"})),
                    React.DOM.input( {className:"carouselInput", placeholder:this.props.placeholder, value:this.displayTextFn(i, N), readOnly:true, id:this.props.id} ),
                    React.DOM.button( {disabled:N < 2, className:"carouselButton forwardButton", onClick:_.partial(this.onChange, 'right')}, React.DOM.i( {className:"icon iconNext"})),
                    React.DOM.button( {className:"carouselButton editButton", disabled:this.props.disabled, onClick:this.props.onEdit}, "Edit Indices",React.DOM.i( {className:"icon iconCaret"}))
                )
                );
        },

        onChange: function (direction, event) {
            var i = this.props.value;
            var N = this.props.options.length;

            console.assert(_.contains(['left', 'right'], direction))
            var nextIndex = (direction === 'left' ? (i - 1 + N) % N : (i + 1) % N);

            // don't actually move the carousel, the flux state must allow the change first.
            this.props.onChange(nextIndex);
        },

        displayTextFn: function (i, N) {
            if (this.props.displayTextFn) {
                return this.props.displayTextFn(i, N);
            }
            else {
                return (N === 0
                    ? '0 of 0'
                    : str.sprintf('%s of %s', i+1, N));
            }
        }

    });

    return Carousel;
});
/** @jsx React.DOM */
define('controls/CheckBox',[
    'underscore', 'jquery', 'react',
    '../ImmutableOptimizations'
], function (_, $, React, ImmutableOptimizations) {
    'use strict';

    var SPACE_KEY = 32;

    return React.createClass({
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldCheckbox'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                onChange: function () {},
                id: undefined,
                label: undefined, //checkbox label, not field label
                isValid: [true, ''],
                disabled: false,
                readonly: false
            };
        },

        /*jshint ignore:start */
        render: function () {
            var elemId = this.props.id + 'CheckBox';

            if (this.props.noControl) {
                return (React.DOM.span(null, this.getDisplayValue()));
            }

            return (
                React.DOM.span( {className:"CheckBox", tabIndex:"0"}, 
                    React.DOM.input( {type:"checkbox", id:elemId,
                        checked:this.props.value, 'data-checked':this.props.value ? '' : null,
                        onChange:this.onChange,
                        disabled:this.props.disabled || this.props.readonly} ),
                    React.DOM.label( {htmlFor:elemId}, this.props.label)
                )
            );
        },
        /*jshint ignore:end */

        componentDidMount: function () {
            var self = this,
                $el = $(this.getDOMNode());

            $el.on('keypress', function (e) {
                if (e.keyCode === SPACE_KEY) {
                    self.props.onChange(!self.props.value);
                }
            });
        },

        componentWillUnmount: function () {
            $(this.getDOMNode()).off('keypress');
        },

        onChange: function (event) {
            var val = event.target.checked;
            this.props.onChange(val);
        },

        getDisplayValue: function () {
            return !!this.props.value ? 'Yes' : 'No';
        }
    });

});

/** @jsx React.DOM */
define('controls/KendoGrid',[
    'underscore', 'jquery', 'react', 'kendo',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, ImmutableOptimizations) {
    'use strict';

    var KendoGrid = React.createClass({displayName: 'KendoGrid',
        mixins: [ImmutableOptimizations],

        getDefaultProps: function () {
            return {
                className: '',
                height: 150, // TODO remove this
                dataSource: undefined,
                columns: undefined
            };
        },

        render: function () {
            console.assert(this.props.dataSource);
            console.assert(this.props.columns);
            return (React.DOM.div( {className:this.props.className} ));
        },

        componentDidMount: function () {
            var $rootNode = $(this.getDOMNode());
            void kendo;
            $rootNode.kendoGrid({
                dataSource: this.props.dataSource,
                height: this.props.height,
                columns: this.props.columns
            });
        },

        componentDidUpdate: function (prevProps, prevState) {
            var $el = $(this.getDOMNode());
            var kendoWidget = $el.data('kendoGrid');

            if (this.props.dataSource instanceof Array) {
                // This better be a datasource that was originally built from inline data.
                // I don't know how to detect this to verify it.
                kendoWidget.dataSource.data(this.props.dataSource);
            }
            else if (prevProps.dataSource !== this.props.dataSource) {
                kendoWidget.setDataSource(this.props.dataSource);
            }
        }
    });

    return KendoGrid;
});
/** @jsx React.DOM */
define('controls/KendoGridPicker',[
    'underscore',
    'jquery',
    'react',
    'kendo',
    '../util/util',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, util, ImmutableOptimizations) {
    'use strict';

    var KendoGridPicker = React.createClass({displayName: 'KendoGridPicker',
        mixins: [ImmutableOptimizations],

        $el: null,

        getDefaultProps: function () {
            return {
                autoBind: true,
                editable: false,
                pageable: false,
                multiSelect: true, // was false
                height: 250,
                onChange: function () {},
                value: []  // list of selected records, just like combo.
            };
        },

        componentWillMount: function () {
            console.assert(this.props.dataSource);
            console.assert(this.props.columns);
            console.assert(this.props.multiSelect === true); // temporary simplification
            console.assert(_.isArray(this.props.value));
        },

        componentWillReceiveProps: function (nextProps) {
            var cantChange = ['dataSource', 'editable', 'pageable'];
            console.assert(_.isEqual(_.pick(nextProps, cantChange), _.pick(this.props, cantChange)), 'these props cant change after mount');
        },

        /*jshint ignore:start */
        render: function () {
            return (React.DOM.div( {className:this.props.className} ));
        },
        /*jshint ignore:end */

        componentDidMount: function () {
            this.$el = $(this.getDOMNode());

            var columns = [{ title: '', template: kendo.template(KendoGridPickerTemplate), width: 34 }];
            columns = columns.concat(this.props.columns);

            this.$el.kendoGrid({
                dataSource: this.props.dataSource,
                height: this.props.height,
                columns: columns,
                sortable: this.props.sortable,
                editable: this.props.editable,
                pageable: this.props.pageable,
                autoBind: this.props.autoBind,
                dataBound: this.applySelectionStateToDom
            }).data('kendoGrid');

            if (!this.props.autoBind) {
                this.$el.data('kendoGrid').refresh();
            }

            this.$el.on('click', 'tr', this.onRowClick);

        },

        componentWillUnmount: function () {
            this.$el.data('kendoGrid').destroy();
            this.$el = null;
        },

        componentDidUpdate: function (prevProps, prevState) {
            this.$el = $(this.getDOMNode());

            this.applySelectionStateToDom();
        },

        applySelectionStateToDom: function () {
            // the SSP page has changed, so we have new DOM.
            // Sync up the DOM with the checked state.
            var grid = this.$el.data('kendoGrid');
            var valueIDs = _.pluck(this.props.value, 'id');

            // Update the checked state of checkbox inputs
            this.$el.find('input[type="checkbox"]').val(valueIDs);

            this.$el.find('tr').each(function (i, elem) {
                var record = grid.dataItem(elem);

                if (record) {
                    $(elem).toggleClass('k-state-selected', _.contains(valueIDs, record.id));
                }
            });
        },

        onRowClick: function (e) {
            // Prevent "shadow" clicks on the label from changing state;
            // The real clicks happen on the input itself, another event targeted on the input will be arriving shortly
            if ('LABEL' === e.target.nodeName || 'A' === e.target.nodeName) {
                return;
            }

            // Get the record associated with this click event
            var $target = $(e.target);
            var $row = $target.closest('tr');

            // Ignore clicks on the row containing header cells
            // clicking on the header should not cause a change in selections
            if (!_.some($row.find('.k-header'))) {
                var model = this.$el.data('kendoGrid').dataItem($row);
                var record = _.extend(model.toJSON(), { id: model.id });

                // Determine the current selection state of this record
                var wasSelected = util.containsDeep(this.props.value, record);

                //if this event was on the checkbox, revert that dom state change until it goes through the flux loop
                if ('INPUT' === e.target.nodeName) {
                    e.target.checked = wasSelected;
                }

                // Toggle the state
                var isSelected = !wasSelected;

                // Invoke our event handler with the new selection state for our control.  This will circle back
                // and re-render us with the new selections
                var nextSelections = (isSelected ? util.unionDeep : util.differenceDeep)(this.props.value, [record]);
                this.props.onChange(nextSelections);
            }

        }
    });


    var KendoGridPickerTemplate = '\
        <div class="checkboxWrap">\
            <input id="#: uid #" type="checkbox" value="#: id #" name="checkboxSelector">\
                <label for="#: uid #"></label>\
            </div>';



    return KendoGridPicker;

});

/** @jsx React.DOM */
define('controls/KendoGridPickerByButton',[
    'underscore',
    'jquery',
    'kendo',
    'react',
    '../util/util',
    '../ImmutableOptimizations'
], function (_, $, kendo, React, util, ImmutableOptimizations) {
    'use strict';

    var $el = null;

    var KendoGridPickerByButton = React.createClass({displayName: 'KendoGridPickerByButton',
        mixins: [ImmutableOptimizations],
        
        getDefaultProps: function() {
            return {
                autoBind: true,
                editable: false,
                pageable: false,
                height: 250,
                onClick: function () {},
                value: []
            };
        },

        componentWillMount: function () {
            console.assert(this.props.dataSource);
            console.assert(this.props.columns);
            console.assert(this.props.valueField);
            console.assert(_.isArray(this.props.value));
        },

        componentWillReceiveProps: function (nextProps) {
            var cantChange = ['dataSource', 'editable', 'pageable'];
            console.assert(_.isEqual(_.pick(nextProps, cantChange), _.pick(this.props, cantChange)), 'these props cant change after mount');
        },

        render: function () {
            return (React.DOM.div( {className:this.props.className} ));
        },

        componentDidMount: function () {
            $el = $(this.getDOMNode());

            this.kendoGrid = $el.kendoGrid({
                dataSource: this.props.dataSource,
                height: this.props.height,
                columns: this.props.columns,
                sortable: this.props.sortable,
                editable: this.props.editable,
                pageable: this.props.pageable,
                autoBind: this.props.autoBind
            }).data("kendoGrid");

            $el.on('click', 'tr', this.onRowClick);
        },

        componentWillUnmount: function () {
            $el = null;
        },

        onRowClick: function (e) {
            // Get the record associated with this click event
            var $target = $(e.target);
            var $row = $target.closest('tr');
            var record = this.kendoGrid.dataItem($row);

            this.props.onClick(record.id);
        }
    });

    return KendoGridPickerByButton;
});

/** @jsx React.DOM */
define('controls/KendoGridRadioSelectable',[
    'underscore', 'underscore.string', 'jquery', 'react',
    '../ImmutableOptimizations'
], function (_, str, $, React, ImmutableOptimizations) {
    'use strict';

    var KendoGridRadioSelectable = React.createClass({displayName: 'KendoGridRadioSelectable',
        mixins: [ImmutableOptimizations],

        $el:{},

        getDefaultProps: function() {
            return {
                disabled: false,
                editable: false,
                pageable: false,
                multiSelect: false,
                height: 250,
                onChange: function () {}
            };
        },

        getInitialState: function () {
            return {
                value: this.getStateVal(this.props.value)
            };
        },

        render: function () {
            console.assert(this.props.dataSource);
            console.assert(this.props.columns);
            console.assert(this.props.valueField);

            return ( React.DOM.div(null ) );
        },

        componentDidMount: function () {
            this.$el = $(this.getDOMNode());

            var checkboxColumnTemplate = '<div class="checkboxWrap"><input id="#: ' + this.props.valueField + ' #" type="%s" name="checkboxSelector"/><label for="#: ' + this.props.valueField + ' #"></div>';
            checkboxColumnTemplate = this.getInputTypeString(checkboxColumnTemplate);

            var columns = [{ title: '', template: checkboxColumnTemplate, width: 34 }];
            columns.push.apply(columns, this.props.columns);

            this.$el.kendoGrid({
                dataSource: this.props.dataSource,
                height: this.props.height,
                columns: columns,
                sortable: this.props.sortable,
                editable: this.props.editable,
                pageable: this.props.pageable
            });

            // see Dustin
            this.props.dataSource.bind && this.props.dataSource.bind("change", this.onDataStoreChange);
        },

        componentWillUnmount: function () {
            // see Dustin
            this.props.dataSource.unbind && this.props.dataSource.unbind("change", this.onDataStoreChange);
        },

        onDataStoreChange: function () {
            var self = this;
            _.each(this.state.value, function (item) {
                // select and highlight the selected item in the grid
                var selector = $(str.sprintf("input[id='%s']", item[self.props.valueField]) , self.$el);
                selector.attr("checked", true);
                selector.closest('tr').toggleClass('k-state-selected', selector.is(':checked'));
            })

            $(this.getInputTypeString("input[type='%s']"), this.$el).on("change", this.gridSelection);
        },

        componentWillReceiveProps: function (nextProps) {
            var cantChange = ['dataSource', 'editable', 'pageable'];
            console.assert(_.isEqual(_.pick(nextProps, cantChange), _.pick(this.props, cantChange)), 'these props cant change after mount');
        },

        gridSelection: function (e) {
            var vals = [];
            var self = this;

            $(this.$el).find(this.getInputTypeString('input[type="%s"]')).each(function () {
                $(this).closest('tr').toggleClass('k-state-selected', $(this).is(':checked'));

                if($(this).is(':checked')) {
                    vals.push(self.props.dataSource.get($(this).attr('id')));
                }
            });

            $(e.currentTarget).closest('tr').toggleClass('k-state-selected', $(e.currentTarget).is(':checked'));

            this.setState({value: vals});
            this.props.onChange(this.props.multiSelect ? vals : _.first(vals) );
        },

        getInputTypeString : function (string) {
            return str.sprintf(string, this.props.multiSelect ? 'checkbox' : 'radio')
        },

        getStateVal: function (val) {
            return _.isArray(val) ? val : (!!val ? [val] : [] );
        }
    });

    return KendoGridRadioSelectable;

});

define('util/kendoutil',[
    'underscore', 'underscore.string', 'jquery', 'kendo', '../util/util'
], function (_, str, $, kendo, util) {
    'use strict';
    var my = {};

    /**
     * Register a custom kendo MVVM binder for formatting numbers.
     * @type {*}
     */
    kendo.data.binders.numeric = kendo.data.Binder.extend({
        refresh: function () {
            var num = this.bindings['numeric'].get();

            $(this.element).text(kendo.toString(num, 'n0'));    // format as N,NNN
        }
    });
    kendo.data.binders.dateText = kendo.data.Binder.extend({
        refresh: function () {
            var date = this.bindings['dateText'].get();

            $(this.element).text(kendo.toString(date, 'dd-MMM-yyyy'));
        }
    });
    /*
     * This is needed for the implementation of the foreach binding.
     * @type {Function|fn|.duration.fn|jQuery.fn|fn|kendoJQuery.fn|Point2D.fn|Box2D.fn}
     */
    var SourceBinderClass = kendo.data.binders.source.fn;
    /**
     * This binding allows a foreach: binding that uses the interior HTML as the template.
     * @type {*}
     */
    kendo.data.binders.foreach = kendo.data.binders.source.extend({
        init: function (target, binding, options) {
            // Set the template using the contained markup
            var templateHtml = $(target).html();
            options.template = kendo.template(str.trim(templateHtml));

            SourceBinderClass.init.call(this, target, binding, options);
        },
        refresh: function (e) {
            // alias the binding data
            this.bindings.source = this.bindings.foreach;

            SourceBinderClass.refresh.call(this, e);
        }
    });

    /**
     * This came from a forum posting here:
     * http://www.kendoui.com/forums/kendo-ui-web/grid/dynamic-grid-height.aspx
     */
    function resizeKendoGrids() {
        var $grids = $(document.body).find('.k-grid.k-widget');

        $.each($grids, function () {
            var gridElement = $(this);
            var grid = gridElement.data('kendoGrid');

            // Depending on how the view template works, the widget might be on a child element
            if (!grid) {
                grid = gridElement.find('[data-role="grid"]').data('kendoGrid');
            }
            // Call the kendo private method that sets the grid content height based on toolbar,header,footer settings.
            // This is more robust than trying to figure out how they do it for different kinds of grids. (AHG)
            if (grid) {
                grid._setContentHeight();
            }
        });
    }

    // Register a single resize handler that will manage all the grids on the page.
    // This central registration will prevent memory leaks for handlers to views that appear/disappear.
    $(window).resize(resizeKendoGrids);

    my.resizeKendoGrids = resizeKendoGrids;



    my.templateWith = function templateWith(template, f) {
        return function (record) {
            return template(f(record));
        };
    };

    my.templateForEnum = function templateForEnum(field) {
        return kendo.template('#: ' + field + '.name #');
    };

    my.templateForUser = function templateForUser(field) {
        return kendo.template('#: ' + field + '.fullName #');
    };

    /**
     * Adds routines to the kendo model for interacting with the object's type info
     * @param baseModelConfig - existing model config that is to be added to
     * @param typeInfo - typeInfo to be used
     * @param localeManager - component's localeManager
     * @param rawModelFieldOpt - optional name of the field in the record that will
     * contain the raw data for the record (straight from the server) that maps to
     * the typeInfo. By default it is assumed that the root of the record is the object
     * described by the type info
     * @returns {*}  - Updated model config
     */
    my.typeInfoModel = function (baseModelConfig, typeInfo, localeManager, rawModelFieldOpt) {
        var rawModelPrefix = '';
        if (null !== rawModelFieldOpt && undefined !== rawModelFieldOpt && rawModelFieldOpt.length > 0) {
            rawModelPrefix = rawModelFieldOpt + '.';
        }

        var theTypeInfo = typeInfo;
        var theLocaleManager = localeManager;

        function subTypeInfo(fieldName) {
            return theTypeInfo.types[theTypeInfo.properties[fieldName].dataType];
        }

        var modelConfig = {
            nls: function (/* args passed through to locale manager */) {
                return theLocaleManager.localize.apply(theLocaleManager, arguments);
            },
            /**
             * get the type info associated with this object
             */
            typeInfo: function () {
                return theTypeInfo;
            },
            /**
             * get the field info for a specified fields.
             * NOTE: Supports one level of "." notation to get into the group values
             * e.g pendingDocuments.pendingDocumentTaskName
             */
            fieldInfo: function (fieldName) {
                var fieldsSplit = fieldName.split('.');
                if (fieldsSplit.length === 1) {
                    return theTypeInfo.properties[fieldName];
                } else {
                    return subTypeInfo(fieldsSplit[0]).properties[fieldsSplit[1]];
                }
            },
            /**
             * returns the raw value for a field
             */
            value: function (fieldName) {
                var rawFieldName = rawModelPrefix + fieldName;
                return this.get(rawFieldName);
            },
            /**
             * returns the display value for a field
             * @param fieldName name of the field to format
             * @param valueToFormatOpt optional value of the format, useful when dealing with sub fields
             * could use a better solution for this
             * @returns {*}
             */
            display: function (fieldName, valueToFormatOpt) {
                var value;
                if (undefined === valueToFormatOpt) {
                    value = this.value(fieldName);
                } else {
                    value = valueToFormatOpt;
                }
                return util.typedObjectValueToDisplayValue2(value, fieldName, this.fieldInfo(fieldName), theLocaleManager);
            },
            /**
             * returns the display value for a field
             * @param fieldName name of the field to format
             * could use a better solution for this
             * @returns {*}
             */
            displayDateOnly: function (fieldName) {
                return theLocaleManager.formatDate(new Date(Date.parse(this.value(fieldName))));
            },
            /**
             * returns the display value for a field
             * This is for when you want to specify the type info independently of the value or when it's necessary, as in the case of complex structures.
             * @param fieldName name of the field to format
             * @param typePath the path to the type info descriptor.
             * @returns {*}
             */
            displayEx: function (fieldName, typePath) {
                var value = this.value(fieldName);
                return util.typedObjectValueToDisplayValue2(value, fieldName, this.fieldInfo(typePath), theLocaleManager);
            },
            /**
             * Returns the label for a field
             * @param fieldName name of the field (support one level of '.')
             * @param excludeFieldEndingOpt
             * @returns label for the field optionally ending in the field separator/':'
             */
            label: function (fieldName, excludeFieldEndingOpt) {
                return this.labelize(this.fieldDisplayName(fieldName), excludeFieldEndingOpt);
            },
            /**
             * Translates fieldName to display name
             * @param fieldName
             * @returns {String}
             */
            fieldDisplayName: function (fieldName) {
                var label = this.fieldInfo(fieldName).label;
                if (undefined  === label) {
                    label = fieldName;
                }
                return label;
            },
            labelize: function (label, excludeFieldEndingOpt) {
                if (excludeFieldEndingOpt !== true) {
                    label = label + this.nls('labelSuffix');
                }
                return label;
            },
            /**
             * Takes a list of field names, converts them to their display names, intercalates separators.
             * @param fieldNames
             * @param excludeFieldEndingOpt
             * @returns {*}
             */
            labelizeCompound: function (fieldNames, excludeFieldEndingOpt) {
                function add(s, v) { return s + v; }
                var self = this;
                return this.labelize(_.reduce(util.intersperse(this.nls('countrySiteSeparator'), _.map(fieldNames, function (v) { return self.label(v, true); })), add, ''), excludeFieldEndingOpt);
            }
        };

        return $.extend(true, {}, baseModelConfig, modelConfig);
    };

    my.fixEditorOptions = function (kendoGrid, cell, model) {
        var column = kendoGrid.columns[kendoGrid.cellIndex(cell)];
        var field = model.fields[column.field];

        // If there's validation for a date field, need to update the date picker widget with validation options
        if (field.type === 'date' && field.validation) {
            cell.find('input').data('kendoDatePicker').setOptions(field.validation);
        }
    };

    /**
     * Disables row selection for clicks on elements with the given class name.
     *
     * @param grid
     * @param className
     */
    my.makeUnselectableInGrid = function (grid, className) {
        // De-reference a jQuery element containing the grid
        if (grid.jquery) {
            grid = grid.data('kendoGrid');
        }
        grid.selectable.userEvents.bind('select', function (e) {
            if ($(e.event.target).hasClass(className)) {
                // Tell the kendo UserEvents to cancel the "touch" (i.e. click)
                e.sender.cancel();
            }
        });
    };

    /**
     * Tweaks the kendo Selectable widget behavior so that clicks on rows toggle the selection, like a checkbox.
     *
     * @param grid
     */
    my.enableCheckboxSelection = function (grid) {
        grid.selectable.userEvents.notify = function (eventName, data) {
            // Make all "tap/click" events seem like they have the ctrlKey pressed, which gives a checkbox-style UX
            if (eventName === 'tap') {
                data.event.ctrlKey = true;
            }
            this.trigger(eventName, data);
        };
    };

    /**
     * Extend the grid widget API to allow setting the selection with a data object.
     *
     * @param item DataStore model (can be null)
     */
    kendo.ui.Grid.fn.selectDataItem = function (item) {
        if (item && item.uid) {
            this.select(this.table.find('tr[data-uid="' + item.uid + '"]'));
        }
    };

    /* Kendo doesn't expose the global default mouse movement threshold for detecting "clicks" for selection.
     * Use these gyrations to hook the two widgets that create Selectable stuff.
     */
    function setMouseMoveThresholdForSelectables(widget) {
        if (widget.selectable) {
            widget.selectable.userEvents.threshold = 9;     // Allow nine pixels of movement
        }
    }

    kendo.ui.Grid.fn._selectable = _.wrap(kendo.ui.Grid.fn._selectable, function (selectable) {
        selectable.call(this);
        setMouseMoveThresholdForSelectables(this);
    });
    kendo.ui.ListView.fn._selectable = _.wrap(kendo.ui.ListView.fn._selectable, function (selectable) {
        selectable.call(this);
        setMouseMoveThresholdForSelectables(this);
    });

    kendo.ui.Grid.fn.dataItem = _.wrap(kendo.ui.Grid.fn.dataItem, function (wrapped, tr) {
        if (_.isArray(this._data)) {
            return wrapped.call(this, tr);
        } else {
            return null;
        }
    });

    return my;
});

/** @jsx React.DOM */
define('controls/KendoListView',[
    'underscore', 'jquery', 'react', 'kendo',
    '../util/kendoutil',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, kendoutil, ImmutableOptimizations) {
    'use strict';

    return React.createClass({
        displayName: 'KendoListView',
        mixins: [ImmutableOptimizations],

        getDefaultProps: function () {
            return {
                className: 'content',
                scrollToSelectedItem: false,
                scrollDuration: 150,
                dataSource: undefined,
                selectable: true,
                selectedId: null,
                template: '<div data-model-id="${id}">${id}</div>',
                paramMapper: _.identity,       // function to map the datastore record into template params
                onChange: function () {}
            };
        },

        componentWillMount: function () {
            this.preventReentry = false;
            console.assert(this.props.dataSource);
        },

        /* jshint ignore:start */
        render: function () {
            return (React.DOM.div( {className:this.props.className} ));
        },
        /* jshint ignore:end */


        /**
         * This method compensates for weird stuff in kendoListView, which has an immature API. Specifically,
         * there is no way to set the value without causing change events to fire, which makes it difficult for React to
         * control the widget.
         */
        effectListSelectionById: function (selectedId) {
            var listView = $(this.getDOMNode()).data('kendoListView');
            var maybeSelectedChild = _.find(listView.element.children(), function (child) {
                return selectedId === $(child).data('modelId');
            }.bind(this));

            var syncSelection = (maybeSelectedChild
                ? function () { listView.select($(maybeSelectedChild)); }
                : function () { listView.clearSelection(); });

            this.preventReentry = true;
            // this line causes a widget value change event, so we need to prevent reentry to the value change callback
            syncSelection();
            this.preventReentry = false;
        },

        syncSelectionWithKendo: function () {
            this.effectListSelectionById(this.props.selectedId);

            if (this.props.selectedId && this.props.scrollToSelectedItem) {
                var rootEl = $(this.getDOMNode());
                var listView = rootEl.data('kendoListView');
                var maybeSelectedChild = _.find(listView.element.children(), function (child) {
                    return this.props.selectedId === $(child).data('modelId');
                }.bind(this));

                var selectedChildIndex = _.indexOf(listView.element.children(), maybeSelectedChild);
                if (selectedChildIndex >= 0) {
                    var scrollTop = selectedChildIndex * $(maybeSelectedChild).height();
                    rootEl.animate({ scrollTop: scrollTop }, this.props.scrollDuration);
                }
            }
        },

        componentDidUpdate: function (prevProps, prevState) {
            if (this.props.selectable && !_.isEqual(this.props.selectedId, prevProps.selectedId)) {
                this.syncSelectionWithKendo();
            }
        },

        componentDidMount: function () {
            $(this.getDOMNode()).kendoListView({
                autoBind: false,
                dataSource: this.props.dataSource,
                template: kendoutil.templateWith(kendo.template(this.props.template), this.props.paramMapper),
                selectable: this.props.selectable,
                change: this.onValueChange
            }).data('kendoListView');

            if (this.props.selectable) {
                this.syncSelectionWithKendo();
            }

            this.props.dataSource.bind('change', this.onDataStoreChange);
        },

        componentWillUnmount: function () {
            this.props.dataSource.unbind('change', this.onDataStoreChange);
        },

        onValueChange: function (e) {
            if (this.preventReentry) return;
            var listView = $(e.sender.element[0]).data('kendoListView');
            var val = listView.select().data('modelId');
            this.effectListSelectionById(this.props.selectedId); // unwind the kendo state change to respect flux lifecycle
            this.props.onChange(val);
        },

        onDataStoreChange: function () {
            this.syncSelectionWithKendo();
        }
    });
});

/** @jsx React.DOM */
define('controls/KendoMultiSelect',[
    'underscore', 'underscore.string', 'jquery', 'react',
    '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, str, $, React, controlCommon, ImmutableOptimizations) {
    'use strict';


    return React.createClass({
        mixins: [ImmutableOptimizations],

        getDefaultProps: function() {
            return {
                label: ' ', // will this render as nbsp? No, FIXME
                layout: 'formField',
                disabled: false,
                isValid: [true, ''],
                template: str.sprintf('${%s} - ${%s}', this.props.valueField, this.props.displayField),
                onChange: function () {},
                readonly: false,
                noControl: false,
                placeholder: '',
                width: null // use whatever the default is
            };
        },

        componentWillMount: function () {
            console.assert(this.props.displayField);
            console.assert(this.props.valueField);
            console.assert(this.props.dataSource);

            this.stableUniqueId = _.uniqueId();
        },

        render: function () {

            var classes = _.compact([
                this.props.layout,
                'formFieldMultiselect',
                controlCommon.quadState(this.props.disabled, this.props.readonly, this.props.isValid, this.props.noControl)
            ]).join(' ');

            void classes;
            /*jshint ignore:start */
            var control = (this.props.noControl
                ? (React.DOM.span( {'data-wspt-id':"displayValue"}, this.props.value))
                : (React.DOM.select( {id:this.stableUniqueId})));

            return(
                React.DOM.div( {className:classes}, 
                    React.DOM.label( {className:"formLabel", htmlFor:this.stableUniqueId}, this.props.label),
                    React.DOM.div( {className:"formElement"}, 
                        control
                    )
                )
            );
            /*jshint ignore:end */
        },

        getDisplayValue: function () {
            // for displaying as a string in noControl mode
            var displayVals = _.map(this.props.value, function (val) {
                return val[this.props.displayField];
            });

            return str.join(displayVals, ', '); // l10n?
        },

        componentDidMount: function () {

            if (this.props.noControl) {
                // Nothing to do - all done in JSX.
                return;
            }

            var $el = $(this.getDOMNode()).find('#' + this.stableUniqueId);

            if (this.props.width) {
                $el.width(340);
            }
            $el.kendoMultiSelect({
                filter: 'contains',
                highlightFirst: false,
                dataTextField: this.props.displayField,
                dataValueField: this.props.valueField,
                dataSource: this.props.dataSource,
                placeholder: this.props.placeholder,
                itemTemplate: this.props.template,
                change: this.onChange
            });

            var kendoWidget = $el.data('kendoMultiSelect');

            // the 'value' method is a getter/setter that gets/sets the valueField. It will look up the record
            // in the store via the value set here.
            kendoWidget.value((!_.isEmpty(this.props.value)) ? this.props.value[this.props.valueField] : '');

            if (this.props.disabled) {
                // disabled beats readonly
                kendoWidget.enable(false);
            } else if (this.props.readonly) {
                kendoWidget.readonly(true);
            } else {
                kendoWidget.enable(true);
            }
        },

        componentWillReceiveProps: function (nextProps) {
            var cantChange = ['template', 'dataSource', 'valueField', 'displayField', 'placeholder'];
            console.assert(_.isEqual(_.pick(nextProps, cantChange), _.pick(this.props, cantChange)), 'these props cant change after mount');
        },

        componentDidUpdate: function (prevProps, prevState) {

            if (this.props.noControl) {
                // Nothing to do - all done in JSX.
                return;
            }

            var $el = $(this.getDOMNode()).find('#' + this.stableUniqueId);
            var kendoWidget = $el.data('kendoMultiSelect');

            if (prevProps.dataSource !== this.props.dataSource) {
                kendoWidget.setDataSource(this.props.dataSource);
            }

            var vals = [];
            var self = this;
            _.each(this.props.value, function (item) {
                vals.push(item[self.props.valueField]);
            });

            kendoWidget.value(vals);

            if (this.props.disabled) {
                // disabled beats readonly
                kendoWidget.enable(false);
            } else if (this.props.readonly) {
                kendoWidget.readonly(true);
            } else {
                kendoWidget.enable(true);
            }
        },

        onChange: function (event) {
            var kendoMultiSelect = event.sender;
            var records = kendoMultiSelect.dataItems();
            this.props.onChange(records);
        }
    });

});

/** @jsx React.DOM */
define('ReactCommon',[
    'underscore', 'react'
], function (_, React) {
    'use strict';

    /* jshint ignore:start */

    function wrapItemsDiv(jsxs) {
        var acc = [];
        _.each(jsxs, function (jsx, i) {
            acc.push(React.DOM.div( {key:i}, jsx))
        });
        return acc;
    }

    /* jshint ignore:end */

    return {
        wrapItemsDiv: wrapItemsDiv
    };
});

/** @jsx React.DOM */
define('controls/KendoTabStrip',[
    'underscore', 'jquery', 'react', 'kendo',
    '../ReactCommon',
    '../ImmutableOptimizations'
], function (_, $, React, kendo, ReactCommon, ImmutableOptimizations) {
    'use strict';

    void ReactCommon;
    /**
     * Takes a "tabs" prop which is a map from title string to a JSX instance.
     * This component is not presently stateful so we don't get to control what is selected.
     */
    var KendoTabStrip = React.createClass({displayName: 'KendoTabStrip',
        mixins: [ImmutableOptimizations],

        componentWillMount: function () {
            console.assert(_.isObject(this.props.tabs) && _.keys(this.props.tabs).length > 0);
        },

        componentWillUnmount: function () {
            this.tabStrip.unbind('select', this.onSelect);
        },

        componentDidMount: function () {
            var $el = $(this.getDOMNode());
            $el.kendoTabStrip({
                select: this.onSelect
            });
            this.tabStrip = $el.data('kendoTabStrip');
        },

        onSelect: function (event) {
            var item = $(event.item);
            var index = item.data('wspt-index');
            if (this.props.onChange && ! this.suppressEvents) {
//                this.props.onChange(index);
            }
        },

        /* jshint ignore:start */
        render: function () {

            var lis = [];
            _.each(_.keys(this.props.tabs), function (title, index) {
                var jsx = (index === 0
                    ? (React.DOM.li( {className:"k-state-active", 'data-wspt-index':index, key:index}, title))
                    : (React.DOM.li( {'data-wspt-index':index, key:index}, title)));
                lis.push(jsx);
            });

            var content = ReactCommon.wrapItemsDiv(_.values(this.props.tabs));

//            if (this.tabStrip && this.props.selectedTab) {
//                this.suppressEvents = true;
//                this.tabStrip.select(this.props.selectedTab);
//                this.suppressEvents = false;
//            }

            return (
                React.DOM.div(null, 
                    React.DOM.ul(null, lis),
                    content
                )
                );
        }
        /* jshint ignore:end */
    });

    return KendoTabStrip;
});
/** @jsx React.DOM */
define('controls/MultiSelect',[
    'underscore', 'jquery', 'react', '../util/util', '../ControlCommon',
    '../ImmutableOptimizations'
], function (_, $, React, u, controlCommon, ImmutableOptimizations) {
    'use strict';


    /**
     * Creates a multi-select control.
     * isFlat controls whether the selectors are interpreted as containing optgroups.
     * If isFlat is true selectors will be a two level array of arrays.  The top level will be pairs of (name, children). Children, the second level, will be pairs of (id, name).
     * If isFlat is false selectors will  simply be an array of (id, name).
     * Each level can also have an active property that will be assumed to be true if undefined.
     * Empty optgroups will be elided.
     */
    return React.createClass({
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldMultiselect'; } },

        getDefaultProps: function () {
            return {
                disabled: false,
                readonly: false,
                isValid: [true, ''],
                isFlat: true,
                selectors: [],
                selections: [], // this is the value prop that pairs with onChange.
                size: 3,
                onChange: function () {}
            };
        },

        getInitialState: function () {
            // Here, we cull out all the inactive panels.
            var selectors = this.props.selectors;
            u.test(_.isArray(selectors), 'array required for selectors');
            // implements the behavior that the absence of an active property makes it automatically active.
            function isActive(selector) {
                return _.isUndefined(selector.active) || !! selector.active;
            }
            u.test(_.isArray(selectors), 'array required for selectors');
            if (this.props.isFlat) {
                selectors = _.filter(selectors, function (selector) {
                    return isActive(selector);
                });
            } else {
                selectors = _.filter(selectors, function (group) {
                    return isActive(group);
                });
                selectors = _.map(selectors, function (group) {
                    // this clone will copy the primitive valued properties and leave the arrays as references.
                    // this is fine since we'll be replacing those arrays with filtered versions.
                    var g = _.clone(group);
                    g.children = _.filter(group.children, function (child) { return isActive(child); });
                    return g;
                });
                selectors = _.filter(selectors, function (g) { return 0 < g.children.length; });
            }
            return ({
                selectors: selectors,
                selections: this.props.selections,
                isValid: this.props.isValid
            });
        },

        /* jshint ignore:start */
        render: function () {
            var selectors = this.state.selectors;
            var selections = this.props.selections;
            function option(selector) {
                return (React.DOM.option( {value:selector.id}, selector.name));
            }
            if (this.props.isFlat) {
                selectors = _.map(selectors, function (selector) {
                    return option(selector); // (<option value={selector.id}>{selector.name}</option>);
                });
            } else {
                selectors = _.map(selectors, function (group) {
                    var options = _.map(group.children, function(child) {
                        return option(child); // (<option value={child.id}>{child.name}</option>);
                    });
                    return (React.DOM.optgroup( {label:group.name}, options));
                });
            }

            return(
                        React.DOM.select( {id:this.props.id, ref:"multiselector", value:selections, multiple:"multiple"}, selectors)
            );
        },
        /* jshint ignore:end */

        componentDidMount: function () {
            var self = this,
                $el = $(this.getDOMNode());
            $el.on('change', function (event) {
                void event;
                var selections = _.map(_.filter(self.refs['multiselector'].getDOMNode().options, function (opt) {
                    return opt.selected;
                }), function (opt) {
                    return opt.value;
                });
                self.props.onChange(selections);
                return true;
            });
        }
    });
});

/** @jsx React.DOM */
define('controls/Radio',[
    'underscore', 'react', 'jquery',
    '../ImmutableOptimizations'
], function (_, React, $, ImmutableOptimizations) {
    'use strict';

    /**
     *     Careful:
     *       This must be contained by a RadioGroup or it won't style right.
     */
    var Radio = React.createClass({displayName: 'Radio',
        mixins: [ImmutableOptimizations],

        getDefaultProps: function () {
            return {
                onChange: $.noop,
                disabled: false,
                readonly: false,
                checked: false,
                value: undefined
            };
        },

        componentWillMount: function () {
            console.assert(this.props.name, 'Radio \'name\' prop is required');
            //console.assert(this.props.value !== undefined, 'Radio needs a value to distinguish choices');
            // Also, value can't be null, i think, or the <input> will not be controlled.

            this.stableUniqueId = _.uniqueId();
        },

        render: function () {
            return (
                React.DOM.span(null, 
                    React.DOM.input( {type:"radio", name:this.props.name, id:this.stableUniqueId, value:this.props.value, onChange:this.onChange,
                           checked:this.props.checked, 'data-checked':this.props.checked ? '' : null,
                           disabled:this.props.disabled, readOnly:this.props.readonly} ),
                    React.DOM.label( {htmlFor:this.stableUniqueId}, this.props.children)
                )
            );
        },

        onChange: function (e) {
            !this.props.readonly && this.props.onChange(e.target.value);
        }
    });


    return Radio;
});
/** @jsx React.DOM */
define('controls/RadioGroup',[
    'underscore', 'react',
    '../ImmutableOptimizations'
], function (_, React, ImmutableOptimizations) {
    'use strict';


    var RadioGroup = React.createClass({displayName: 'RadioGroup',
        mixins: [ImmutableOptimizations],

        statics: { fieldClass: function () { return 'formFieldRadio'; } },

        /*jshint ignore:start */
        render: function () {
            var value = this.props.value;

            _.each(this.props.children, function (radio) {
                // Check the radio button whose value matches the group's value
                radio.props.checked = (radio.props.value === value);
            });

            return (
                React.DOM.fieldset(null, 
                    this.props.children
                )
            );
        }
        /*jshint ignore:end */
    });


    return RadioGroup;
});
/** @jsx React.DOM */
define('controls/UserPickerPlus',[
    'underscore', 'react',
    './RadioGroup',
    './UserPicker',
    '../ImmutableOptimizations'
], function (_, React, RadioGroup, UserPicker, ImmutableOptimizations) {
    'use strict';

    void UserPicker;
    /**
     * This is a user picker control that is similar to the UserPicker but differs by
     * 1) it's given a list of users for radio buttons,
     * 2) The last radio button allows a user to be selected using a standard picker control
     * 3) it has no multi-select feature (single only).
     */
    return React.createClass({

        displayName: 'UserPickerPlus',
        mixins: [ImmutableOptimizations],
        statics: { fieldClass: function () { return 'formFieldRadio'; } },

        getDefaultProps: function () {
            return {
                value: undefined,
                disabled: false,
                readonly: false
            };
        },

        componentWillMount: function () {
            console.assert(this.props.dataSource);

            this.elemIDPrefix = _.uniqueId('userPickerRadio');
        },

        /*jshint ignore:start */
        render: function () {
            var props = this.props,
                pickerValue = props.value,
                idPrefix = this.elemIDPrefix;

            function onChangeRadio(e) {
                var index = parseInt(e.target.value);
                props.onChange(props.userList[index]);
            }

            function makeRadio(user, index) {
                var elemID = idPrefix + index;
                var checked = _.isEqual(user, props.value);

                return [
                    (React.DOM.input( {type:"radio", name:props.name, id:elemID, value:index, checked:checked, onChange:onChangeRadio})),
                    (React.DOM.label( {htmlFor:elemID}, user.fullName)),
                    (React.DOM.br(null))
                ];
            }

            // If the "value" is one of the users in the userList, we don't want to pass it to the picker.
            if (_.some(props.userList, function (user) { return _.isEqual(user, pickerValue) } )) {
                pickerValue = null;
            }

            return(
                React.DOM.fieldset(null, 
                    _.flatten(_.map(props.userList, makeRadio)),
                    React.DOM.input( {type:"radio", name:props.name, id:idPrefix + 'Last', checked:!!pickerValue} ),
                    React.DOM.label( {htmlFor:idPrefix + 'Last'}, 
                        UserPicker( {onChange:props.onChange, placeholder:props.placeholder,
                                    value:pickerValue, dataSource:props.dataSource, width:props.width} )
                    )
                )
            );
        }
        /*jshint ignore:end */
    });
});

/** @jsx React.DOM */
define('controls/KendoPager',[
    'underscore', 'jquery', 'react', 'kendo'
], function (_, $, React, kendo) {
    'use strict';

    void kendo;

    /*
        Kendo messages defaults:
        http://docs.telerik.com/kendo-ui/api/web/pager#configuration-messages

        messages: {
            display: '{0} - {1} of {2} items',
            empty: 'No items to display',
            page: 'Page',
            of: 'of {0}',
            itemsPerPage: 'items per page',
            first: 'Go to the first page',
            previous: 'Go to the previous page',
            next: 'Go to the next page',
            last: 'Go to the last page',
            refresh: 'Refresh'
        }
     */

    var KendoPager = React.createClass({displayName: 'KendoPager',

        getDefaultProps: function () {
            return {
                className: 'k-pager-wrap',
                // Empty object means override none of kendo's defaults, which are shown above for convenience
                messages: {}
            };
        },

        /* jshint ignore:start */
        render: function () {
            console.assert(this.props.dataSource, 'Need a dataSource to page');
            return (React.DOM.div( {className:this.props.className}));
        },
        /* jshint ignore:end */

        componentDidMount: function () {
            $(this.getDOMNode()).kendoPager({
                dataSource: this.props.dataSource,
                messages: this.props.messages
            });
        }
    });

    return KendoPager;
});

/** @jsx React.DOM */
define('controls/PromiseButton',[
    'underscore', 'react', 'q'
], function (_, React, Q) {
    'use strict';

    var VISIBLE = {display: 'inline-block'};
    void VISIBLE;
    var INVISIBLE = {display: 'none'};
    void INVISIBLE;

    var PromiseButton = React.createClass({displayName: 'PromiseButton',
        mixins: [],

        getDefaultProps: function () {
            return {
                label: '',
                className: 'secondaryButton',
                disabled: false,
                handler: _.identity
            };
        },

        getInitialState: function () {
            return {
                busy: false
            };
        },

        componentWillReceiveProps : function (nextProps) {
            this.setState({ disabled: nextProps.disabled });
        },

        render: function () {
            var self = this,
                handler = this.props.handler,
                disabled = this.props.disabled || this.state.busy;

            function onFinally() {
                if (self.isMounted()) {
                    self.setState({ busy: false });
                }
            }
            function clickHandler() {
                var promise = handler();

                // If the handler returns a promise, enter "busy" mode and disable the button.
                // Note that this component calls "done()" to complete the promise chain, since this click handler
                // does not have a return value.
                if (promise) {
                    self.setState({ busy: true });
                    Q(promise).fin(onFinally).done();
                }
            }

            void clickHandler;
            void disabled;
            /*jshint ignore:start */
            return (
                React.DOM.button( {className:this.props.className, disabled:disabled, onClick:clickHandler}, 
                    this.props.label || this.props.children,
                    React.DOM.i( {className:"k-loading", style:this.state.busy ? VISIBLE : INVISIBLE})
                )
            );
            /*jshint ignore:end */
        }
    });

    return PromiseButton;
});

/** @jsx React.DOM */
define('controls/SearchBox',[
    'underscore', 'jquery', 'react'
], function (_, $, React) {
    'use strict';

    var ENTER_KEY = 13;

    function setVisible(el, visible) {
        // I'm using visibility instead of $.hide/show because I don't want to change the icon's "display" style. Something
        // goes wrong in jQuery and it changes the span's display from inline-block to block when showing it using $.show().
        $(el).css('visibility', visible ? 'visible' : 'hidden');
    }

    function noBrowserDefault(e) {
        // The browser changes focus on mouse down, but we don't want that.
        e.preventDefault();
    }

    var SearchBox = React.createClass({displayName: 'SearchBox',

        getDefaultProps: function () {
            return {
                disabled: false,
                fireClearEvent: false,
                instantSearch: false,
                onChange: function () {}
            };
        },

        componentWillMount : function () {
            console.assert(this.props.handler, 'SearchBox requires a handler function');
        },

        componentDidMount : function () {
            // Hide the clear button if there's no text
            setVisible($(this.getDOMNode()).find('.iconClear'), this.refs.myInput.getDOMNode().value.length > 0);
        },

        /*jshint ignore:start */
        render: function () {
            return (
                React.DOM.span( {className:"searchBox"}, 
                    React.DOM.input( {type:"text", disabled:this.props.disabled, placeholder:this.props.placeholder, value:this.props.value,
                           autoComplete:"off", onKeyDown:this.onKeyDown, defaultValue:this.props.defaultValue, ref:"myInput", onChange:this.onTextChange}),
                    React.DOM.span( {className:"iconClear", onClick:this.onClickClear, onMouseDown:noBrowserDefault} ),
                    React.DOM.span( {className:"iconSearch", onClick:this.onClickSearch, onMouseDown:noBrowserDefault} )
                ))
        },
        /*jshint ignore:end */

        onKeyDown: function (event) {
            // Don't let the Enter key propagate because it might cause parent components to do things we don't want
            if (event.keyCode === ENTER_KEY) {
                event.stopPropagation();
                event.preventDefault();
            }

            if (event.keyCode === ENTER_KEY || this.props.instantSearch) {
                this.props.handler(event.target.value);
                return;
            }

            var icon = $(event.target).siblings('.iconClear');
            setVisible(icon, (event.target.value.length > 0));
        },

        onClickClear: function (event) {
            event.stopPropagation();

            this.refs.myInput.getDOMNode().value = '';
            setVisible(event.target, false);
            if (this.props.fireClearEvent) {
                this.props.handler('');
            }
        },

        onClickSearch: function (event) {
            event.stopPropagation();

            if (!this.props.disabled) {
                this.props.handler(this.refs.myInput.getDOMNode().value);
            }
        },

        onTextChange: function (event) {
            this.props.onChange(event.target.value);
        }
    });

    /* An installer for non-react users */
    SearchBox.install = function (searchBox, placeholder, handler) {
        var input = searchBox.find('input');
        var clearBtn = searchBox.find('.iconClear');

        console.assert(handler, 'SearchBox requires a handler function');

        function inputKey(e) {
            e.stopPropagation();

            if (e.keyCode === ENTER_KEY) {
                // keep the event from bubbling up to where react can see it (whence it will attempt to confirm the dialog).
                e.preventDefault();
                handler(input.val());
            }
            setVisible(clearBtn, (input.val().length > 0));
        }
        function iconClick(e) {
            e.stopPropagation();

            if (e.target.className === 'iconClear') {
                input.val('');
                setVisible(clearBtn, false);
            }
            else if (e.target.className === 'iconSearch') {
                handler(input.val());
            }
        }

        input.attr('placeholder', placeholder)
            .on('keydown', inputKey);
        searchBox.find('span')
            .on('mousedown', noBrowserDefault)
            .on('click', iconClick);
        setVisible(clearBtn, false);
    };

    return SearchBox;
});

/** @jsx React.DOM */
define('controls/SelectionListDismissible',[
    'underscore', 'jquery', 'react',
    '../util/util',
    '../util/kendoutil'
], function (_, $, React, util, kendoutil) {
    'use strict';

    var $el = null;

    /**
     * Doesn't make any assumptions about the shape of the selection records. They don't
     * need an ID/valueField, we use the hash of the whole record as its identity.
     */
    var SelectionListDismissible = React.createClass({displayName: 'SelectionListDismissible',

        getDefaultProps: function () {
            return {
                className: 'content',
                height: '150',
                schema: {},
                onChange: undefined,
                value: undefined
            };
        },

        componentWillMount: function () {
            console.assert(this.props.value);
            console.assert(this.props.columns);
            console.assert(this.props.onChange);

            this.datastore = new kendo.data.DataSource({ data: this.props.value });
        },

        componentWillUpdate: function (nextProps, nextState) {
            if (nextProps.value !== this.props.value) {
                this.datastore.data(nextProps.value);
            }
        },

        componentWillUnmount: function () {
            $el = null;
        },

        render: function () {
            return (React.DOM.div( {className:this.props.className} ));
        },

        componentDidMount: function () {
            $el = $(this.getDOMNode());
            var self = this;

            var columns = [{
                title: '',
                template: '<span id="#: recordHash #" class="icon iconButton iconDelete" />',
                width: 34
            }];
            columns = _.map(columns.concat(this.props.columns), function (column) {
                column.template = kendoutil.templateWith(kendo.template(column.template), self.paramMapper);
                return column;
            });

            this.kendoGrid = $el.kendoGrid({
                dataSource: this.datastore,
                height: this.props.height,
                columns: columns,
                sortable: this.props.sortable,
                editable: this.props.editable,
                pageable: false
            }).data('kendoGrid');

            $el.on('click', '.iconDelete', this.onButtonClick);
        },

        paramMapper: function (record) {
            return _.extend(record, this.props.schema, { recordHash: util.hashRecord(record) });
        },

        onButtonClick: function (e) {
            var recordHashToBeRemoved = parseInt(e.target.getAttribute('id'), 10);

            var newValue = _.filter(this.props.value, function (record) {
                return util.hashRecord(record) !== recordHashToBeRemoved;
            });

            this.props.onChange(newValue);
        }
    });

    return SelectionListDismissible;
});
/** @jsx React.DOM */
define('AutoField',[
    'underscore', 'react', './FormField', './AutoControl', './ImmutableOptimizations'
], function (_, React, FormField, AutoControl, ImmutableOptimizations) {
    'use strict';


    var AutoField = React.createClass({displayName: 'AutoField',
        mixins: [ImmutableOptimizations],

        getDefaultProps: function () {
            return {
                fieldInfo: undefined,
                value: undefined,
                onChange: undefined,
                isValid: [true, '']
            };
        },

        render: function () {
            return (
                FormField( {fieldInfo:this.props.fieldInfo, isValid:this.props.isValid, key:this.props.fieldInfo.name}, 
                    AutoControl(
                        {fieldInfo:this.props.fieldInfo,
                        value:this.props.value,
                        onChange:this.props.onChange,
                        dataSource:this.props.fieldInfo.options} )
                )
            );
        }
    });


    return AutoField;
});
define('FluxFormMixin',[
    'underscore'
], function (_) {
    'use strict';

    /**
     * @Deprecated in favor of wingspan-cursors and Flux.js
     */
    var FluxFormMixin = {
        componentWillMount: function () {
            console.assert(this.formFields, 'Required to define the form; see SetOfficeStatusComponent for a working usage');
            console.assert(_.isFunction(this.isFieldValid), 'Need a field validation function');
        },

        getInitialState: function () {
            return {
                record: undefined
            };
        },

        onFieldChange: function (fieldName, newValue) {
            // When you setState, top level attributes are merged. Merge is not recursive.
            // So we have to merge the prev record with the new one manually.
            var nextState = { record: this.state.record };
            nextState['record'][fieldName] = newValue;

            // if this field is stickied, update the sticky value
            var stickiedFieldNames = _.keys(this.state.sticky || {});
            if (_.contains(stickiedFieldNames, fieldName)) {
                _.extend(nextState, { sticky: this.state.sticky });
                nextState['sticky'][fieldName] = newValue;
            }

            this.setState(nextState);
        },

        isFormValid: function () {
            if (this.state.record) {
                // form is valid if each field is valid
                return _.chain(this.formFields)
                    .map(this.isFieldValid)
                    .map(_.first)
                    .reduce(and)
                    .value();
            }
            else {
                return false;
            }

            function and(a, b) { return a && b; }
        }
    };

    return FluxFormMixin;
});

define('wingspan-forms',[
    './AutoControl',
    './FormField',
    './controls/Button',
    './controls/Carousel',
    './controls/CheckBox',
    './controls/KendoComboBox',
    './controls/KendoDate',
    './controls/KendoDatetime',
    './controls/KendoGrid',
    './controls/KendoGridPicker',
    './controls/KendoGridPickerByButton',
    './controls/KendoGridRadioSelectable',
    './controls/KendoListView',
    './controls/KendoMultiSelect',
    './controls/KendoNumber',
    './controls/KendoTabStrip',
    './controls/KendoText',
    './controls/MultiSelect',
    './controls/MultilineText',
    './controls/Radio',
    './controls/RadioGroup',
    './controls/SwitchBox',
    './controls/UserPicker',
    './controls/UserPickerPlus',
    './controls/KendoPager',
    './controls/PromiseButton',
    './controls/SearchBox',
    './controls/SelectionListDismissible',
    './ControlCommon',
    './AutoField',
    './FluxFormMixin'
], function (AutoControl, FormField, Button, Carousel, CheckBox, KendoComboBox, KendoDate, KendoDatetime,
             KendoGrid, KendoGridPicker, KendoGridPickerByButton, KendoGridRadioSelectable,
             KendoListView, KendoMultiSelect, KendoNumber, KendoTabStrip, KendoText, MultiSelect,
             MultilineText, Radio, RadioGroup, SwitchBox, UserPicker, UserPickerPlus,
             KendoPager, PromiseButton, SearchBox, SelectionListDismissible, ControlCommon,
             AutoField, FluxFormMixin) {
    'use strict';



    // This module should never actually be used.  It exists only to collect all of the top-level modules into one
    // place so that the require optimizer can do a single-page optimization across the entire application
    //
    // It also must collect all of the items from the component registry.  They are needed because they do not
    // have any "hard" require references that the optimizer can see.
    //
    // Specifically, parameters to the container function do not need to be declared, and this body should not do anything
    return {
        AutoControl: AutoControl,
        FormField: FormField,
        Button: Button,
        Carousel: Carousel,
        CheckBox: CheckBox,
        KendoComboBox: KendoComboBox,
        KendoDate: KendoDate,
        KendoDatetime: KendoDatetime,
        KendoGrid: KendoGrid,
        KendoGridPicker: KendoGridPicker,
        KendoGridPickerByButton: KendoGridPickerByButton,
        KendoGridRadioSelectable: KendoGridRadioSelectable,
        KendoListView: KendoListView,
        KendoMultiSelect: KendoMultiSelect,
        KendoNumber: KendoNumber,
        KendoTabStrip: KendoTabStrip,
        KendoText: KendoText,
        MultiSelect: MultiSelect,
        MultilineText: MultilineText,
        Radio: Radio,
        RadioGroup: RadioGroup,
        SwitchBox: SwitchBox,
        UserPicker: UserPicker,
        UserPickerPlus: UserPickerPlus,
        KendoPager: KendoPager,
        PromiseButton: PromiseButton,
        SearchBox: SearchBox,
        SelectionListDismissible: SelectionListDismissible,
        ControlCommon: ControlCommon,
        AutoField: AutoField,
        FluxFormMixin: FluxFormMixin
    };
});

    // Fake out the almond loader - shim these dependencies to their globals.
    // Make sure these globals are already on the page - e.g. by require-shims in the app
    define('underscore', function () { return _; });
    define('react', function () { return React; });
    define('jquery', function () { return $; });
    define('underscore.string', function () { return _s; });
    define('kendo', function () { return kendo; });
    define('q', function () { return Q; });

    return require('wingspan-forms');
}));

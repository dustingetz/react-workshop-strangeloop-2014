(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            'underscore',
            'react',
            'wingspan-cursor'
        ], factory);
    } else {
        root.JsonEditor = factory(root._, root.React, root.WingspanCursor);
    }
}(this, function (_, React, WingspanCursor) {
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

    /**
     * @jsx React.DOM
     */

    ((function(root) {
        var TreeView = React.createClass({
            render: function() {
                var self = this;
                // parse the data. format:
                // [
                //   {displayNode: bla, children: [bla, bla]},
                //   {displayNode: bla, children: [bla, bla]},
                // ]
                var wholeTree = this.props.source.map(function(item) {
                    return self._formatSource(item);
                });
                var className = this.props.className;
                return (
                    React.DOM.ul( {className:'treeview' + (className ? ' ' + className : '')},
                        wholeTree
                    )
                    );
            },

            _formatSource: function(child) {
                // recursively construct the markup by digging into child nodes
                var self = this;
                // simple uid for the child to let React diff correctly during `render`
                if (!child.displayNode.props.key) {
                    child.displayNode.props.key = Math.random();
                }
                return (
                    // `initiallyCollapsed` works only at the beginning, If `canToggle` is set
                    // to true, the tree node will naturally manage its expanded/collapsed
                    // state itself afterward
                    TreeNode(
                        {key:child.displayNode.props.key,
                            displayNode:child.displayNode,
                            initiallyCollapsed:child.initiallyCollapsed,
                            canToggle:child.canToggle == null ? true : child.canToggle,
                            toggleOnDoubleClick:this.props.toggleOnDoubleClick},

                        (child.children && child.children.length)
                            ? child.children.map(function(subChild) {
                            return self._formatSource(subChild);
                        })
                            : null

                    )
                    );
            },
        });

        var TreeNode = React.createClass({displayName: 'TreeNode',
            getDefaultProps: function() {
                return {canToggle: true};
            },

            getInitialState: function() {
                return {collapsed: this.props.initiallyCollapsed};
            },

            render: function() {
                var nodeClassName = 'treenode' +
                    (this.props.canToggle ? '' : ' treenode-no-toggle');

                return (
                    React.DOM.li( {className:nodeClassName},
                        React.DOM.div( {onClick:this.handleClick, onDoubleClick:this.handleDoubleClick},
                            React.DOM.div( {className:"treenode-arrow"},
                                    this.props.children && this.props.children.length
                                    ? this.state.collapsed ? '▸' : '▾'
                                    : null
                            ),
                            React.DOM.div( {className:"treenode-item"}, this.props.displayNode),
                            React.DOM.div( {className:"clearfix"})
                        ),
                        React.DOM.ul( {className:this.state.collapsed ? "treenode-collapsed" : ""},
                            this.props.children
                        )
                    )
                    );
            },

            handleClick: function() {
                if (!this.props.toggleOnDoubleClick && this.props.canToggle) {
                    this.setState({collapsed: !this.state.collapsed});
                }
            },

            handleDoubleClick: function() {
                if (this.props.toggleOnDoubleClick && this.props.canToggle) {
                    this.setState({collapsed: !this.state.collapsed});
                }
            }
        });

        root.TreeView = TreeView;
    })(this));

    define("react-treeview", ["react"], (function (global) {
        return function () {
            var ret, fn;
            return ret || global.TreeView;
        };
    }(this)));

    /** @jsx React.DOM */
    define('JsonLeafEditor',[
        'underscore', 'react', 'wingspan-cursor', 'react-treeview'
    ], function (_, React, Cursor, TreeView) {
        'use strict';

        var JsonLeafEditor = React.createClass({displayName: 'JsonLeafEditor',
            getDefaultProps: function () {
                return {
                    cursor: undefined
                };
            },

            getInitialState: function () {
                // Stringified value includes "type" - e.g. strings are quoted.
                return {
                    jsValue: JSON.stringify(this.props.cursor.value, undefined, 2),
                    editing: false
                };
            },

            componentWillReceiveProps: function (nextProps) {
                this.setState({
                    jsValue: JSON.stringify(nextProps.cursor.value, undefined, 2)
                })
            },

            render: function () {
                var classes = _.compact([
                    'JsonLeafEditor',
                    this.isDirty() ? 'dirty' : null,
                    !this.isValid() ? 'invalid' : null
                ]);

                var leaf = (this.state.editing
                    ? [(React.DOM.input( {key:"0", value:this.state.jsValue, onChange:this.onChange, style:{background: 'transparent'}})),
                    (React.DOM.button( {key:"1", onClick:this.commit, disabled:!this.isValid()}, "commit"))]
                    : [(React.DOM.code( {key:"2", className:"editButton", onClick:this.edit}, this.state.jsValue))]);

                return (
                    React.DOM.span( {className:classes.join(' ')},
                        leaf
                    )
                    );
            },

            onChange: function (e) {
                this.setState({ jsValue: e.target.value });
            },

            commit: function () {
                this.props.cursor.onChange(JSON.parse(this.state.jsValue));
                this.setState({ editing: false });
            },

            edit: function () {
                this.setState({ editing: true });
            },

            isValid: function () {
                try {
                    JSON.parse(this.state.jsValue);
                    return true;
                }
                catch (e) {
                    return false;
                }
            },

            isDirty: function () {
                if (!this.isValid()) return false; // we're invalid, not dirty
                var unmodified = _.isEqual(JSON.parse(this.state.jsValue), this.props.cursor.value);
                return !unmodified;
            },

            shouldComponentUpdate: function (nextProps, nextState) {
                return !(_.isEqual(this.props.cursor.value, nextProps.cursor.value) &&
                    _.isEqual(this.state, nextState));
            }
        });

        return JsonLeafEditor;
    });

    /** @jsx React.DOM */
    define('JsonEditor',[
        'underscore', 'react', 'wingspan-cursor', 'react-treeview',
        'JsonLeafEditor'
    ], function (_, React, Cursor, TreeView, JsonLeafEditor) {
        'use strict';


        var JsonEditor = React.createClass({displayName: 'JsonEditor',
            getDefaultProps: function () {
                return {
                    targetCursor: undefined, // the app state that we're targetting
                    toggleOnDoubleClick: false,
                    canToggle: true
                };
            },

            shouldComponentUpdate: function (nextProps, nextState) {
                var unchanged =
                    // cursor is a special object with function values - not JSON serializable
                    _.isEqual(_.omit(this.props, 'targetCursor'), _.omit(nextProps, 'targetCursor')) &&
                    // but the JsonEditor understands cursors so we can do the right thing
                    _.isEqual(this.props.targetCursor.value, nextProps.targetCursor.value) &&
                    _.isEqual(this.state, nextState);
                return !unchanged;
            },

            render: function () {
                var editorCursor = this.props.targetCursor; //Cursor.build(this.state, this.setState.bind(this), _.cloneDeep);

                return (
                    React.DOM.div(null,
                        TreeView( {className:"JsonEditor",
                            source:buildConfig(editorCursor),
                            toggleOnDoubleClick:this.props.toggleOnDoubleClick,
                            canToggle:this.props.canToggle} )
                    )
                    );
            }
        });


// time to parse it into a format the tree view recognizes
// [
//   {displayNode: bla, children: [bla, bla]},
//   {displayNode: bla, children: [bla, bla]},
// ]

        function buildConfigArray (nodes) {
            // array of cursors
            // convert the array into an object where the key is the index
            var xs = _.object(_.map(nodes, function (node, i) {
                return [i, node];
            }));

            return _.map(xs, buildConfigObject); // recursion
        }

        function buildConfigObject (cursor, key) {
            var node = cursor.value;
            // node is an: object, array, or primitive
            // if its an array, we need to turn it into a map, and name each element in the array

            if (node instanceof Array) {
                // expand Cursor[List[T]] into List[Cursor[T]]
                var acc = [];
                _.each(cursor.value, function (el, i) {
                    acc.push(cursor.refine(i));
                });

                return {
                    displayNode: displayNodeLabel(key + ' [' + node.length + ']'),
                    children: buildConfigArray(acc) // list of refined cursors
                };
            }
            else if (node instanceof Object) { // {a:'a', b:'b'}
                return {
                    displayNode: displayNodeLabel(key),
                    children: mapCursorKV(cursor, buildConfigObject)   // recursion
                };
            }
            else { // primitive
                return {
                    displayNode: displayLeaf(key, cursor)
                };
            }
        }

        function buildConfig (rootNode) {
            if (rootNode instanceof Array) return buildConfigArray(rootNode);
            return [buildConfigObject(rootNode, 'root')];
        }

        function displayLeaf (key, cursor) {
            return (
                React.DOM.span( {key:key},
                    React.DOM.code(null, key,": " ),
                    JsonLeafEditor( {cursor:cursor} )
                )
                );
        }

        function displayNodeLabel (label) {
            return (React.DOM.code( {key:label}, label));
        }

        function mapCursorKV (cursor, f) {
            // map over the kv pairs, using f(cursor.refine[key], key) rather than f(obj[key], key)
            var acc = [];
            _.each(_.keys(cursor.value), function (key) {
                var val = f(cursor.refine(key), key);
                acc.push(val); // not [key, val]
            });
            return acc; // like _.map, it is call site's responsibility to call _.object if desired
        }



        return JsonEditor;

    });
    define('react-json-editor',[
        'JsonEditor'
    ], function (JsonEditor) {
        'use strict';

        return JsonEditor;
    });

// Fake out the almond loader - shim these dependencies to their globals.
    // Make sure these globals are already on the page - e.g. by require-shims in the app
    define('underscore', function () { return _; });
    define('react', function () { return React; });
    define('wingspan-cursor', function () { return WingspanCursor; });

    return require('react-json-editor');
}));

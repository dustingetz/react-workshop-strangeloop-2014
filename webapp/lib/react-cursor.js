(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['react', 'underscore'], factory);
    } else {
        root.ReactCursor = factory(root.React, root._);
    }
}(this, function (React, _) {
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

    define('util',[], function () {
        'use strict';

        function getRefAtPath(tree, paths) {
            return reduce(paths, deref, tree);
        }

        function deref(obj, key) {
            return obj[key];
        }

        function unDeref(obj, key) {
            var nextObj = {};
            nextObj[key] = obj;
            return nextObj;
        }

        function initial(array) {
            return array.slice(0, array.length - 1);
        }

        function last(array) {
            return array[array.length - 1];
        }

        function reduce(array, f, mzero) {
            return array.reduce(f, mzero);
        }

        function flatten(listOfLists) {
            return [].concat.apply([], listOfLists);
        }

        /**
         * Hash of null is null, hash of undefined is undefined
         */
        function hashString(str) {
            var hash = 0, i, ch, l;
            if (str === undefined || str === null) {
                return str;
            }
            if (str.length === 0) {
                return hash;
            }
            for (i = 0, l = str.length; i < l; i++) {
                ch  = str.charCodeAt(i);
                hash  = ((hash << 5) - hash) + ch;
                hash |= 0; // Convert to 32bit integer
            }
            return hash;
        }

        function generateUUID () {
            var d = new Date().getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = (d + Math.random()*16)%16 | 0;
                d = Math.floor(d/16);
                return (c=='x' ? r : (r&0x7|0x8)).toString(16);
            });
            return uuid;
        }


        function hashRecord(record) {
            return hashString(JSON.stringify(record));
        }

        /**
         * Generate a unique thing to use as a memoize resolver hash for reference types.
         */
        var refsCache = {}; // { id: cmp }
        function refToHash (cmp) {
            // search the cmpUniqueMap by reference - have we seen it before?
            // if so, use the assigned id as the hash
            // if not, add to cache and generate a new ID to hash on

            var cmpsWithUid = _.pairs(refsCache);
            var cmpFound = _.find(cmpsWithUid, function (cmpAndId) { return cmpAndId[1] === cmp; });
            if (cmpFound) {
                return cmpFound[0]; // return the uid
            }
            else {
                var uid = generateUUID();
                refsCache[uid] = cmp;
                return uid;
            }
        }

        function memoizeFactory (resolver) {
            var cache = {};
            function memoize(func) {
                return function () {
                    var key = resolver ? resolver.apply(this, arguments) : arguments[0];
                    return hasOwnProperty.call(cache, key)
                        ? cache[key]
                        : (cache[key] = func.apply(this, arguments));
                };
            }
            return memoize;
        }

        return {
            getRefAtPath: getRefAtPath,
            deref: deref,
            unDeref: unDeref,
            initial: initial,
            last: last,
            reduce: reduce,
            flatten: flatten,
            hashString: hashString,
            generateUUID: generateUUID,
            hashRecord: hashRecord,
            refToHash: refToHash,
            memoizeFactory: memoizeFactory
        };
    });
    define('Cursor',['react', 'util'], function (React, util) {
        'use strict';


        function Cursor(cmp, path, value) {
            // value to put in the DOM, use from render() and the component lifecycle methods
            this.value = value;

            this.pendingValue = function () {
                // the current value right now, use in event handlers
                return util.getRefAtPath(cmp._pendingState || cmp.state, path);
            };

            this.onChange = _.partial(onChange, cmp, path);

            this.refine = function (/* one or more paths through the tree */) {
                // When refining inside a lifecycle method, same cmp and same path isn't enough.
                // this.props and nextProps have different subtree values, and refining memoizer must account for that

                var nextPath = [].concat(path, util.flatten(arguments));
                var nextValue = util.getRefAtPath(this.value, _.toArray(arguments));
                return build(cmp, nextPath, nextValue); // memoized
            };
        }

        function onChange(cmp, path, nextValue) {
            var nextState;

            if (path.length > 0) {
                nextState = React.addons.update(
                        cmp._pendingState || cmp.state,
                    path.concat('$set').reduceRight(util.unDeref, nextValue)
                );
            }
            else if (path.length === 0) {
                nextState = nextValue;
            }
            cmp.setState(nextState);
        }


        // If we build two cursors for the same path on the same React component,
        // and those React components have equal state, reuse the same cursor instance,
        // so we can use === to compare them.
        var cursorBuildMemoizer = util.memoizeFactory(function (cmp, path, value) {
            path = path === undefined ? [] : path;
            value = value || util.getRefAtPath(cmp.state, path);
            return util.refToHash(cmp) + util.hashRecord(value) + util.hashRecord(path);
            // I think we want to clamp this to cachesize === 2, because we only
            // care about this.state and nextState.
        });

        var build = cursorBuildMemoizer(function (cmp, path, value) {
            path = path === undefined ? [] : path;
            value = value || util.getRefAtPath(cmp.state, path);
            return new Cursor(cmp, path, value);
        });


        return { build: build };
    });

    define('ImmutableOptimizations',[
        'underscore'
    ], function (_) {
        'use strict';

        function ImmutableOptimizations (refFields, ignoredFields/*optional*/) {
            ignoredFields = ignoredFields === undefined ? [] : ignoredFields;
            return {
                shouldComponentUpdate: function (nextProps) {
                    var valuesChanged = !_.isEqual(
                        _.omit(nextProps, _.union(refFields, ignoredFields)),
                        _.omit(this.props, _.union(refFields, ignoredFields)));

                    var refsChanged = !_.every(refFields, function (field) {
                        return this.props[field] === nextProps[field];
                    }.bind(this));

                    return valuesChanged || refsChanged;
                }
            };
        }

        return ImmutableOptimizations;
    });

    define('react-cursor',[
        'Cursor', 'ImmutableOptimizations'
    ], function (Cursor, ImmutableOptimizations) {
        'use strict';

        return {
            build: Cursor.build,
            ImmutableOptimizations: ImmutableOptimizations
        };
    });
    // Fake out the almond loader - shim these dependencies to their globals.
    // Make sure these globals are already on the page - e.g. by require-shims in the app
    define('react', function () { return React; });
    define('underscore', function () { return _; });

    return require('react-cursor');
}));

define([
    'underscore'
], function (_) {
    'use strict';



    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function containsDeep(haystack, needle) {
        return !!_.find(haystack, function (h) {
            return _.isEqual(h, needle);  // deep value equality
        });
    }

    function uniqueDeep(xs) {
        return _.reduce(xs, function (acc, x) {
            return (!containsDeep(acc, x)
                ? acc.concat(x) // this returns a new array, does not mutate inline
                : acc);
        }, []);
    }

    function unionDeep(/* set1, set2, ... */) {
        return uniqueDeep(_.flatten(arguments));
    };

    /**
     * util.differenceDeep([{z: 0}, {b: 2}, {a: 3}], {a: 3}, {z: 0})   // => [{b: 2}]
     */
    function differenceDeep(/* set1, set2, ... */) {
        var removeTheseItems = _.flatten(_.tail(arguments));
        var fromTheseItems = _.head(arguments);
        return _.filter(fromTheseItems, function (x) {
            // if the current item in the first set exists in any of the other sets,
            // it should not be in the difference.
            var shouldRemove = containsDeep(removeTheseItems, x);
            return !shouldRemove;
        });
    };


    return {
        deepClone: deepClone,
        containsDeep: containsDeep,
        uniqueDeep: uniqueDeep,
        unionDeep: unionDeep,
        differenceDeep: differenceDeep
    };

});

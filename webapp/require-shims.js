/* global require */
(function () {
    'use strict';

    require.config({
        baseUrl: 'js',
        paths: {
            'underscore': '../lib/underscore',
            'underscore.string': '../lib/underscore.string',
            'jquery': '../lib/jquery',
            'kendo': '../lib/kendo-ui/js/kendo.web',
            'moment': '../lib/moment',
            'react': '../lib/react-with-addons',
            'jsx': '../lib/jsx',
            'JSXTransformer': '../lib/JSXTransformer',
            'es5-shim': '../lib/es5-shim',
            'text': '../lib/text',
            'q': '../lib/q',
            'wingspan-forms': '../lib/wingspan-forms/wingspan-forms',
            'wingspan-contrib': '../lib/wingspan-contrib',
            'react-cursor': '../lib/react-cursor',
            'react-json-editor': '../lib/react-json-editor/react-json-editor',
            'textassets': '../textassets/'
        },
        shim: {
            'underscore': { deps: [], exports: '_' },
            'underscore.string': { exports: '_s' },
            'jquery': { deps: [], exports: '$' },
            'kendo': { deps: [], exports: 'kendo' },
            'moment': { deps: [], exports: 'moment' },
            'react': { deps: [], exports: 'React'},
            'JSXTransformer': { exports: 'JSXTransformer' },
            'wingspan-forms': { deps: ['underscore', 'react', 'jquery', 'kendo', 'moment', 'underscore.string'], exports: 'WingspanForms' },
            'wingspan-contrib': { deps: ['underscore', 'jquery', 'underscore.string', 'moment', 'q'], exports: 'WingspanContrib' },
            'react-cursor': { deps: [], exports: 'ReactCursor' },
            'react-json-editor': { deps: [], exports: 'JsonEditor' }
        }
    });
})();

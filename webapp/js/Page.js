/** @jsx React.DOM */
define([
    'underscore', 'react'
], function (_, React) {
    'use strict';


    var App = React.createClass({
        render: function () {
            return (
                <div className="App">Hello, {this.props.name}</div>
            );
        }
    });


    function entrypoint(rootEl) {
        React.renderComponent(<App name="World" />, rootEl);
    }

    return {
        entrypoint: entrypoint
    };
});

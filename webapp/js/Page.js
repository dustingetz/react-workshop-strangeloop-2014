/** @jsx React.DOM */
define([
    'underscore', 'react', 'jquery', 'wingspan-forms', 'wingspan-cursor', 'wingspan-contrib',
    'util',
    'text!textassets/types/Contact.json',
    'text!textassets/contacts.json'
], function (_, React, $, Forms, Cursor, Contrib,
             util, ContactModel, contacts) {
    'use strict';

    var ContactModel = JSON.parse(ContactModel).data;
    var contacts = JSON.parse(contacts).data;


    var App = React.createClass({
        getInitialState: function () {
            return {
                MasterDetail: {
                    database: contacts,
                    form: contacts[0]
                }
            };
        },

        render: function () {
            window.App = this;

            return (
                <div className="App">
                    <pre>{JSON.stringify(this.state, undefined, 2)}</pre>
                </div>
            );
        }
    });


    window.Cursor = Cursor;
    window.util = util;

    function entrypoint(rootEl) {
        React.renderComponent(<App/>, rootEl);
    }

    return {
        entrypoint: entrypoint
    };
});

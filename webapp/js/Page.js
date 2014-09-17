/** @jsx React.DOM */
define([
    'underscore', 'react', 'wingspan-forms', 'react-cursor', 'text!textassets/types/Contact.json'
], function (_, React, Forms, Cursor, ContactJSON) {
    'use strict';

    var KendoText = Forms.KendoText;
    var FormField = Forms.FormField;
    var KendoComboBox = Forms.KendoComboBox;
    var AutoControl = Forms.AutoControl;
    var fieldInfos = JSON.parse(ContactJSON);

    var PrettyJSON = React.createClass({
        render: function () {
            return (
                <pre>{JSON.stringify(this.props.value, undefined, 2)}</pre>
            );
        }
    });

    var AutoField = React.createClass({
        render: function () {
            return (
                <FormField fieldInfo={this.props.fieldInfo}>
                    <AutoControl
                        fieldInfo={this.props.fieldInfo}
                        value={this.props.value}
                        onChange={this.props.onChange} />
                </FormField>
            );
        }
    });

    var AutoForm = React.createClass({
        shouldComponentUpdate: function (nextProps, nextState) {
            return this.props.cursor !== nextProps.cursor;
        },
        render: function () {
            var controls = _.map(this.props.fieldInfos, function (fieldInfo) {
                var fieldCursor = this.props.cursor.refine(fieldInfo.name);
                return (
                    <AutoField
                        fieldInfo={fieldInfo}
                        value={fieldCursor.value}
                        onChange={fieldCursor.onChange} />
                    );
            }.bind(this));

            return (
                <div>
                {controls}
                </div>
            );
        }
    });

    var App = React.createClass({
        getInitialState: function () {
            return {
                form: { firstName: '',  lastName: '', gender: '', age: '', birthday: '' },
                database: [
                    { firstName: 'Alice', lastName: 'Adams',  gender: 'female', age: '27', birthday: '1987-03-03' },
                    { firstName: 'Bob',   lastName: 'Basker', gender: 'male',   age: '72', birthday: '1942-05-18' },
                    { firstName: 'Carol', lastName: 'Carson', gender: 'female', age: '38', birthday: '1976-08-05' },
                    { firstName: 'Daryl', lastName: 'Dawson', gender: 'male',   age: '24', birthday: '1990-02-17' }
                ]
            };
        },
        render: function () {
            var cursor = Cursor.build(this);
            var buttons = _.map(this.state.database, function (record) {
                return (
                    <li>
                        <button onClick={_.partial(cursor.refine('form').onChange, record)}>
                            {record.lastName}
                        </button>
                    </li>
                );
            });
            return (
                <div className="App">
                    <div className="MasterDetailDemo">
                        <div>
                            <ol>{buttons}</ol>
                            <AutoForm fieldInfos={fieldInfos} cursor={cursor.refine('form')} />
                        </div>
                    </div>
                    <PrettyJSON value={this.state} />
                </div>
            );
        }
    });

    function entrypoint(rootEl) {
        React.renderComponent(<App />, rootEl);
        Forms.ControlCommon.attachFormTooltips($('body'));
    }

    return {
        entrypoint: entrypoint
    };
});

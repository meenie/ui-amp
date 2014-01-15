var app = angular.module('app', ['ui-amp']);

app.config(function($ampProvider) {
    $ampProvider.setScope('asdf');
});

app.controller('AppCtrl', function($amp) {
    var Ctrl = this;

    Ctrl.hello = "I'm in an iframe!";
    Ctrl.data = [];

    $amp.notify('hi', {message: 'Hi from iframe!'});

    var count = 0;
    Ctrl.getData = function() {
        $amp.call('getData', {count: count}).then(function(data) {
            count = data;
            Ctrl.data.push(data);
        });
    };

    $amp.call('noMethod', {hmm: 'cool'}).then(function(data) {
        console.log(data)
    }, function(error) {
        console.log(error);
    });
});

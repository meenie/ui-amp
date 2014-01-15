var app = angular.module('app', ['ui-amp']);

app.config(function($ampProvider) {
    $ampProvider.setScope('my-scope');
});

app.controller('AppCtrl', function($amp) {
    var Ctrl = this;

    Ctrl.hello = "I'm in an iframe!";
    Ctrl.data = [];

    $amp.notify('hi', {message: 'Hi from iframe!'});

    var count = 0;
    Ctrl.getData = function() {
        $amp.call('getData', {count: count}).then(function(res) {
            count = res.result;
            Ctrl.data.push(res.result);
        });

        $amp.call('triggerReject').then(function(res) {
            console.log(res);
        }, function(error) {
            console.log(error);
        });
    };

    $amp.call('noMethod', {hmm: 'cool'}).then(function(res) {
        console.log(res)
    }, function(error) {
        console.log(error);
    });

    $amp.listen('amp.error', function(res) {
        console.log(res);
    });
});

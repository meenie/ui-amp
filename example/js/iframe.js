var app = angular.module('app', ['ui-amp']);

app.config(function($ampProvider) {
    $ampProvider.setScope('my-scope');
});
app.run(function($amp) {
    $amp.notify('hi', {message: 'Hi from iframe!'});
});

app.controller('AppCtrl', function($amp, $scope) {
    var Ctrl = this;

    Ctrl.hello = "I'm in an iframe!";
    Ctrl.data = [];

    var count = 0;
    Ctrl.getData = function() {
        $amp.call('getData', {count: count}).then(function(res) {
            count = res.result;
            Ctrl.data.push(res.result);
        });

        $amp.call('triggerReject').then(function() {}, function(error) {
            console.log('User rejected promise:', error);
        });
    };

    $amp.call('noMethod', {hmm: 'cool'}).then(function() {}, function(error) {
        console.log('No Method, $amp rejected promise:', error);
    });

    // This picks up any response errors
    $scope.$on('$ampResponseError', function(event, resp) {
        console.log('$ampResponseError:', resp);
    });

    // This picks up any response successes
    $scope.$on('$ampResponseSuccess', function(event, resp) {
        console.log('$ampResponseSuccess:', resp);
    });
});

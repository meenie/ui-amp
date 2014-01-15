var app = angular.module('app', ['ui-amp']);

app.config(function($ampProvider) {
    $ampProvider.setScope('my-scope');
    $ampProvider.setAllowedOrigins('http://localhost:63342');
});

app.controller('AppCtrl', function($amp, $q) {

    var Ctrl = this;

    Ctrl.hello = 'Hi!';

    $amp.listen('hi', function(req) {
        Ctrl.hello = req.params.message;
    });

    $amp.listen('hi', function(req) {
        console.log(req);
    });

    $amp.bind('getData', function(req) {
        return req.params.count + 1;
    });

    $amp.bind('getData', function(req) {
        return [1];
    });

    $amp.bind('triggerReject', function(req) {
        return $q.reject('Nope!');
    });

    $amp.listen('getData', function(req) {
        console.log(req);
    });
});

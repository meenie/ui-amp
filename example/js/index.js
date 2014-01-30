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


    /*$amp.bind('getData', function(req) {
        return req.params.count + 1;
    });

    // This should fail because it binds to the same method twice
    $amp.bind('getData', function(req) {
        return [1];
    });

    // This should be okay because it just listens
    $amp.listen('getData', function(req) {
        console.log('Parent listening to getData:', req);
    });

    $amp.bind('triggerReject', function(req) {
        return $q.reject('Nope!');
    });*/
});

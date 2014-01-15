var app = angular.module('app', ['ui-amp']);

app.config(function($ampProvider) {
    $ampProvider.setScope('asdf');
});

app.controller('AppCtrl', function($amp) {

    var Ctrl = this;

    Ctrl.hello = 'Hi!';

    $amp.listen('hi', function(res) {
        Ctrl.hello = res.params.message;
    });

    $amp.listen('hi', function(res) {
        console.log(res);
    });

    $amp.bind('getData', function(req) {
        console.log(this);
        return req.params.count + 1;
    });

    $amp.bind('getData', function(req) {
        return [1];
    });

    $amp.listen('getData', function(data) {
        console.log(data);
    });
});

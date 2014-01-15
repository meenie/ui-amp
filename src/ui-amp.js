(function () {
    var module = angular.module('ui-amp', []);

    module.provider('$amp', function () {
        var targetWindow,
            targetOrigin = '*',
            scope = '',
            subscriptions = [],
            pendingPromises = {},
            currentId = 1,
            postMessage = function (message) {
                message = angular.toJson(message);
                if (scope) {
                    message = scope + ':' + message;
                }

                targetWindow.postMessage(message, targetOrigin);
            },
            checkIfAlreadyBound = function(method) {
                var index = -1,
                    length = subscriptions.length;

                while (++index < length) {
                    var sub = subscriptions[index];
                    if (! sub.atomic ) {
                        continue;
                    }

                    if (sub.method === method) {
                        return true;
                    }
                }

                return false;
            },
            getSubsToCall = function(method) {
                var index = -1,
                    length = subscriptions.length,
                    ret = [];

                while (++index < length) {
                    var sub = subscriptions[index];
                    if (sub.method === method) {
                        ret.push(sub);
                    }
                }

                return ret;
            };

        this.setTargetOrigin = function (_targetOrigin) {
            targetOrigin = _targetOrigin;
        };

        this.setScope = function (_scope) {
            scope = _scope;
        };

        this.$get = function ($rootScope, $window, $q) {
            $window.addEventListener('message', function (event) {
                // We are only concerned about messages that are strings
                if (typeof event.data !== 'string') {
                    return;
                }

                // Only want to listen to messages that are within scope
                if (event.data.substr(0, scope.length) !== scope) {
                    return;
                }

                var requestString = event.data.substr(scope.length + (scope ? 1 : 0)),
                    request = angular.fromJson(requestString),
                    subs = getSubsToCall(request.method);

                /**
                 * If no subs and the request has an ID, it means we should
                 * send back a "Method not found" error response
                 */
                if (subs.length === 0 && typeof request.id !== 'undefined') {
                    postMessage({
                        error: {
                            code: -32601,
                            message: 'Method not found'
                        },
                        method: 'amp.error',
                        id: request.id
                    });
                }

                angular.forEach(subs, function (sub) {
                    $rootScope.$apply(function () {
                        var reply = sub.callback(request);

                        if (
                            typeof request.id === 'undefined' ||
                            request.method === 'amp.reply' ||
                            request.method === 'amp.error' ||
                            ! sub.atomic
                        ) {
                            return;
                        }

                        $q.when(reply).then(function (result) {
                            postMessage({
                                method: 'amp.reply',
                                result: result,
                                id: request.id
                            });
                        });
                    });
                });
            });

            var methods = {
                call: function (method, params) {
                    var deferred = $q.defer(),
                        message = {
                            method: method,
                            params: params,
                            id: currentId++
                        };

                    pendingPromises[message.id] = deferred;

                    postMessage(message);

                    return deferred.promise;
                },
                notify: function (method, params) {
                    postMessage({method: method, params: params});
                },
                bind: function (method, callback) {
                    if (checkIfAlreadyBound(method)) {
                        console.error('Method: ' + method + ' can only be bound once.')
                        return;
                    }
                    subscriptions.push({
                        method: method,
                        callback: callback,
                        atomic: true
                    });
                },
                listen: function (method, callback) {
                    subscriptions.push({
                        method: method,
                        callback: callback,
                        atomic: false
                    });
                },
                setTargetWindow: function (_targetWindow) {
                    if (typeof _targetWindow.contentWindow !== 'undefined') {
                        _targetWindow = _targetWindow.contentWindow;
                    }

                    targetWindow = _targetWindow;
                }
            };

            methods.bind('amp.error', function(res) {
                var deferred = pendingPromises[res.id];

                if (! deferred) {
                    throw new Error ('Something really went wrong, there are no pending promise...');
                }

                delete pendingPromises[res.id];

                deferred.reject(res.error);
            });

            methods.bind('amp.reply', function(res) {
                var deferred = pendingPromises[res.id];

                if (! deferred) {
                    throw new Error ('Something really went wrong, there are no pending promise...');
                }

                delete pendingPromises[res.id];

                deferred.resolve(res.result);
            });

            // If inside an iframe, automatically set the targetWindow
            if ($window.top !== $window.self) {
                methods.setTargetWindow($window.parent);
            }

            return methods;
        };
    });

    module.directive('ampTarget', function ($amp) {
        return {
            restrict: 'A',
            link: function postLink(scope, elem, attr) {
                $amp.setTargetWindow(elem[0]);
            }
        }
    });
})();

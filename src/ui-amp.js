(function () {
    var module = angular.module('ui-amp', []);

    module.constant('ErrorObjects', {
        PARSE_ERROR: {
            code: -32700,
            message: 'Parse error',
            data: {}
        },
        INVALID_REQUEST: {
            code: -32600,
            message: 'Invalid request',
            data: {}
        },
        METHOD_NOT_FOUND: {
            code: -32601,
            message: 'Method not found',
            data: {}
        },
        INVALID_PARAMS: {
            code: -32602,
            message: 'Invalid params',
            data: {}
        },
        INTERNAL_ERROR: {
            code: -32603,
            message: 'Internal error',
            data: {}
        },
        REQUEST_ERROR: {
            code: -32100,
            message: '',
            data: {}
        }
    });
    module.provider('$amp', function () {
        var targetWindow,
            jsonrpcVersion = '2.0',
            targetOrigin = '*',
            allowedOrigins = [],
            scope = '',
            subscriptions = [],
            pendingPromises = {},
            currentId = 1,
            postMessage = function (message) {
                message['jsonrpc'] = jsonrpcVersion;
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

        this.setAllowedOrigins = function (_allowedOrigins) {
            if (typeof _allowedOrigins === 'string') {
                _allowedOrigins = [_allowedOrigins];
            }

            allowedOrigins = _allowedOrigins;
        };

        this.setScope = function (_scope) {
            scope = _scope;
        };

        this.$get = function ($rootScope, $window, $q, ErrorObjects) {
            $window.addEventListener('message', function (event) {
                // If allowedOrigins is specified, check to make sure it's legit
                if (allowedOrigins.length > 0 && allowedOrigins.indexOf(event.origin) === -1) {
                    return;
                }

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
                    subs = getSubsToCall(request.method),
                    subsIndex = -1,
                    subsCount = subs.length;

                /**
                 * If no subs were found and the request has an ID,
                 * it means we should send back a "Method not found" error response
                 */
                if (subsCount === 0 && typeof request.id !== 'undefined') {
                    var error = ErrorObjects.METHOD_NOT_FOUND;
                    error.data.request = request;

                    postMessage({
                        error: error,
                        method: 'amp.error',
                        id: request.id
                    });
                }

                while (++subsIndex < subsCount) {
                    var sub = subs[subsIndex],
                        reply = sub.callback(request);

                    /**
                     * Check to see if we need to post a response/error message
                     */
                    // @TODO - Figure out a better way to do this...icky!
                    if (
                        typeof request.id === 'undefined' ||
                        request.method === 'amp.response' ||
                        request.method === 'amp.error' ||
                        ! sub.atomic
                    ) {
                        continue;
                    }

                    $q.when(reply).then(function (result) {
                        postMessage({
                            method: 'amp.response',
                            result: result,
                            id: request.id
                        });
                    }, function(errorMessage) {
                        var error = ErrorObjects.REQUEST_ERROR;
                        error.message = errorMessage;
                        error.data.request = request;
                        postMessage({
                            error: error,
                            method: 'amp.error',
                            id: request.id
                        });
                    });
                }

                $rootScope.$digest();
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
                        console.error('Method: ' + method + ' can only be bound once.');
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

                deferred.reject(res);
            });

            methods.bind('amp.response', function(res) {
                var deferred = pendingPromises[res.id];

                if (! deferred) {
                    throw new Error ('Something really went wrong, there are no pending promise...');
                }

                delete pendingPromises[res.id];

                deferred.resolve(res);
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

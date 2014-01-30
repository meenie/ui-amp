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
            internalMethods = ['rpc.error', 'rpc.response'],
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
            getSubToCall = function(method) {
                if (internalMethods.indexOf(method) !== -1) {
                    console.log(method);
                    return false;
                }

                var index = -1,
                    length = subscriptions.length;

                while (++index < length) {
                    var sub = subscriptions[index];

                    if (sub.method === method && sub.atomic) {
                        return sub;
                    }
                }

                return false;
            },
            getSubsToNotify = function(method) {
                var index = -1,
                    length = subscriptions.length,
                    ret = [];

                while (++index < length) {
                    var sub = subscriptions[index];
                    if (sub.method === method && ! sub.atomic) {
                        ret.push(sub);
                    }
                }

                return ret;
            },
            checkIfRequestIsValid = function(request) {
                // Request MUST be an object
                if (typeof request !== 'object') {
                    return false;    
                }

                // jsonrpc MUST be defined
                if (typeof request.jsonrpc === 'undefined') {
                    return false;
                }

                // jsonrpc MUST equal the current JSON-RPC version
                if (request.jsonrpc !== jsonrpcVersion) {
                    return false;
                }

                // method MUST be a string
                if (typeof request.method !== 'string') {
                    return false;
                }

                // method CANNOT start with 'rpc.' if not internal
                if (request.method.substr(0, 4) === 'rpc.' && internalMethods.indexOf(request.method) === -1) {
                    return false;
                }
                
                return true;
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
            var handleRequest = function(request) {
                if (! checkIfRequestIsValid(request)) {
                    var invalidRequest = ErrorObjects.INVALID_REQUEST;
                    invalidRequest.data.request = request;

                    return {
                        error: invalidRequest,
                        method: 'rpc.error',
                        id: request.id
                    }
                }

                var subToCall = getSubToCall(request.method),
                    subsToNotify = getSubsToNotify(request.method),
                    subsIndex = -1,
                    subsCount = subsToNotify.length;

                /**
                 * If no subs were found and the request has an ID,
                 * it means we should send back a "Method not found" error response
                 */
                if (subsCount === 0 && ! subToCall && typeof request.id !== 'undefined') {
                    var methodNotFound = ErrorObjects.METHOD_NOT_FOUND;
                    methodNotFound.data.request = request;

                    return  {
                        error: methodNotFound,
                        method: 'rpc.error',
                        id: request.id
                    };
                }

                while (++subsIndex < subsCount) {
                    var sub = subsToNotify[subsIndex];
                    sub.callback(request);
                }

                if (subToCall) {
                    return $q.when(subToCall.callback(request)).then(function (result) {
                        return {
                            method: 'rpc.response',
                            result: result,
                            id: request.id
                        };
                    }, function(errorMessage) {
                        var error = ErrorObjects.REQUEST_ERROR;
                        error.message = errorMessage;
                        error.data.request = request;

                        return {
                            error: error,
                            method: 'rpc.error',
                            id: request.id
                        };
                    });
                }

                return false;
            };

            $window.addEventListener('message', function (message) {
                // If allowedOrigins is specified, check to make sure it's legit
                if (allowedOrigins.length > 0 && allowedOrigins.indexOf(message.origin) === -1) {
                    return;
                }

                // We are only concerned about messages that are strings
                if (typeof message.data !== 'string') {
                    return;
                }

                // Only want to listen to messages that are within scope
                if (message.data.substr(0, scope.length) !== scope) {
                    return;
                }

                try {
                    var requestString = message.data.substr(scope.length + (scope ? 1 : 0)),
                        request = angular.fromJson(requestString);
                } catch (e) {
                    if (e.name === 'SyntaxError') {
                        var parseError = ErrorObjects.PARSE_ERROR;
                        parseError.data.requestString = message.data;
                        postMessage({
                            error: parseError,
                            method: 'rpc.error',
                            id: null
                        });
                    }

                    return;
                }

                if (Array.isArray(request)) {
                    if (request.length === 0) {
                        // If it's an empty array, return an invalidRequest rpc.error
                        postMessage({
                            error: ErrorObjects.INVALID_REQUEST,
                            method: 'rpc.error',
                            id: null
                        });
                    } else {
                        var index = -1,
                            promises = [];
                        while (++index < request.length) {
                            var promise = handleRequest(request[index]);
                            if (promise !== false) {
                                promises.push(promise);
                            }
                        }

                        $q.all(promises).then(function(result) {
                            if (result.length > 0) {
                                postMessage(promises);
                            }
                        });
                    }
                } else {
                    $q.when(handleRequest(request)).then(function(result) {
                        if (result !== false) {
                            postMessage(result);
                        }
                    });
                }

                $rootScope.$digest();
            });

            var methods = {
                call: function (method, params) {
                    if (method.substr(0, 4) === 'rpc.') {
                        console.error('$amp.call() is not allowed on methods that begin with rpc.');

                        return false;
                    }

                    var deferred = $q.defer(),
                        message = {
                            method: method,
                            params: params,
                            id: currentId++
                        };

                    pendingPromises[message.id] = deferred;

                    postMessage(message);

                    $rootScope.$broadcast('$ampCallStart', message);

                    return deferred.promise;
                },
                notify: function (method, params) {
                    if (method.substr(0, 4) === 'rpc.') {
                        console.error('$amp.notify() is not allowed on methods that begin with rpc.');
                        return;
                    }

                    var message = {method: method, params: params}

                    postMessage(message);

                    $rootScope.$broadcast('$ampNotify', message);
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
                    if (method.substr(0, 4) === 'rpc.') {
                        console.error('$amp.listen() is not allowed on methods that begin with rpc.');

                        return;
                    }

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

            methods.bind('rpc.error', function(res) {
                var deferred = pendingPromises[res.id];

                if (! deferred) {
                    throw new Error ('Something really went wrong, there are no pending promises...');
                }

                delete pendingPromises[res.id];

                $rootScope.$broadcast('$ampResponseError', res);

                deferred.reject(res);
            });

            methods.bind('rpc.response', function(res) {
                var deferred = pendingPromises[res.id];

                if (! deferred) {
                    throw new Error ('Something really went wrong, there are no pending promises...');
                }

                delete pendingPromises[res.id];

                $rootScope.$broadcast('$ampResponseSuccess', res);

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
            link: function postLink(scope, elem) {
                $amp.setTargetWindow(elem[0]);
            }
        }
    });
})();

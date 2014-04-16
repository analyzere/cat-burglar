var m = angular.module('catburglar.services.restApi', ['restangular']);
m.provider('restApi', function() {
  var strRetryAfter = 'Retry-After';
  var strLayerViews = 'layer_views';
  var strPortfolioViews = 'portfolio_views';
  var strTailMetrics = 'tail_metrics';
  var strExceedanceProb = 'exceedance_probabilities';
  var strDefault = 'default';

  /* PROVIDED SERVICE */
  this.$get = function($timeout, Restangular) {

    /* HELPER FUNCTIONS */
    // Apply the timeout http config to a partially constructed request.
    function _applyTimeout(partialRequest, timeout) {
      return timeout === undefined ? partialRequest :
             partialRequest.withHttpConfig({timeout: timeout});
    }

    // Function to execute a callback if it is properly defined
    function _execCallback(callback){
      if(typeof callback === 'function') {
        var callbackArguments = Array.prototype.slice.call(arguments, 1);
        return callback.apply(this, callbackArguments);
      }
      return undefined;
    }

    // Takes care of making a request in a retry-after loop.
    function _handle503(getRequest, onSuccess, onError, onRetry, timeout, start)
    {
      if(typeof getRequest !== 'function') {
        throw new Error('getRequest must be a function that returns a request');
      }
      //Amount of time before the next request should timeout
      var maxRequestWaitTime = timeout === undefined ? undefined :
                               Math.max(0, timeout - (new Date() - start));
      //Resolve the promise returned by getRequest
      return getRequest(maxRequestWaitTime).then(onSuccess, function(error){
        if (error.status === 503 && error.headers(strRetryAfter)) {
          var retryAfter = error.headers(strRetryAfter);
          var timeRemaining = parseFloat(retryAfter) * 1000;
          var timeElapsed = new Date() - start;
          // Check whether we have exceeded the max total wait time
          // or whether the timeRemaining reported by the server is too long.
          if (typeof timeout === 'number' &&
              (timeElapsed + timeRemaining) > timeout) {
            _execCallback(onError, error);
            return;
          }
          // Execute the onRetry callback, if specified
          var onRetryResult = _execCallback(onRetry, retryAfter, error);
          if(onRetryResult !== undefined && onRetryResult === false) {
            // If the onRetry callback returned false, discontinue polling.
            _execCallback(onError, error);
            return;
          }
          // Wait for a while, then poll the request again for updated status
          // Cap wait time between 0.5-3 secs to maintain responsiveness
          $timeout(function() {
              _handle503(getRequest, onSuccess, onError, onRetry,
                         timeout, start);
            }, Math.min(Math.max(timeRemaining, 3000), 500));
        }
        else{
          _execCallback(onError, error);
        }
      });
    }

    
    /* REQUEST CACHING MANAGER */
    // Manage a cache of metrics by id, filter, perspective, value, property
    var cachedMetrics = []; // TODO: Make sure this cache doesn't get too big.
    //Produces a metrics cache key from the request parameters
    function _getCacheKey(id, threshold, filter, perspective){
      if ((id || threshold) === undefined) {
        throw new Error('Must specify an id and threshold.');
      }
      filter = filter === undefined ? strDefault : filter;
      perspective = perspective === undefined ? strDefault : perspective;
      return id + '\n' + threshold + '\n' + filter + '\n' + perspective;
    }
    // Store value in Cache
    // TODO: Automatically detect if batching was used and separate results
    function cacheValue(value, id, propertyName,
                           threshold, filter, perspective){
      if ((id || propertyName || threshold || value) === undefined) {
        throw new Error('Must specify an id, property, threshold and value.');
      }
      var key = _getCacheKey(id, threshold, filter, perspective);
      cachedMetrics[key] = cachedMetrics[key] || {};
      cachedMetrics[key][propertyName] = value;
      return value;
    }
    // Retrieve value from cache
    // TODO: Automatically detect if batching was used and try to construct
    //       results from individual cached parts
    function getCacheValue(id, propertyName, threshold, filter, perspective) {
      if ((id || propertyName || threshold) === undefined) {
        throw new Error('Must specify an id, property and threshold.');
      }
      var key = _getCacheKey(id, threshold, filter, perspective);
      return cachedMetrics[key] === undefined ? undefined :
        cachedMetrics[key][propertyName];
    }

    
    /* REQUEST QUEUING MANAGER */
    var requestQueue = []; // Manage a queue of requests for each id.
    var queueBusy = []; // Track whether each id queue is currently busy
    // Add request to the queue for an id, execute it if the queue's not busy
    function enqueueRequest(id, request) {
      if(requestQueue[id] === undefined) {
        requestQueue[id] = [];
      }
      if(queueBusy[id] === undefined) {
        queueBusy[id] = false;
      }
      if( queueBusy[id] ) {
        requestQueue[id].push(request);
        // Todo: return some kind of promise
      } else {
        queueBusy[id] = true;
        return request();
      }
    }
    // On request completion, executes the next or marks the queue as not busy
    function processRequestQueue(id) {
      var nextRequest = requestQueue[id].shift();
      if(nextRequest === undefined) {
        queueBusy[id] = false;
        return undefined;
      } else {
        return nextRequest();
      }
    }
    

    /* METRICS REQUEST FACTORIES */
    // Can be used for tail metrics or exceedance probability requests
    function _getViewMetrics(collection, request, id,
                             threshold, filter, perspective,
                             onSuccess, onError, onRetry, timeout) {
      var postponedRequest = function() {
        // See if this request's results are cached.
        var cached =
          getCacheValue(id, request, threshold, filter, perspective);
        if(cached !== undefined){
          try {
            _execCallback(onSuccess, cached);
          } finally {
            processRequestQueue(id);
          }
          return;
        }
        // Set up the api request
        var restRequest = Restangular.all(collection).one(id).all(request)
                                     .one(threshold.toString());
        restRequest = _applyTimeout(restRequest, timeout);
        // Create request GET parameters
        var getParams = {};
        if (filter) {
          getParams.filter = filter;
        }
        if (perspective) {
          getParams.perspective = perspective;
        }
        // Poll the following request until results are available
        publicMethods.retryAfter( function() {
            return restRequest.get(getParams);
          }, function(result){ // onSuccess
            try {
              cacheValue(result, id, request, threshold, filter, perspective);
              _execCallback(onSuccess, result);
            } finally {
              processRequestQueue(id);
            }
          }, function(error) { // onError or timeout
            try {
              _execCallback(onError, error);
            } finally {
              processRequestQueue(id);
            }
          }, onRetry, timeout);

      };
      // Queue requests by ID, so we only have one polling thread per id
      return enqueueRequest(id, postponedRequest);
    }

    // Request a resource view's TVaR
    function _getTVaR(collection, id, probability, filter, perspective,
                      onSuccess, onError, onRetry, timeout) {
      _getViewMetrics(collection, strTailMetrics, id, probability, filter,
        perspective, function(result){
          _execCallback(onSuccess, result.mean); // mean is TVaR
        }, onError, onRetry, timeout);
    }

    // Request a resource view's expected loss
    function _getExpectedLoss(collection, id, filter, perspective,
                              onSuccess, onError, onRetry, timeout) {
      var prob = 1.0; // EL = TVaR with probability = 1
      _getTVaR(collection, id, prob, filter, perspective,
        onSuccess, onError, onRetry, timeout);
    }

    
    // Returns the functions exposed by this service
    var publicMethods = {
      /* PUBLIC UTILITIES */
      // Set the server url
      setServerUrl: function(url) {
        Restangular.setBaseUrl(url);
      },

      /* Resolves a reference object to a fully qualified resource 'in place'
       @reference: The reference object to resolve.
       @collectionName: The collection endpoint containing this resource. */
      resolveReference: function (reference, collectionName) {
        if (!reference.ref_id) {
          return; // Is not a reference that has not been resolved
        }
        Restangular.all(collectionName).one(reference.ref_id).get().then(
          function(resolved) {
            reference._type = reference.ref_type;
            delete reference.ref_type;
            delete reference.ref_id;
            delete reference.href;
            angular.extend(reference, resolved);
          });
      },

      /* Retries a request if it returns a 503 Service Unavailable error
       response with a Retry-After header.
       @getRequest: a function(timeout) returning the getRequest to poll
       @onSuccess: a function(response) to call if the request succeeds
       @onError: (optional) a function(error) to call on failure
       @onRetry: (optional) a function(retryAfter, error) to call on Retry
                that may return false to stop polling.
       @timeOut: (optional) the maximum time in milliseconds to poll. */
      retryAfter: function (getRequest, onSuccess, onError, onRetry, timeout) {
        return _handle503(getRequest, onSuccess, onError, onRetry,
                          timeout, new Date());
      },


      /* RESOURCE REQUESTS */
      // Request a resource collection from the API. Executes the request
      // if a handler is provided, returns a promise otherwise.
      // TODO: Return promise that we can either call .then or .retryAfter on
      getCollection: function(collection, onSuccess, onError, timeout,
                              getParams, expandReferences) {
        var request = Restangular.all(collection);
        var headers = expandReferences === true ?
                      { References: 'expand' } : undefined;
        request = _applyTimeout(request, timeout).getList(getParams, headers);
        return (onSuccess || onError) ?
                request.then(onSuccess, onError) : request;
      },

      // Request a subResource from a collection. Executes the request
      // if a handler is provided, returns a promise otherwise.
      getSubResource: function(collection, subResource, onSuccess, onError,
                               timeout, getParams) {
        var request = Restangular.all(collection).one(subResource);
        request = _applyTimeout(request, timeout).get(getParams);
        return (onSuccess || onError) ?
                request.then(onSuccess, onError) : request;
      },

      // Post a subResource to a collection.
      postSubResource: function(collection, data, onSuccess, onError) {
        return Restangular.all(collection).post(data)
                          .then(onSuccess, onError);
      },

      /* RESOURCE VIEW METRICS REQUESTS */
      // Request a layer_view's tail metrics with auto-retry
      getLayerViewTailMetrics: function(id, probability, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getViewMetrics(strLayerViews, strTailMetrics, id, probability,
          filter, perspective, onSuccess, onError, onRetry, timeout);
      },

      // Request a portfolio_view's tail metrics with auto-retry
      getPortfolioViewTailMetrics: function(id, probability, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getViewMetrics(strPortfolioViews, strTailMetrics, id, probability,
          filter, perspective, onSuccess, onError, onRetry, timeout);
      },

      // Request a layer_view's exceedance probability with auto-retry
      getLayerViewExceedanceProbability: function(id, threshold, filter,
           perspective, onSuccess, onError, onRetry, timeout) {
        _getViewMetrics(strLayerViews, strExceedanceProb, id, threshold,
          filter, perspective, onSuccess, onError, onRetry, timeout);
      },

      // Request a portfolio_view's exceedance probability with auto-retry
      getPortfolioViewExceedanceProbability: function (id, threshold, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getViewMetrics(strPortfolioViews, strExceedanceProb, id, threshold,
          filter, perspective, onSuccess, onError, onRetry, timeout);
      },

      // Request a layer_view's expected loss with auto-retry
      getLayerViewExpectedLoss: function (id, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getExpectedLoss(strLayerViews, id, filter, perspective,
          onSuccess, onError, onRetry, timeout);
      },

      // Request a portfolio_view's expected loss with auto-retry
      getPortfolioViewExpectedLoss: function (id, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getExpectedLoss(strPortfolioViews, id, filter, perspective,
          onSuccess, onError, onRetry, timeout);
      },

      // Request a layer_view's expected loss with auto-retry
      getLayerViewTVaR: function (id, threshold, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getTVaR(strLayerViews, id, threshold, filter, perspective,
          onSuccess, onError, onRetry, timeout);
      },

      // Request a portfolio_view's expected loss with auto-retry
      getPortfolioViewTVaR: function (id, threshold, filter,
          perspective, onSuccess, onError, onRetry, timeout) {
        _getTVaR(strPortfolioViews, id, threshold, filter, perspective,
          onSuccess, onError, onRetry, timeout);
      }
    };

    return publicMethods;
  };

  //Allows url to be set by the provider
  this.setDefaultServerUrl = function(RestangularProvider, url) {
    RestangularProvider.setBaseUrl(url);
    //RestangularProvider.setDefaultHttpFields({cache: true});
  };
});
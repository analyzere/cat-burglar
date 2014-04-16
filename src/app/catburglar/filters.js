angular.module('catburglar.filters', [])

// Operations
.filter('isEmpty', function() {
  return function(obj) {
    if (typeof obj === 'undefined') {
      return true;
    }
    if (obj === null) {
      return true;
    }
    var name;
    for (name in obj) {
      if (obj.hasOwnProperty(name)) {
        return false;
      }
    }
    return true;
  };
})

// Text Filters
.filter('join', function() {
  return function(input, separator) {
    if (input === undefined || Object.prototype.toString.call(input) !==
      '[object Array]') {
      return undefined;
    }
    return input.join(separator || ',');
  };
})

.filter('titleCase', function() {
  return function(input) {
    if (input === undefined) {
      return undefined;
    }
    return input.replace(/\w\S*/g, function(txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };
})

// Number Filters
.filter('numberUpToPrecision', function($filter) {
  return function(input, upToDecimals) {
    if (input === undefined) {
      return undefined;
    }
    var orderOfMagnitude = Math.pow(10, upToDecimals || 0);
    var rounded = Math.round(input * orderOfMagnitude) / orderOfMagnitude;
    var split = (rounded + '').split('.');
    return $filter('number')(split[0]) + (split[1] ? '.' + split[1] : '');
  };
})

.filter('percentage', function($filter) {
  return function(input, decimals) {
    if (input === undefined) {
      return undefined;
    }
    return $filter('number')(input * 100, decimals) + '%';
  };
})

.filter('percentageUpToPrecision', function($filter) {
  return function(input, decimals) {
    if (input === undefined) {
      return undefined;
    }
    return $filter('numberUpToPrecision')(input * 100, decimals) + '%';
  };
})

.filter('scientificNotation', function() {
  return function(input, decimals) {
    if (input === undefined) {
      return undefined;
    }
    return input.toExponential(decimals);
  };
});

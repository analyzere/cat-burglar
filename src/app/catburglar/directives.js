/* Directives */

angular.module('catburglar.directives', [])

.directive('appVersion', ['version', function(version) {
  return function(scope, elm) {
    elm.text(version);
  };
}]);

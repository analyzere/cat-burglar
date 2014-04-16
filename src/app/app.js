// Declare app level module which depends on filters, and services
angular.module('ARe', [
  'ui.bootstrap',
  'ui.router',
  'templates-app',
  'ARe.catburglar'
])

.config(function ($stateProvider, $urlRouterProvider, datepickerConfig) {
  $urlRouterProvider.otherwise('/catburglar');
  datepickerConfig.showWeeks = false;
})

.run(function (restApi, defaultRestApiUrl) {
  restApi.setServerUrl(defaultRestApiUrl);
})

.controller('AppCtrl', function AppCtrl($scope) {
  $scope.$on('$stateChangeSuccess', function (event, toState) {
    if (angular.isDefined(toState.data.pageTitle)) {
      $scope.pageTitle = toState.data.pageTitle + ' | Analyze Re';
    }
  });
});

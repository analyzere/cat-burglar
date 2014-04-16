var catburglar = angular.module('ARe.catburglar', [
  'restangular',

  'catburglar.filters',
  'catburglar.directives',
  'catburglar.services',
  'catburglar.services.restApi',

  'catburglar.rmsLogin',
  'catburglar.map'
]);

catburglar.config(function config($stateProvider) {
  $stateProvider.state('catburglar', {
    url: '/catburglar',
    views: {
      main: {
        templateUrl: 'catburglar/catburglar.html'
      }
    },
    data: {
      pageTitle: 'CAT Burglar'
    }
  });
});

catburglar.controller('catburglarCtrl', function AppCtrl($scope) {
  $scope.auth = {};
});

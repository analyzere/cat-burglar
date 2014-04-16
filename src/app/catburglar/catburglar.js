var catburglar = angular.module('ARe.catburglar', [
  'restangular',

  'catburglar.rmsLogin',
  'catburglar.filters',
  'catburglar.directives',
  'catburglar.services',
  'catburglar.services.restApi'
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

catburglar.controller('pricingCtrl', function AppCtrl($scope) {
  // $scope.server is a set of server collections
  if ($scope.server === undefined) {
    $scope.server = {
      analysisProfiles: null,
      pricingPortfolios: null,
      portfolios: null,
      rmsContracts: null
    };
  }
  // $scope.selected is a set of user selected items in the app.
  if ($scope.selected === undefined) {
    $scope.selected = {
      analysisProfile: null,
      pricingPortfolio: null,
      portfolio: null,
      rmsContract: null
    };
  }
});

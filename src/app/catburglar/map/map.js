var m = angular.module('catburglar.map',
                       ['catburglar.services', 'restangular',
                         'ngGeolocation', 'google-maps']);

m.controller('catMap', function ($scope, $geolocation, $interval, $timeout,
                                 Restangular, $filter) {
  $geolocation.watchPosition({
    timeout: 60000,
    maximumAge: 250,
    enableHighAccuracy: true
  });
  $interval(function() {
    $scope.myPosition = $geolocation.position.coords;
    $scope.map.position = $scope.myPosition;
  }, 1000);
  $scope.myPosition = {
    latitude: 38.78,
    longitude: -77.017
  };
  $scope.map = {
    center: $scope.myPosition,
    position: $scope.myPosition,
    zoom: 12,
    locationData: []
  };

  $scope.map.myPositionOptions = {
    icon: 'assets/img/burglar-mask.png'
  };

  $scope.$watch('auth.authorized', function() {
    // Hack: Force the resize event to fire to the grid recomputes its width
    $timeout(function () {
      var evt = document.createEvent('UIEvents');
      evt.initUIEvent('resize', true, false, window, 0);
      window.dispatchEvent(evt);

      if($scope.myPosition === undefined ||
        $scope.myPosition.latitude === undefined ||
        $scope.myPosition.longitude === undefined) {
        return;
      }
      $scope.map.center = {
        latitude: $scope.myPosition.latitude,
        longitude: $scope.myPosition.longitude
      };
      updateLocations(10);
    }, 1000);
    updateLocations(10);
  });

  var onMarkerClicked = function (marker) {
    marker.showWindow = true;
    $scope.$apply();
  };

  updateLocations();
  var updatingLocations = false;
  function updateLocations(locations){
    if(updatingLocations){
      return;
    }
    locations = locations || 10;
    if($scope.myPosition === undefined ||
      $scope.myPosition.latitude === undefined ||
      $scope.myPosition.longitude === undefined ||
      $scope.auth.token === undefined) {
      return;
    }
    //exposureService/riskItems/?eql=&limit=10
    //GET RMS STUFF
    var lat = $scope.myPosition.latitude;
    var long = $scope.myPosition.longitude;
    var rng = 1.0;
    var getParams = {
      eql: '(RiskItem.Latitude between ' +
        (lat - rng) + ' and ' + (lat + rng) +
        ') and (RiskItem.Longitude between ' +
        (long - rng) + ' and ' + (long + rng) + ')',
      limit: locations
    };
    updatingLocations = true;
    Restangular.all('exposureService').one('riskItems').get(getParams, {
      'Authorization': JSON.stringify($scope.auth.token)
    }).then(
      function(response) {
        updatingLocations = false;
        $scope.map.locationData = response.RiskItems;
        $scope.map.markers = [];
        $scope.map.locationData.forEach(function(location){
          location.directionsStart = $scope.myPosition;
          location.Address.latitude = location.Address.Latitude;
          location.Address.longitude = location.Address.Longitude;

          var latDiff = location.directionsStart.latitude -
                        location.Address.latitude;
          var lonDiff = location.directionsStart.longitude -
                        location.Address.longitude;
          location.srcDistance = Math.sqrt(latDiff*latDiff + lonDiff*lonDiff) *
                                69;
          location.label = '<b>$' + $filter('number')(location.ContentTIV, 2) +
                           '</b>';

          location.showWindow = false;
          location.closeClick = function () {
            location.showWindow = false;
            try{
              $scope.$apply();
            }
            catch(e){}
          };
          location.onClicked = function (){
            onMarkerClicked(location);
          };
          if($scope.map.locationData.length === 10) {
            updateLocations(50);
          }
        });
        //$scope.map.locationData.sort(sortRiskItems);
      }, function() { //On Error
        updatingLocations = false;
        $timeout(updateLocations, 5000);
      });
  }
});
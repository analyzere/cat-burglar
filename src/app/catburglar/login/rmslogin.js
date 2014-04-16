var m = angular.module('catburglar.rmsLogin',
                       ['catburglar.services', 'restangular']);

m.controller('rmsLogin', function ($scope, $modal) {
  $scope.openLogin = function() {
    $modal.open({
      scope: $scope,
      templateUrl: 'catburglar/login/rmsLoginDialog.html',
      controller: 'ctrlRmsLoginDialog'
    });
  };
});

m.controller('ctrlRmsLoginDialog', function ($scope, $modalInstance, $window,
                                             Restangular) {
  $scope.message = 'Please enter your credentials.';
  $scope.login = function() {
    $scope.message = 'Authenticating...';
    Restangular.defaultHeaders = {};
    var auth = $scope.auth.tenancy + '\\' + $scope.auth.username + ':' +
      $scope.auth.password;
    auth = 'Basic ' + $window.btoa(auth);
    $scope.auth.authorized = false;

    Restangular.all('tokenService/tokens').post(undefined, undefined, {
      'Authorization': auth
    }).then(function(response) {
      Restangular.defaultHeaders = {
        'Authorization': JSON.stringify(response.Token)
      };
      $scope.auth.token = response.Token;
      $scope.auth.authorized = true;
      $scope.message = 'Successfully logged in.';
      $window.setTimeout(function(){
        try{
          $modalInstance.dismiss();
        } catch(e){}
      }, 2000);
    }, function(errResponse) {
      $scope.message = 'Error logging in: ' +
          ((errResponse.data || {}).Message || errResponse.status);
      if(errResponse.status === 0) {
        $scope.message = 'Error logging in: Your browser is attempting to ' +
          'invoke CORS (Cross Origin Resource Sharing), but the RMS api is ' +
          'currently not set up to support OPTIONS requests, so the browser ' +
          'cannot proceed with requests to this API. You can get around this ' +
          'by using an unsecured or out of date browser, or by disabling web-' +
          'security (launch chrome.exe with --disable-web-security in chrome,' +
          ' set about:config security.fileuri.strict_origin_policy in firefox)';
      }
    });
  };

  $scope.close = function() {
    $modalInstance.dismiss();
  };
});
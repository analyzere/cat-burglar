var DEBUG = true;

// Demonstrate how to register services
// In this case it is a simple value service.
var services = angular.module('catburglar.services', [])
  .value('version', ' Beta 0.1');

if (DEBUG) {
  services.value('defaultRestApiUrl',
  // 'http://api-demo.analyzere.com');
  // 'http://are-D-A5GD7I.cloudapp.net');
  // 'http://api.rms.azure.analyzere.com');
  // 'http://are-x-ua5ui9.cloudapp.net/');
  // 'http://localhost:8000/');
  'https://api.na.rmsone.rms.com/services/v1/');
}

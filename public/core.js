var activities = angular.module('activities', []);

function main($scope, $http) {
  $http.get('/api/activities')
    .success(function(data) {
      $scope.activities = data;
    })
    .error(function(data) {
      console.log('Error: ' + data);
    });
}

var activities = angular.module('activities', []);

function main($scope, $http) {
  $scope.days = [
    {x: 0, y: 0},
    {x: 10, y: 13},
    {x: 30, y: 26}
  ];

  $http.get('/api/activities')
    .success(function(data) {
      $scope.activities = data;
    })
    .error(function(data) {
      console.log('Error: ' + data);
    });
}

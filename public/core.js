var activities = angular.module('activities', []);

function main($scope, $http) {
  $scope.days = [
    {x: y: 0},
    {y: 13},
    {y: 26}
  ];

  $http.get('/api/activities')
    .success(function(data) {
      $scope.activities = data;
    })
    .error(function(data) {
      console.log('Error: ' + data);
    });
}

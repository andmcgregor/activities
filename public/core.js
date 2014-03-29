var activities = angular.module('activities', []);

function main($scope, $http) {
  day_size = 20;
  space_size = 2;

  date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  current_day = date.getDay();

  current_x = space_size;
  current_y = space_size * (current_day + 1) + current_day * day_size;

  days = Array(365);

  for(x = 0; x < days.length; x++) {
    if (current_day > 6) {
      current_x = current_x + space_size + day_size;
      current_y = space_size;
      current_day = 0;
    }

    days[x] = {
      x: current_x,
      y: current_y,
    };

    current_y = current_y + space_size + day_size;
    current_day++;
  }

  $scope.days = days;

  $http.get('/api/activities')
    .success(function(data) {
      $scope.activities = data;
    })
    .error(function(data) {
      console.log('Error: ' + data);
    });
}

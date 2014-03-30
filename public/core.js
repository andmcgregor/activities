var activities = angular.module('activities', []);

function main($scope, $http) {
  $http.get('/api/activities').success(function(data) {
    activities = data;

    day_size = 20;
    space_size = 2;

    date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    current_day = date.getDay();

    current_x = space_size;
    current_y = space_size * (current_day + 1) + current_day * day_size;

    date.setHours(0,0,0,0);
    date_in_ms = date.getTime() / 1000;

    commit_num = 0;

    days = Array(366);

    for(x = 0; x < days.length; x++) {
      if (current_day > 6) {
        current_x = current_x + space_size + day_size;
        current_y = space_size;
        current_day = 0;
      }

      color = '#eeeeee';

      for(y = 0; y < activities.length; y++) {
        if(activities[y].date > date_in_ms && activities[y].date < date_in_ms + 86400) {
          commit_num++;
          color = '#000000';
        }
      }

      days[x] = {
        x: current_x,
        y: current_y,
        start: date_in_ms,
        end: date_in_ms + 86399,
        commit_num: commit_num,
        color: color
      };

      current_y = current_y + space_size + day_size;
      date_in_ms = date_in_ms + 86400;
      current_day++;
      commit_num = 0;
    }

    $scope.days = days;
    $scope.activities = activities;

    project_totals = {};
    for(x = 0; x < activities.length; x++) {
      if (project_totals[activities[x].project]) {
        project_totals[activities[x].project]++;
      } else {
        project_totals[activities[x].project] = 1;
      }
    }
    console.log(project_totals);
    $scope.project_totals = project_totals;
  });
}

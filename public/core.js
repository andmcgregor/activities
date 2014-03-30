var activities = angular.module('activities', []);

function main($scope, $http) {
  $http.get('/api/activities').success(function(data) {
    activities = data;

    day_size = 20;
    space_size = 2;

    date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    date = new Date(date.getTime() + 86400000);
    current_day = date.getDay();

    current_x = space_size;
    current_y = space_size * (current_day + 1) + current_day * day_size;

    date.setHours(0,0,0,0);
    date_in_ms = date.getTime() / 1000;

    commit_num = 0;

    days = Array(365);

    for(x = 0; x < days.length; x++) {
      if (current_day > 6) {
        current_x = current_x + space_size + day_size;
        current_y = space_size;
        current_day = 0;
      }

      for(y = 0; y < activities.length; y++) {
        if(activities[y].date > date_in_ms && activities[y].date < date_in_ms + 86400) {
          commit_num++;
        }
      }

      days[x] = {
        x: current_x,
        y: current_y,
        start: date_in_ms,
        end: date_in_ms + 86399,
        commit_num: commit_num
      };

      current_y = current_y + space_size + day_size;
      date_in_ms = date_in_ms + 86400;
      current_day++;
      commit_num = 0;
    }

    // calculate color values
    var none  = '#EEEEEE';
    var some  = '#89C4F4';
    var more  = '#4B77BE';
    var lots  = '#34495E';
    var heaps = '#2C3E50';

    max = Math.max.apply(Math, days.map(function(day) { return day.commit_num }));
    console.log(max);
    for(x = 0; x < days.length; x++) {
      foo = days[x].commit_num / max;
      switch (true) {
        case foo == 0:
          days[x].color = none;
          break;
        case foo > 0 && foo < 0.25:
          days[x].color = some;
          break;
        case foo >= 0.25 && foo < 0.5:
          days[x].color = more;
          break;
        case foo >= 0.5 && foo < 0.75:
          days[x].color = lots;
          break;
        case foo > 0.75:
          days[x].color = heaps;
          break;
      }
    }

    $scope.days = days;
    $scope.activities = activities;

    project_totals = {};
    for(x = 0; x < activities.length; x++) {
      repo = activities[x].owner+'/'+activities[x].repo
      if (project_totals[repo]) {
        project_totals[repo]++;
      } else {
        project_totals[repo] = 1;
      }
    }
    console.log(project_totals);
    $scope.project_totals = project_totals;
  });
}

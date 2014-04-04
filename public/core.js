$mousedown = false;
$selected = [];

var activities = angular.module('activities', []);

activities.controller('main', ['$scope', '$http',
  function($scope, $http) {
    $http.get('/api/activities').success(function(data) {
      var parsed = new Parser(data.activities);
      $scope.cells = parsed.cells;
      $scope.repos = parsed.repos;
      $scope.totals = parsed.totals;
      $scope.content = data.content;

      // calculates x/y offsets once svg is drawn
      // TODO don't assume cells are drawn in < 3 seconds
      setTimeout(function() {
        for(x = 0; x < $scope.cells.length; x++) {
          el = $('rect[data-start="'+$scope.cells[x].start+'"]');
          $scope.cells[x].offsetX = el.offset().left;
          $scope.cells[x].offsetY = el.offset().top;
        }
        console.log('rectsXoord loaded');
      }, 3000);

      // adds pie chart
      reposArray = [];
      for (var repo in parsed.repos) {
        reposArray.push({name: repo, count: parsed.repos[repo]});
      }

      colors = ["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"];
      var chart = new Chart(reposArray, 250, colors);
      $reposArray = reposArray;
    });

    $scope.dayHover = function(day, event) {
      if (!$mousedown) {
        $('.hover').html(day.commit_num+' contributions on '+day.date);
        $('.hover').show();
        offset = $(event.target).offset();
        offset.top -= 20;
        offset.left -= 90;
        $('.hover').offset(offset);
      }
    }

    $scope.removeHover = function() {
      $('.hover').hide();
    }

    $scope.daySelectBegin = function(event) {
      event.preventDefault();
      $mousedown = true;

      $('rect').css('opacity', '0.1');

      $('.select').show();
      $('.select').css('width', '1px', 'height', '1px');
      $('.select').offset({top: event.clientY, left: event.clientX});
      $('.select').data('top', event.clientY);
      $('.select').data('left', event.clientX);
    }

    $scope.daySelecting = function(event) {
      event.preventDefault();
      if($mousedown) {
        select = $('.select');
        width = event.pageX - select.data('left');
        height = event.pageY - select.data('top');
        absHeight = Math.abs(height);
        absWidth = Math.abs(width);
        if (width < 0) {
          select.offset({left: event.pageX});
        }
        if (height < 0) {
          select.offset({top: event.pageY});
        }
        select.css({width: absWidth, height: absHeight});
        $('rect').css('opacity', '0.1');

        for(i = 0; i < $scope.cells.length; i++) {
          xc = $scope.cells[i].offsetX + 10;
          yc = $scope.cells[i].offsetY + 10;

          if (xc > select.offset().left && xc < select.offset().left + absWidth &&
              yc > select.offset().top && yc < select.offset().top + absHeight ) {
            $('rect[data-start="'+$scope.cells[i].start+'"]').css('opacity', '1');
            $selected.push($scope.cells[i]); // this is every cell selected not final selection!
          }
        }
      }
    }

    $scope.daySelectEnd = function(event) {
      event.preventDefault();
      $('.select').hide();
      if($selected.length == 0) {
        $('rect').css('opacity', '1');
      } else {
        // reset counts
        for(x = 0; x < $reposArray.length; x++) {
          $reposArray[x].count = 0;
        }
        newData = [];
        for(x = 0; x < $selected.length; x++) {
          repoCounts = JSON.parse($selected[x].commits_by_repo);
          for(y = 0; y < repoCounts.length; y++) {
            newData.push(repoCounts[y]);
          }
        }
        // TODO send data to existing pie chart
        colors = ["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"];
        new Chart(newData, 250, colors);
      }
      $selected = [];
      $mousedown = false;
    }
}]);


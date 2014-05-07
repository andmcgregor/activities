$mousedown = false;
$notSelecting = false;
$aboutShown = false;
$selected = [];

var activities = angular.module('activities', []);

activities.controller('main', ['$scope', '$http',
  function($scope, $http) {
    $http.get('/api/activities').success(function(x) {
      $http.get('/api/files').success(function(y) {
        var parsed = new Parser(x.activities, y.files);
        $scope.cells = parsed.cells;
        $scope.repos = parsed.repos;
        $scope.totals = parsed.totals;
        $scope.content = x.content;

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

        repoStats = new Chart(reposArray, 450, 'repo');
        $repoStats = repoStats;
        $reposArray = reposArray;

        $scope.count = y.files.length;
        $scope.additions = y.additions;
        $scope.deletions = y.deletions;

        langArray = [];
        for (var lang in parsed.languages)
          langArray.push({name: lang, count: parsed.languages[lang]});
        langStats = new Chart(langArray, 450, 'lang');
        $langStats = langStats;
      });
    });

    $scope.dayClick = function(day, event) {
      $selected.push(day);
      $langStats.update($selected);
      $repoStats.update($selected);
      $selected = [];
    }

    $scope.dayHover = function(day, event) {
      if (!$mousedown) {
        if (day.commit_num != 1)
          plural = 's';
        else
          plural = '';
        $('.hover').html(day.date+': <strong>'+day.commit_num+' contribution'+plural+'</strong>');
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
      console.log(event.target.nodeName);
      if (event.target.nodeName != 'rect' && event.target.nodeName != 'A' && event.target.nodeName != 'path') {
        $mousedown = true;

        $('rect').css('opacity', '0.1');

        $('.select').show();
        $('.select').css(['width', '1px', 'height', '1px']);
        $('.select').offset({top: event.clientY, left: event.clientX});
        $('.select').data('top', event.clientY);
        $('.select').data('left', event.clientX);
      } else {
        $notSelecting = true;
      }
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

        for (i = 0; i < $scope.cells.length; i++) {
          xc = $scope.cells[i].offsetX + 10;
          yc = $scope.cells[i].offsetY + 10;

          if (xc > select.offset().left && xc < select.offset().left + absWidth &&
              yc > select.offset().top && yc < select.offset().top + absHeight ) {
            $('rect[data-start="'+$scope.cells[i].start+'"]').css('opacity', '1');
            var index = $selected.indexOf($scope.cells[i]);
            if(index == -1) {
              $selected.push($scope.cells[i]);
            }
            // this is every cell selected not final selection!
          }
        }
      }
    }

    $scope.daySelectEnd = function(event) {
      if ($notSelecting) {
        $notSelecting = false
      } else {
        $('.select').width(0);
        $('.select').height(0);
        if($selected.length == 0) {
          console.log('nothing selected');
          $mousedown = false;
          $('.select').hide();
          $('rect').css('opacity', '1');
          $repoStats.reset();
          $langStats.reset();
        } else {
          // reset counts
          for(x = 0; x < $reposArray.length; x++) {
            $reposArray[x].count = 0;
          }
          $langStats.update($selected);
          $repoStats.update($selected);
        }
        $selected = [];

        $mousedown = false;
      }
    }

    $scope.langSelect = function(lang, event) {
      if (event)
        event.preventDefault();
      $('rect').css('opacity', '0.1');
      langRegex = new RegExp(lang);
      newLangData = {};
      newRepoData = {};
      for (x = 0; x < $scope.cells.length; x++) {
        var cell = $scope.cells[x];
        if (langRegex.test(cell.lang_per_cell)) {
          $('rect[data-start="'+cell.start+'"]').css('opacity', '1');
          langs = JSON.parse(cell.lang_per_cell)
          $selected.push(cell);
        }
      }
      for(x = 0; x < $reposArray.length; x++) {
        $reposArray[x].count = 0;
      }

      $repoStats.update($selected, lang);
      $selected = [];
      $langStats.setLang(lang);
    }

    // content

    $scope.openAbout = function(event) {
      $aboutShown = true;
      $('.about').css('-webkit-transform', 'translateX(0px)');
      $('.main').css('-webkit-transform', 'translateX(350px)');
      //$('.main').css('-webkit-filter', 'blur(10px)');
      $('.over-main').css('width', '100%');
      $('.over-main').css('height', '100%');
    }

    $scope.ensureInView = function(event) {
      if ($aboutShown) {
        $('.about').css('-webkit-transform', 'translateX(-450px)');
        $('.main').css('-webkit-transform', 'translateX(0px)');
        //$('.main').css('-webkit-filter', 'blur(0px)');
        $('.over-main').css('width', '0');
        $('.over-main').css('height', '0');
        $aboutShown = false;
      }
    }
}]);


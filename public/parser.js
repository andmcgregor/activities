function Parser(activities) {
  // data.activities
  // array
  // id, date, link, owner, repo, secret, type

  // days
  // array
  // color, commit_num, date, end, secret, start, x, y
  //    commits_by_repo
  //    string json
  //    {name, count} of each repo in day

  // $rectsXoord
  // array
  // id, x, y
  // TODO: switch to just using days

  // scope.totals
  // object containing number of commits, pulls and repos
  // TODO: calculate totals at the same time as days

  var cell_size = 20;
  var space_size = 2;

  var date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  date = new Date(date.getTime() + 86400000);
  var current_day = date.getDay();

  var current_x = space_size;
  var current_y = space_size * (current_day + 1) + current_day * cell_size;

  date.setHours(0,0,0,0);
  var seconds = date.getTime() / 1000;

  var commit_num = 0;

  var cells = Array(365);

  for(x = 0; x < cells.length; x++) {
    if (current_day > 6) {
      current_x = current_x + space_size + cell_size;
      current_y = space_size;
      current_day = 0;
    }

    var secret = false;
    var commitsByRepo = [];

    for(y = 0; y < activities.length; y++) {
      if(activities[y].date > seconds && activities[y].date < seconds + 86400) {
        commit_num++;
        var name = activities[y].owner+'/'+activities[y].repo;
        var found = false;
        for(z = 0; z < commitsByRepo.length; z++) {
          if(commitsByRepo[z].name == name) {
            commitsByRepo[z].count++;
            found = true;
          }
        }
        if (found == false) {
          commitsByRepo.push({
            name: name,
            count: 1
          });
        }

        if(activities[y].secret == true) {
          secret = true;
        }
      }
    }

    cells[x] = {
      x: current_x,
      y: current_y,
      offsetX: 0,
      offsetY: 0,
      start: seconds,
      end: seconds + 86399,
      date: date.toString(),
      commit_num: commit_num,
      commits_by_repo: JSON.stringify(commitsByRepo),
      secret: secret
    };

    date = new Date(date.getTime() + 86400000);

    current_y = current_y + space_size + cell_size;
    seconds = seconds + 86400;
    current_day++;
    commit_num = 0;
  }

  // calculate color values
  var none  = '#EEEEEE';
  var some  = '#89C4F4';
  var more  = '#4B77BE';
  var lots  = '#34495E';
  var heaps = '#2C3E50';

  max = Math.max.apply(Math, cells.map(function(cell) { return cell.commit_num }));
  for(x = 0; x < cells.length; x++) {
    foo = cells[x].commit_num / max;
    switch (true) {
      case foo == 0:
        cells[x].color = none;
        break;
      case foo > 0 && foo < 0.25:
        cells[x].color = some;
        break;
      case foo >= 0.25 && foo < 0.5:
        cells[x].color = more;
        break;
      case foo >= 0.5 && foo < 0.75:
        cells[x].color = lots;
        break;
      case foo > 0.75:
        cells[x].color = heaps;
        break;
    }
  }

  this.cells = cells;

  totals = {
    commits: 0,
    pulls:   0,
    repos:   0
  }

  repos = {}
  for(x = 0; x < activities.length; x++) {
    if(!repos[activities[x].owner+'/'+activities[x].repo]) {
      repos[activities[x].owner+'/'+activities[x].repo] = 1;
      totals.repos++;
    } else {
      repos[activities[x].owner+'/'+activities[x].repo]++;
    }
    if(activities[x].type == "commit") {
      totals.commits++;
    } else {
      totals.pulls++;
    }
  }

  this.totals = totals;
  this.repos = repos;
}

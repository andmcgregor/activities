var config = require('./config.json');

var express  = require('express');
var app      = express();
var mongoose = require('mongoose');
var https    = require('https');

mongoose.connect(config.db);

app.configure(function() {
  app.use(express.static(__dirname + '/public'));
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
});

var Activity = mongoose.model('Activity', {
  type:    String,
  date:    { type: Number, unique: true },
  owner:   String,
  repo:    String,
  secret:  Boolean,
  link:    String
});

app.listen(8000);
console.log('Server running at http://127.0.0.1:8000/');

app.get('/api/activities', function(req, res) {
  Activity.find(function(err, activities) {
    if (err)
      res.send(err)

    res.json(activities);
  });
});

app.get('/api/update', function() {
  githubRequest('/user/repos?per_page=100');
});

app.get('/api/destroy', function() {
  Activity.remove({}, function() {
    console.log('No more activities!');
  })
});

app.get('*', function(req, res) {
  res.sendfile('./public/index.html');
});

// Github API

githubRequest = function(path, repo) {
  var options = {
    headers: {
      'User-Agent': config.github_username
    },
    auth: config.github_token + ':x-oauth-basic',
    hostname: 'api.github.com',
    path: path,
    method: 'GET'
  }

  var str = '';

  var request = https.request(options, function(res) {
    res.on('data', function(chunk) {
      str += chunk;
    });

    res.on('end', function() {
      data = JSON.parse(str);
      if (path == '/user/repos?per_page=100') {
        repos = [];
        for(x = 0; x < data.length; x++) {
          repos.push(data[x].full_name);
        }
        if (repos.length != 0) {
          repos = repos.concat(config.company_repos);
          parseRepos(repos);
        }
      } else {
        commits = [];
        for(x = 0; x < data.length; x++) {
          date = Date.parse(data[x].commit.committer.date);
          commits.push({
            type: "commit",
            date: parseInt(date) / 1000,
            owner: repo.match(/^[^\/]+/)[0],
            repo: repo.match(/[^\/]+$/)[0],
            secret: (config.company_repos.indexOf(repo) > -1),
            link: data[x].url
          });
        }
        if (commits.length != 0) {
          parseCommits(commits);
        }
        if (commits.length == 100) {
          githubRequest(res.headers.link.match(/^<[^>]+>/)[0].replace(/[<>]/g, ''), repo);
        }
      }
    });
  });

  request.end();
}

parseRepos = function(repos) {

  console.log('Found '+repos.length+' repos for user: '+config.github_username);

  (function loop(x) {
    setTimeout(function() {
      console.log('Finding commits in '+repos[x]+'...');
      githubRequest('/repos/'+repos[x]+'/commits?author='+config.github_username+'&per_page=100', repos[x]);
      x++;
      if (x < repos.length)
        loop(x);
    }, 2000);
  })(0);
}

parseCommits = function(commits) {
  console.log('Found '+commits.length+'!')
  promise = Activity.create(commits);
}

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
  date:    Date,
  project: String,
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
  githubRequest('/user/repos');
});

app.get('*', function(req, res) {
  res.sendfile('./public/index.html');
});

// Github API

githubRequest = function(path, other) {
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
      if (path == '/user/repos') {
        repo_names = fetchRepos(data);
        console.log('Successfully Fetched Repos!');
        // loop through repo names
        githubRequest('/repos/'+repo_names[1]+'/commits?author='+config.github_username, { repo: repo_names[1] });
      } else {
        commits = fetchCommits(data, other.repo);
        console.log(commits);
      }
    });
  });

  request.end();

  request.on('error', function(e) {
    console.error(e);
  });
}

fetchRepos = function(data) {
  repo_names = [];
  for(x = 0; x < data.length; x++) {
    repo_names.push(data[x].full_name);
  }
  return repo_names;
}

fetchCommits = function(data, repo) {
  commits = [];
  for(x = 0; x < data.length; x++) {
    commits.push({
      type: "commit",
      date: data[x].commit.committer.date,
      project: repo,
      link: data[x].url
    });
  }
  return commits;
}

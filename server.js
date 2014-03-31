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


app.get('/api/test', function() {
  update = new Update();
  interval = setInterval(function() {
    if (!update.process()) {
      clearInterval(interval);
    }
  }, 1000);
});

app.get('*', function(req, res) {
  res.sendfile('./public/index.html');
});

// Github API

function Update() {

  this.queue = [];
  this.idle = 0;

  this.init = function() {
    this.queue.push({
      uri: '/user/repos?per_page=100',
      page: 1,
      repo: null
    });
  }

  this.process = function() {
    console.log('Queued requests: '+this.queue.length);

    value = this.queue.shift()
    if(value) {
      console.log('Requesting: '+value.uri);
      this.request(value.uri, value.page, value.repo);
      this.idle = 0;
    } else {
      console.log('Nothing to process...');
      this.idle++;
    }
    if (this.queue.length == 0 && this.idle > 5) {
      return false;
    } else {
      return true;
    }
  }

  this.request = function(path, page, repo) {
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
    var self = this;

    var request = https.request(options, function(res) {
      res.on('data', function(chunk) {
        str += chunk;
      });

      res.on('end', function() {
        data = JSON.parse(str);
        if (path.match(/user\/repos/)) {
          self.parseRepos(res, data);
        } else if (path.match(/commits\?author/)) {
          self.parseCommits(res, data, repo);
        } else if (path.match(/pulls/)) {
          self.parsePulls(res, data, repo, page);
        }
      });
    });

    request.end();
  }

  this.parseRepos = function(res, data) {
    repos = [];
    for(x = 0; x < data.length; x++) {
      repos.push(data[x].full_name);
    }
    //repos = repos.concat(config.company_repos);
    repos = config.company_repos;

    if (repos.length != 0) {
      for(x = 0; x < repos.length; x++) {
        this.queue.push({
          uri:  '/repos/'+repos[x]+'/commits?author='+config.github_username+'&per_page=100',
          repo: repos[x]
        });
        this.queue.push({
          uri: '/repos/'+repos[x]+'/pulls?state=all&page=1&per_page=100',
          repo: repos[x],
          page: 1
        });
      }
    }
  }

  this.parseCommits = function(res, data, repo) {
    commits = [];
    for(x = 0; x < data.length; x++) {
      date = Date.parse(data[x].commit.committer.date);
      secret = config.company_repos.indexOf(repo) > -1;
      commits.push({
        type: "commit",
        date: parseInt(date) / 1000,
        owner: repo.match(/^[^\/]+/)[0],
        repo: repo.match(/[^\/]+$/)[0],
        secret: secret,
        link: data[x].url
      });
    }
    if (commits.length != 0) {
      Activity.create(commits);
    }
    if (commits.length == 100) {
      this.queue.push({
        uri:  res.headers.link.match(/^<[^>]+>/)[0].replace(/[<>]/g, ''),
        repo: repo
      });
    }
  }

  this.parsePulls = function(res, data, repo, page) {
    pulls = [];
    console.log('Data length: '+data.length);
    for(x = 0; x < data.length; x++) {
      if (data[x].user.login == config.github_username) {
        date = Date.parse(data[x].created_at)
        secret = config.company_repos.indexOf(repo) > -1;
        pulls.push({
          type: "pull",
          date: parseInt(date) / 1000,
          owner: repo.match(/^[^\/]+/)[0],
          repo: repo.match(/[^\/]+$/)[0],
          secret: secret,
          link: data[x].url
        });
      }
    }
    if (pulls.length != 0) {
      Activity.create(pulls);
    }
    if (data.length == 100) {
      this.queue.push({
        uri: '/repos/'+repo+'/pulls?state=all&page='+(page+1)+'&per_page=100',
        repo: repo,
        page: page + 1
      });
    }
  }

  this.init();
}

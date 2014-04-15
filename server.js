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
  type:   String,
  date:   { type: Number, unique: true },
  owner:  String,
  repo:   String,
  secret: Boolean,
  link:   String,
  sha:    String
});

var File = mongoose.model('File', {
  sha:       String,
  filename:  String,
  additions: Number,
  deletions: Number
});

var Request = mongoose.model('Request', {
  uri:  String,
  page: Number,
  repo: String,
  type: String,
  date: Number
});

app.listen(8000);
console.log('Server running at http://127.0.0.1:8000/');

app.get('/api/activities', function(req, res) {
  Activity.find(function(err, activities) {
    if (err) {
      res.send(err);
    }

    response = {
      "activities": activities,
      "content": {
        "title":  config.title,
        "intro":  config.intro,
        "social": config.social
      }
    };

    res.json(response);
  });
});

app.get('/admin', function() {

});

app.get('/api/update', function(req, res) {
  Request.find(function(err, requests) {
    if (err) {
      res.send(err);
    }

    console.log(requests.length+' saved requests!');

    update = new Update(requests);
    interval = setInterval(function() {
      if (!update.process()) {
        clearInterval(interval);
        res.send('done!');
      }
    }, 1000);
  });
});

app.get('/api/destroy-activities', function(req, res) {
  Activity.remove({}, function() {
    res.send('No more activities');
  })
});

app.get('/api/destroy-requests', function(req, res) {
  Request.remove({}, function() {
    res.send('No more requests!');
  })
});


app.get('*', function(req, res) {
  res.sendfile('./public/index.html');
});

function Update(requests) {
  this.queue = [];
  this.idle = 0;
  this.requests = requests;

  this.init = function() {
    this.queue.push({
      uri: '/user/repos?per_page=100',
      page: 1,
      repo: null
    });
  }

  this.preprocess = function(req) {
    var found = false;
    for (x = 0; x < this.requests.length; x++) {
      if (this.requests[x].uri == req.uri) {
        found = true;
      }
    }
    if (found == true) {
      console.log('skipping request...');
      return false;
    } else {
      Request.create({
        uri:  req.uri,
        page: req.page,
        repo: req.repo,
        type: undefined,
        date: new Date().getTime()
      });
      return true;
    }
  }

  this.process = function() {
    console.log('Queued requests: '+this.queue.length);

    req = this.queue.shift()
    if(req && this.preprocess(req)) {
      console.log('Requesting: '+req.uri);
      this.request(req.uri, req.page, req.repo);
      this.idle = 0;
    } else {
      console.log('Nothing to process...');
      this.idle++;
    }
    if (this.queue.length == 0 && this.idle > 10) {
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
        } else if (path.match(/\/commits\//)) {
          self.parseCommit(res, data, repo);
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
    repos = repos.concat(config.company_repos);

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
        link: data[x].url,
        sha: data[x].sha
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
    for (y = 0; y < commits.length; y++) {
      this.queue.push({
        uri: '/repos/'+repo+'/commits/'+commits[y].sha,
        repo: repo
      });
    }
  }

  this.parseCommit = function(res, data, repo) {
    files = [];
    for (x = 0; x < data.files.length; x++) {
      files.push({
        sha: data.sha,
        filename: data.files[x].filename, // perhaps save language at this point
        additions: data.files[x].additions,
        deletions: data.files[x].deletions
      });
    }
    File.create(files);
  }

  this.parsePulls = function(res, data, repo, page) {
    pulls = [];
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
      page++;
      this.queue.push({
        uri: '/repos/'+repo+'/pulls?state=all&page='+page+'&per_page=100',
        repo: repo,
        page: page
      });
    }
  }

  this.init();
}

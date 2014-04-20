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

var Job = mongoose.model('Job', {
  type: { type: String, unique: true },
  due: Date,
  current: Boolean,
  queue: Array
});

var Request = mongoose.model('Request', {
  uri:  String,
  page: Number,
  repo: String,
});

app.listen(8000);
console.log('Server running at http://127.0.0.1:8000/');

Job.find({}, function(err, jobs) {
  console.log('Next Update: %s', jobs[0].due);
});

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

app.get('/api/files', function(req, res) {
  File.find(function(err, files) {
    if (err) {
      res.send(err);
    }

    var additions = 0;
    var deletions = 0;

    for(x = 0; x < files.length; x++) {
      additions += files[x].additions;
      deletions += files[x].deletions
    }

    response = {
      count: files.length,
      additions: additions,
      deletions: deletions,
      files: files
    }

    res.json(response);
  });
});

app.get('*', function(req, res) {
  res.sendfile('./public/index.html');
});

// update

Update = function(requests) {
  if (requests.length != 0) {
    this.queue = requests;
  } else {
    this.queue = [];
  }

  this.idle = 0;

  this.init();

  self = this;
  this.interval = setInterval(function() {
    if (!self.process()) {
      clearInterval(self.interval);
      Job.update({ type: 'update' }, { due: new Date(new Date().getTime() + 86400000) }, {upsert: true}, function(err) {
        console.log(err);
      });
    }
  }, 250);
}

Update.prototype.addToQueue = function(req) {
  Request.create(req);
  this.queue.push(req);
}

Update.prototype.init = function() {
  if (this.queue.length == 0) {
    this.addToQueue({
      uri: '/user/repos?per_page=100',
      page: 1,
      repo: null
    });
  }
}

Update.prototype.process = function() {
  console.log('Queued requests: '+this.queue.length);

  req = this.queue.pop();
  if (req) {
    if (req.uri.match(/user\/repos/)) {
      req.type = 'repos';
    } else if (req.uri.match(/commits\?author/)) {
      req.type = 'commits';
    } else if (req.uri.match(/pulls/)) {
      req.type = 'pulls';
    } else if (req.uri.match(/\/commits\//)) {
      req.type = 'commit';
    }

    console.log('Requesting: '+req.uri);
    this.request(req.uri, req.page, req.repo);
    this.idle = 0;
  } else {
    console.log('Nothing to process...');
    this.idle++;
  }
  if (this.queue.length == 0 && this.idle > 40) {
    return false;
  } else {
    return true;
  }
}

Update.prototype.request = function(path, page, repo) {
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

      Request.find({ uri: path }).remove().exec();
    });
  });

  request.end();
}

Update.prototype.parseRepos = function(res, data) {
  repos = [];
  for(x = 0; x < data.length; x++) {
    repos.push(data[x].full_name);
  }
  repos = repos.concat(config.company_repos);

  if (repos.length != 0) {
    for(x = 0; x < repos.length; x++) {
      this.addToQueue({
        uri:  '/repos/'+repos[x]+'/commits?author='+config.github_username+'&per_page=100',
        repo: repos[x]
      });
      this.addToQueue({
        uri: '/repos/'+repos[x]+'/pulls?state=all&page=1&per_page=100',
        repo: repos[x],
        page: 1
      });
    }
  }
}

Update.prototype.parseCommits = function(res, data, repo) {
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
    this.addToQueue({
      uri:  res.headers.link.match(/^<[^>]+>/)[0].replace(/[<>]/g, ''),
      repo: repo
    });
  }
  for (y = 0; y < commits.length; y++) {
    this.addToQueue({
      uri: '/repos/'+repo+'/commits/'+commits[y].sha,
      repo: repo
    });
  }
}

Update.prototype.parseCommit = function(res, data, repo) {
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

Update.prototype.parsePulls = function(res, data, repo, page) {
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
    this.addToQueue({
      uri: '/repos/'+repo+'/pulls?state=all&page='+page+'&per_page=100',
      repo: repo,
      page: page
    });
  }
}

// delayed jobs

Jobs = function() {
  this.fetch();
}

Jobs.prototype.fetch = function() {
  Job.find({ type: 'update' }, function(err, jobs) {
    if (jobs.length) {
      setTimeout(function() {
        Request.find({}, function(err, requests) {
          new Update(requests);
        });
      }, jobs[0].due - Date.now());
    } else {
      Job.create({
        type: 'update',
        due: new Date(),
        inProgress: false
      });
    }
  });
}

new Jobs;



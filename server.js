if (process.env.PORT) {
  var config = {
    db: process.env.DB,
    port: process.env.PORT,
    github_username: process.env.GITHUB_USERNAME,
    github_token: process.env.GITHUB_TOKEN
  }
} else {
  var config = require('./config.json');
}

config.other_requests = require('./config.json').other_requests;

var company_repos = require('./company.json');

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
  raw_url:      { type: String, unique: true },
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

app.listen(config.port);
console.log('Server running at http://127.0.0.1:8000/');

Job.find({}, function(err, jobs) {
  if (jobs[0])
    console.log('Next Update: %s', jobs[0].due);
});

var $cache = {};

// fill cache

// Activities

Activity.find({}, function(err, activities) {
  var response = {
    activities: activities
  };

  $cache.activities = response;
  console.log('Added activities to the cache');
});

// Files

File.find({}, function(err, files) {
  var additions = 0;
  var deletions = 0;
  var res_files = [];

  for(x = 0; x < files.length; x++) {
    additions += files[x].additions;
    deletions += files[x].deletions;
    var filename = files[x].filename;
    switch (true) {
      case /\.rb$|\.ru$|\.ruby|\.Gemfile/.test(filename):
        var language = 'ruby';
        break;
      case /\.js$/.test(filename):
        var language = 'javascript';
        break;
      case /\.coffee$/.test(filename):
        var language = 'coffeescript';
        break;
      case /\.html$|\.htm$/.test(filename):
        var language = 'html';
        break;
      case /\.haml$|\.hamlc$/.test(filename):
        var language = 'haml';
        break;
      case /\.css$/.test(filename):
        var language = 'css';
        break;
      case /\.scss$|\.sass$/.test(filename):
        var language = 'sass';
        break;
      case /\.erb$/.test(filename):
        var language = 'erb';
        break;
      case /\.yaml$|\.yml$/.test(filename):
        var language = 'yaml';
        break;
      case /\.lua$/.test(filename):
        var language = 'lua';
        break;
      case /\.c$/.test(filename):
        var language = 'c';
        break;
      case /\.cpp$/.test(filename):
        var language = 'cpp';
        break;
      case /\.spec$/.test(filename):
        var language = 'rspec';
        break;
      default:
        var language = 'other';
    }
    res_files.push({sha: files[x].sha, lang: language, ad: files[x].additions, de: files[x].deletions});
  }

  var response = {
    count: files.length,
    additions: additions,
    deletions: deletions,
    files: res_files
  }

  $cache.files = response;
  console.log('Added files to the cache');
});

/////////////

app.get('/api/activities', function(req, res) {
  res.json($cache.activities);
});

app.get('/api/files', function(req, res) {
  res.json($cache.files);
});

// fix bad data
//app.get('/data-fix', function(req, res) {
//  Activity.update({repo: 'mailman'}, {owner: 'take-the-interview'}, {multi:true}, function(err, num, raw) {
//    console.log(num+' records updated');
//  });
//  Activity.update({repo: 'take_the_interview'}, {owner: 'take-the-interview'}, {multi:true}, function(err, num, raw) {
//    console.log(num+' records updated');
//  });
//  Activity.update({repo: 'vanilla'}, {owner: 'take-the-interview'}, {multi:true}, function(err, num, raw) {
//    console.log(num+' records updated');
//  });
//  Activity.update({repo: 'live'}, {owner: 'take-the-interview'}, {multi:true}, function(err, num, raw) {
//    console.log(num+' records updated');
//  });
//  Activity.update({owner: 'take-the-interview'}, {secret: true}, {multi:true}, function(err, num, raw) {
//    console.log(num+' records updated');
//  });
//});
// for debugging
//app.get('/reset', function(req, res) {
//  Job.update({ type: 'update' }, { due: new Date(new Date().getTime() - 86400000) }, {upsert: true}, function(err) {});
//});

//app.get('/manual-update', function(req, res) {
//  Job.update({ type: 'update' }, { due: new Date(new Date().getTime() - 86400000) }, {upsert: true}, function(err) {
//    request_objs = [];
//    for(x = 0; x < config.other_requests.length; x++) {
//      request_objs.push({
//        uri: config.other_requests[x].uri,
//        page: 1,
//        repo: config.other_requests[x].repo,
//        branch: config.other_requests[x].branch
//      });
//    }
//    new Update(request_objs)
//  });
//});

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
  this.errors = 0;
  if (this.queue.length == 0) {
    for(x = 0; x < config.other_requests.length; x++) {
      this.addToQueue({
        uri: config.other_requests[x].uri,
        page: 1,
        repo: config.other_requests[x].repo,
        branch: config.other_requests[x].branch
      });
    }
    this.addToQueue({
      uri: '/user/repos?per_page=100',
      page: 1,
      repo: null
    });
  }
}

Update.prototype.process = function() {
  console.log('Queued requests: '+this.queue.length);

  if (this.errors > 5) { // handle errors better than this
    this.queue = [];
    Job.update({ type: 'update' }, { due: new Date(new Date().getTime() + 86400000) }, {upsert: true}, function(err) {
      console.log(err);
    });
  }

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
    this.request(req.uri, req.page, req.repo, req.branch);
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

Update.prototype.request = function(path, page, repo, branch) {
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
        self.parseCommits(res, data, repo, branch);
      } else if (path.match(/pulls/)) {
        self.parsePulls(res, data, repo, page);
      } else if (path.match(/\/commits\//)) {
        self.parseCommit(res, data, repo, branch);
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
  repos = repos.concat(company_repos);

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

Update.prototype.parseCommits = function(res, data, repo, branch) {
  commits = [];
  for(x = 0; x < data.length; x++) {
    date = Date.parse(data[x].commit.committer.date);
    secret = company_repos.indexOf(repo) > -1;
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
  // uncomment for large repos not already in db
  //if (commits.length == 100) {
  //  this.addToQueue({
  //    uri: res.headers.link.match(/^<[^>]+>/)[0].replace(/[<>]/g, ''),
  //    repo: repo,
  //    branch: branch
  //  });
  //}
  for (y = 0; y < commits.length; y++) {
    //Activity.find({ sha: commits[y].sha }, function (err, res) {
    //  if (res == []) {
        this.addToQueue({
          uri: '/repos/'+repo+'/commits/'+commits[y].sha,
          repo: repo,
          branch: branch
        });
    //  }
    //});
  }
}

Update.prototype.parseCommit = function(res, data, repo, branch) {
  if (data.files == undefined) {
    //this.errors++;
  } else {
    console.log('---------------------------------');
    console.log('Files to add: '+data.files.length);
    console.log('---------------------------------');
    files = [];
    for (x = 0; x < data.files.length; x++) {
      files.push({
        sha: data.sha,
        filename: data.files[x].filename, // perhaps save language at this point
        additions: data.files[x].additions,
        deletions: data.files[x].deletions,
        raw_url: data.files[x].raw_url
      });
    }
    File.create(files, {
      error: function(model, errors) {
        var err = JSON.parse(errors.responseText);
        $.each(errors, function (name, err) {
          console.log(name + err.message);
        });
      }
    });
  }
}

Update.prototype.parsePulls = function(res, data, repo, page) {
  pulls = [];
  for(x = 0; x < data.length; x++) {
    if (data[x].user.login == config.github_username) {
      date = Date.parse(data[x].created_at)
      secret = company_repos.indexOf(repo) > -1;
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

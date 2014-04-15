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

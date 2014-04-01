#Activities

App to display programming stats using the Github API. Development in progress.
Uses node.js and angular.

For setup, add a config.json file:

  {
    "db": "",
    "github_username": "",
    "github_token": "",
    "company_repos": [
    ],
    "title": "",
    "intro": "",
    "social": [
      {
        "title": "",
        "href": ""
      }
    ]
  }

And a package.json file:

  {
    "name"         : "activities",
    "version"      : "0.0.0",
    "description"  : "Activity calendar for andrewmcgregor.me",
    "main"         : "server.js",
    "author"       : "andmcgregor",
    "dependencies" : {
      "express"    : "3.x",
      "mongoose"   : "3.x"
    }
  }

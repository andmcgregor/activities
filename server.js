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

var update = require('./update.js');

app.listen(8000);
console.log('Server running at http://127.0.0.1:8000/');

app.get('/api/activities', function(req, res) {
  Activity.find(function(err, activities) {
    if (err)
      res.send(err)

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

app.get('/api/update', function() {
  //update = new Update();
  //interval = setInterval(function() {
  //  if (!update.process()) {
  //    clearInterval(interval);
  //  }
  //}, 1000);
});

app.get('/api/destroy', function() {
  Activity.remove({}, function() {
    console.log('No more activities!');
  })
});

app.get('*', function(req, res) {
  res.sendfile('./public/index.html');
});

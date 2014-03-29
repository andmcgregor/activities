var express  = require('express');
var app      = express();
var mongoose = require('mongoose');

mongoose.connect('mongodb://andrew:pass123@novus.modulusmongo.net:27017/go7mApiv');

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

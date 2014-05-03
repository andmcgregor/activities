function Chart(data, size, name) {
  this.name = name;
  this.data = JSON.parse(JSON.stringify(data));
  this.newData = data;

  this.radius = Math.min(size, size) / 2;

  this.color = d3.scale.category20();

  this.arc = d3.svg.arc()
                   .outerRadius(this.radius - 100)
                   .innerRadius(0);

  this.pie = d3.layout.pie()
                      .value(function(d) { return d.count; });

  this.svg = d3.select('.activities').append('svg')
                                     .attr('width', size)
                                     .attr('height', size)
                                     .append('g')
                                     .attr('transform', 'translate('+(size/2)+','+(size/2)+')');

  this.draw();
  this.label();
}

Chart.prototype.update = function (selected, lang) {
  newData = {};
  if (this.name == 'repo') {
    for (x = 0; x < selected.length; x++) {
      repoCounts = JSON.parse(selected[x].commits_by_repo);
      for (y = 0; y < repoCounts.length; y++) {
        if (!lang || $.inArray(lang, repoCounts[y].langs) == 1) {
          var name = repoCounts[y].name
          if (newData[name]) {
            newData[name] += repoCounts[y].count;
          } else {
            newData[name] = repoCounts[y].count;
          }
        }
      }
    }
  } else if (this.name == 'lang') {
    for (x = 0; x < selected.length; x++) {
      langs = JSON.parse(selected[x].lang_per_cell);
      for (var lang in langs) {
        if (newData[lang]) {
          newData[lang] = newData[lang] + langs[lang];
        } else {
          newData[lang] = langs[lang];
        }
      }
    }
  }

  var total = 0;
  for (x = 0; x < this.newData.length; x++) {
    if (newData[this.newData[x].name]) {
      this.newData[x].count = newData[this.newData[x].name];
      $('[id="'+window.btoa(this.newData[x].name)+'"]').show();
      total++;
    } else {
      this.newData[x].count = 0;
      $('[id="'+window.btoa(this.newData[x].name)+'"]').hide();
    }
  }

  if (total != 0) {
    this.setData();
  } else {
    //$('.activities path').hide();
  }
}

Chart.prototype.setData = function() {
  this.arcs = this.arcs.data(this.pie(this.newData));
  this.labels = this.labels.data(this.pie(this.newData));

  var arc = this.arc;
  this.arcs.transition().duration(750).attrTween('d', function(a) {
    var i = d3.interpolate(this._current, a);
    this._current = i(0);
    return function(t) {
      return arc(i(t));
    };
  });

  this.labels.transition().duration(750).attr('transform', function(d) {
    var c = arc.centroid(d),
        x = c[0],
        y = c[1],
        h = Math.sqrt(x * x + y * y),
        r = 150;
    return 'translate('+ (x/h * r) + ',' + (y/h * r) + ')';
  });
}

Chart.prototype.reset = function() {
  this.newData = JSON.parse(JSON.stringify(this.data));
  this.setData();
  $('.activities text').show();
}

Chart.prototype.draw = function() {
  var t = this;
  this.arcs = this.svg.datum(this.data).selectAll('path').data(this.pie)
                                       .enter().append('path')
                                       .attr('fill', function(d, i) { return t.color(i); })
                                       .attr('d', this.arc)
                                       .on("mousedown", function(d, i) { angular.element($('body')).scope().langSelect(t.data[i].name) })
                                       .each(function(d) { this._current = d; });
  }

Chart.prototype.label = function(data) {
  var arc = this.arc;
  var data = this.data;
  this.labels = this.svg.datum(this.data).selectAll('text').data(this.pie)
                    .enter().append('text').attr('transform', function(d) {
                      var c = arc.centroid(d),
                          x = c[0],
                          y = c[1],
                          h = Math.sqrt(x * x + y * y),
                          r = 150;
                      return 'translate('+ (x/h * r) + ',' + (y/h * r) + ')';
                    })
                    .attr('text-anchor', 'middle')
                    .attr('id', function(d, i) {
                      return window.btoa(data[i].name)
                    })
                    .text(function(d, i) { return data[i].name })
                    .each(function(d) { this._current = d });
}

Chart.prototype.setLang = function(lang) {
  if (this.name == 'lang') {
    this.newData = [];
    for (x = 0; x < this.data.length; x++) {
      if (this.data[x].name == lang) {
        this.newData.push({
          name: lang,
          count: 1
        });
      } else {
        this.newData.push({
          name: this.data[x].name,
          count: 0
        });
      }
    }
    this.setData();
    $('.activities').find('svg:nth-child(3) text').hide();
    $('.activities').find('svg:nth-child(3) text:contains('+lang+')').show();
  }
}

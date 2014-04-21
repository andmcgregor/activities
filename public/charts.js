function Chart(data, size) {
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

Chart.prototype.update = function (newData) {
  var total = 0;
  if (!(newData instanceof Array)) {
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
  } else {
    this.newData = JSON.parse(JSON.stringify(newData));
    $('.activities text').show();
    total = 1;
  }

  if (total != 0) {
    $('.activities path').show();
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
  } else {
    $('.activities path').hide();
  }
}

Chart.prototype.reset = function() {
  this.update(this.data);
}

Chart.prototype.draw = function() {
  var t = this;
  this.arcs = this.svg.datum(this.data).selectAll('path').data(this.pie)
                                       .enter().append('path')
                                       .attr('fill', function(d, i) { return t.color(i); })
                                       .attr('d', this.arc)
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

function Chart(data, size, colors) {
  this.data = data;
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
  //this.label(data);
}

Chart.prototype.update = function (newData) {
  console.log(this.data);
  for (x = 0; x < this.data.length; x++) {
    if (newData[this.data[x].name]) {
      this.data[x].count = newData[this.data[x].name];
    } else {
      this.data[x].count = 0;
    }
  }
  console.log(this.data);

  this.path = this.path.data(this.pie(this.data));
  this.path.attr('d', this.arc);
}


Chart.prototype.draw = function() {
  var t = this;
  this.path = this.svg.datum(this.data).selectAll('path').data(this.pie)
                                               .enter().append('path')
                                               .attr('fill', function(d, i) { return t.color(i); })
                                               .attr('d', this.arc)
                                               .each(function(d) { this._current = d; });

}

Chart.prototype.label = function(data) {
  var t = this;
  this.arcs.append('svg:text').attr('transform', function(d) {
    var c = t.arc.centroid(d),
        x = c[0],
        y = c[1],
        h = Math.sqrt(x * x + y * y),
        r = 150;
    return 'translate('+ (x/h * r) + ',' + (y/h * r) + ')';
  })
  .attr('text-anchor', 'middle')
  .text(function(d, i) { return data[i].name; });
}

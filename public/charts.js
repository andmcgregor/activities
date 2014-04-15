function Chart(data, size, colors) {
  this.radius = Math.min(size, size) / 2;

  this.arc = d3.svg.arc()
                   .outerRadius(this.radius - 100)
                   .innerRadius(0);

  this.pie = d3.layout.pie()
                      .sort(null)
                      .value(function(d) { return d.count; });

  this.svg = d3.select('.activities').append('svg')
                                     .attr('width', size)
                                     .attr('height', size)
                                     .append('g')
                                     .attr('transform', 'translate('+(size/2)+','+(size/2)+')');

  this.draw(data);
  this.label(data);
}

Chart.prototype.update = function (data) {
  //for(x=0;x<data.length;x++) {
  //  console.log(data[x].name+': '+data[x].count);
  //}

  this.svg.selectAll('.arc').remove();
  this.draw(data);
  this.label(data);
}


Chart.prototype.draw = function(data) {
  this.arcs = this.svg.selectAll('.arc').data(this.pie(data))
                                    .enter()
                                    .append('g')
                                    .attr('class', 'arc');

  this.arcs.append('path').attr('d', this.arc)
                       .style('fill', function(d) { return colors[Math.floor(Math.random()*colors.length)]; });
}

Chart.prototype.label = function(data) {
  var t = this;
  this.arcs.append('svg:text').attr('transform', function(d) {
    return 'translate('+t.arc.centroid(d)+')';
  })
    .attr('text-anchor', 'middle')
    .text(function(d, i) { return data[i].name; });
}



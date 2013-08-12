var url = "../data/manu-by-state.csv"
  , margin = {top: 30, right: 20, bottom: 10, left: 20}
  , width = parseInt(d3.select('#map').style('width'))
  , width = width - margin.left - margin.right
  , height = width * 2/3
  , barHeight = 20
  , spacing = 3
  , bars;

var formats = {
	'State Percent Manu': function(d) { return String(d) + '%'; },
	'State Manu GDP': function(d) { return '$' + d3.format(',')(d); }
};

var chart = d3.select('#chart').append('svg')
    .style('width', (width + margin.left + margin.right) + 'px')
  .append('g')
  	.attr('transform', 'translate(' + [margin.left, margin.top] + ')');

var map = d3.select('#map').append('svg')
	.style('width', width + 'px')
	.style('height', height + 'px');

// projection and path setup
var albers = d3.geo.albersUsa()
	.scale(width)
	.translate([width / 2, height / 2]);

var path = d3.geo.path()
    .projection(albers);

// scales and axes
var colors = d3.scale.quantize()
	.domain([0, 100])
    .range(colorbrewer.YlOrRd[9]);

var x = d3.scale.linear()
    .domain([0, 50])
    .range([0, width]);

var y = d3.scale.ordinal();

var xAxis = d3.svg.axis()
	.orient('top')
    .scale(x);

chart.append('g')
    .attr('class', 'x axis')
    .call(xAxis);

queue()
	.defer(d3.json, '../data/us.json')
	.defer(d3.csv, url)
	.await(render);

d3.select(window).on('resize', function() { requestAnimationFrame(resize); });
d3.select('[name=key]').on('change', update);

function update() {
	var key = d3.select(this).property('value')
	  , values = _(gdp).chain().values().sortBy(key).reverse().value();

	// update our extent for either raw numbers or percents
	var max = key === "State Percent Manu" ? 50
	  : d3.max(values, function(d) { return d[key]; });

	colors.domain([0, max]);
	x.domain([0, max]);
	xAxis.tickFormat(formats[key]);

	// update the chart
	chart.select('.x.axis')
		.transition()
		.duration(500)
	    .call(xAxis);
	
	bars
	    .data(values, function(d) { return d.Area; })
	  .transition()
	  .duration(500)
	    .attr('transform', function(d, i) { return translate(0, y(i)); })
	  .select('rect.manufacturing')
	    .attr('width', function(d) { return x(d[key]); });

	map.selectAll('path.states')
    	.style('fill', function(d) {
			var name = d.properties.name
			  , value = gdp[name] ? gdp[name][key] : null;

			return colors(value);
		});
}


function render(err, us, gdp) {
	
	var states = topojson.feature(us, us.objects.states)
	  , land = topojson.mesh(us, us.objects.land)
	  , key = d3.select('[name=key]').property('value');

	// set the y range and x format
	xAxis.tickFormat(formats[key]);

	y.domain(d3.range(gdp.length))
		.rangeBands([0, barHeight * gdp.length]);

	d3.select(chart.node().parentNode)
		.style('height', (y.rangeExtent()[1] + margin.top + margin.bottom) + 'px');

	window.us = us;
	window.gdp = gdp = _(gdp).chain().map(function(d) {
		// fix our numbers
		d['Percent US Manu GDP'] = +d['Percent US Manu GDP'];
		d['GDP'] = +d['GDP'];
		d['State Manu GDP'] = +d['State Manu GDP'];
		d['State Percent Manu'] = +d['State Percent Manu'];

		// then return [key, value]
		return [d.Area, d];
	}).object().value();

	colors.domain(d3.extent(d3.values(gdp), function(d) {
		return d[key];
	}));

	// make a map
	map.append('path')
	    .datum(land)
	    .attr('class', 'land')
	    .attr('d', path);

	map.selectAll('path.states')
	    .data(states.features)
	  .enter().append('path')
	    .attr('d', path)
	    .attr('class', 'states')
	    .style('fill', function(d) {
	    	var name = d.properties.name
	    	  , value = gdp[name] ? gdp[name][key] : null;

	    	return colors(value);
	    });

	// make a chart
	bars = chart.selectAll('.bar')
	    .data(_(gdp).chain().values().sortBy(key).reverse().value(), 
	    	function(d) { return d.Area; })
	  .enter().append('g')
	    .attr('class', 'bar')
	    .attr('transform', function(d, i) { return translate(0, y(i)) });
	
	bars.append('rect')
		.attr('class', 'non-manufacturing')
		.attr('height', y.rangeBand())
		.attr('width', width);

	bars.append('rect')
		.attr('class', 'manufacturing')
	  	.attr('height', y.rangeBand())
	  	.attr('width', function(d) { return x(d[key]); });
	
	bars.append('text')
	    .text(function(d) { return d.Area; })
	    .attr('y', y.rangeBand() - 5)
	    .attr('x', spacing);
}


function resize() {
	// adjust things when the window size changes
	width = parseInt(d3.select('#map').style('width'));
	width = width - margin.left - margin.right;
	height = width * 2/3;

	albers
		.translate([width / 2, height / 2])
		.scale(width);

	map
		.style('width', width + 'px')
		.style('height', height + 'px');

	d3.select(chart.node().parentNode)
		.style('width', width + 'px')
		.style('height', height + 'px');

	x.range([0, width]);
	chart.select('.x.axis').call(xAxis);

	map.select('.land').attr('d', path);
	map.selectAll('.states').attr('d', path);
}


function translate(x, y) {
	return "translate(" + [x, y] + ")";
}
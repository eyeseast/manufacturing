var url = "../data/manu-by-state.csv"
  , margins = {top: 10, right: 10, bottom: 10, left: 10}
  , width = parseInt(d3.select('#map').style('width'))
  , height = 600;

var map = d3.select('#map').append('svg')
    .style('width', width + 'px')
    .style('height', height + 'px');

var albers = d3.geo.albersUsa();

var path = d3.geo.path()
    .projection(albers);

var colors = d3.scale.quantize()
	.domain([0, 100])
    .range(colorbrewer.YlOrRd[9]);

queue()
	.defer(d3.json, '../data/us.json')
	.defer(d3.csv, url)
	.await(render);

d3.select('[name=key]').on('change', update);

function update() {
	var key = d3.select(this).property('value');
	console.log(key);

	colors.domain(d3.extent(d3.values(gdp), function(d) {
		return d[key];
	}));

	map.selectAll('path.states')
    	.style('fill', function(d) {
			var name = d.properties.name
			  , value = gdp[name] ? gdp[name][key] : null;

			return colors(value);
		});
}

function render(err, us, gdp) {
	
	var states = topojson.feature(us, us.objects.states)
	  , land = topojson.mesh(us, us.objects.land);

	window.gdp = gdp = _.object(_.map(gdp, function(d) {
		d['Percent US Manu GDP'] = +d['Percent US Manu GDP'];
		d['GDP'] = +d['GDP'];
		d['State Manu GDP'] = +d['State Manu GDP'];
		d['State Percent Manu'] = +d['State Percent Manu'];
		return [d.Area, d];
	}));

	colors.domain(d3.extent(d3.values(gdp), function(d) {
		return d['State Percent Manu'];
	}));

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
	    	  , value = gdp[name] ? gdp[name]['State Percent Manu'] : null;

	    	return colors(value);
	    });
}

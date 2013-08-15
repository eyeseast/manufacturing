var margin = {top: 30, right: 20, bottom: 10, left: 20}
  , mapRatio = .5
  , width = parseInt(d3.select('#map').style('width'))
  , width = width - margin.left - margin.right
  , height = width * mapRatio
  , barHeight = 20
  , spacing = 3
  , legendWidth = 40
  , bars;

var formats = {
    'prefixed': d3.format('s'),
    'State Percent Manu': d3.format('%'),
    'State Manu GDP': function(d) { return '$' + formats.prefixed(d); }
};

var chart = d3.select('#chart').append('svg')
    .style('width', (width + margin.left + margin.right) + 'px')
  .append('g')
    .attr('transform', 'translate(' + [margin.left, margin.top] + ')');

var map = d3.select('#map').append('svg')
    .style('width', width + 'px')
    .style('height', height + 'px');

// projection and path setup
var projection = d3.geo.albersUsa()
    .scale(width)
    .translate([width / 2, height / 2]);

var path = d3.geo.path()
    .projection(projection);

// scales and axes
var colors = d3.scale.quantize()
    //.domain([0, .5])
    .range(colorbrewer.YlGnBu[7]);

var x = d3.scale.linear()
    //.domain([0, .5])
    .range([0, width]);

var y = d3.scale.ordinal();

var xAxis = d3.svg.axis()
    .orient('top')
    .scale(x);

var colorSelect = d3.select('form').append('select')
    .attr('name', 'color')
    .on('change', function() {
        var value = this.value
          , key = d3.select('[name=key]').property('value');

        colors.range(colorbrewer[value][7]);

        map.selectAll('path.states')
            .transition()
            .duration(500)
            .call(stateStyle, key);
    });

colorSelect.selectAll('option')
    .data(_.keys(colorbrewer))
  .enter().append('option')
    .attr('value', String)
    .text(String);

colorSelect.property('value', 'YlGnBu');

queue()
    .defer(d3.json, urls.us)
    .defer(d3.csv, urls.gdp)
    .defer(d3.csv, urls.sectors)
    .await(render);

d3.select(window).on('resize', function() { requestAnimationFrame(resize); });
d3.select('[name=key]').on('change', update);

function modal(d, i) {
    // get a state, checking if we just clicked the map or a bar
    var state = d.Area ? d : gdp[d.properties.name]
      , modal = d3.select('#modal');

    if (!state || !state.sectors) return;

    var sectors = _(state.sectors).chain()
        .clone()
        .pairs().sortBy(function(d) { return +d[1]; })
        .reverse()
        .slice(0, 5)
        .value();
    
    window._state = state;
    
    // update the modal for this state
    modal.select('.modal-title').text(state.Area);

    // clear the table
    $(modal.node()).find('table tbody').empty();

    var row = modal.select('table tbody').selectAll('tr')
        .data(sectors)
      .enter().append('tr');

    // industry name
    row.append('td').text(function(d) { return d[0]; });

    // industry gdp
    row.append('td').text(function(d) { 
        return formats['State Manu GDP'](d[1]); 
    });

    // show the actual modal
    $(modal.node()).modal('show');
}

function update() {
    var key = d3.select(this).property('value')
      , values = _(gdp).chain().values().sortBy(key).reverse().value();

    // update our extent for either raw numbers or percents
    /***
    var max = key === "State Percent Manu" ? 50
      : d3.max(values, function(d) { return d[key]; });
    ***/
    var max = d3.max(values, function(d) { return d[key]; });
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
        .transition()
        .duration(500)
        .call(stateStyle, key);

    d3.select('#legend ul').selectAll('li.key')
        .data(_.map(colors.range(), colors.invertExtent))
        .call(legendStyle, key);
}


function render(err, us, gdp, sectors) {

    // set the y range and x format
    xAxis.tickFormat(formats[key]);
    chart.append('g')
        .attr('class', 'x axis')
        .call(xAxis);

    y.domain(d3.range(gdp.length))
        .rangeBands([0, barHeight * gdp.length]);

    d3.select(chart.node().parentNode)
        .style('height', (y.rangeExtent()[1] + margin.top + margin.bottom) + 'px');

    var gdp = window.gdp = _(gdp).chain().map(function(d) {
        // fix our numbers
        d['Percent US Manu GDP'] = +d['Percent US Manu GDP'] / 100;
        d['GDP'] = +d['GDP'];
        d['State Manu GDP'] = +d['State Manu GDP'];
        d['State Percent Manu'] = +d['State Percent Manu'] / 100;

        // then return [key, value]
        return [d.Area, d];
    }).object().value();

    // merge in sector data
    _.each(sectors, function(d) {
        // each row has [state, sector, gdp]
        // set gdp[state].sectors[sector] = gdp
        var state = gdp[d.State] || (gdp[d.State] = {})
          , sectors = state.sectors || (state.sectors = {});

        // figures should be in millions
        sectors[d.Sector] = parseInt(d.GDP.replace('$', '') * Math.pow(10, 6));
    });

    var key = d3.select('[name=key]').property('value')
      , values = _(gdp).chain().values().sortBy(key).reverse().value()
      , max = d3.max(values, function(d) { return d[key]; });

    colors.domain([0, max]);
    x.domain([0, max]);
    xAxis.tickFormat(formats[key]);

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

    bars.on('click', modal);

    // make a map
    window.us = us;

    var states = topojson.feature(us, us.objects.states, function(a, b) { return a !== b; })
      , land = topojson.mesh(us, us.objects.land);

    if (projection.center) {
        // center over the US, for projections that need this
        projection.center(path.centroid(land));
    }

    map.append('path')
        .datum(land)
        .attr('class', 'land')
        .attr('d', path);

    map.selectAll('path.states')
        .data(states.features)
      .enter().append('path')
        .attr('d', path)
        .attr('class', 'states')
        .call(stateStyle, key)
        .on('click', modal)
        .on('mouseover', function(d, i) {
            var state = d3.select(this)
              , fill = d3.rgb(state.style('fill'));

            state.style('fill', fill.darker(.2));

            hover.datum(d)
                .style('stroke', '#333')
                .style('stroke-width', 2)
                .attr('d', path);
        })
        .on('mouseout', function(d, i) {
            var state = d3.select(this)
              , fill = d3.rgb(state.style('fill'));

            state.style('fill', fill.brighter(.2));
        });

    var hover = map.append('path')
        .attr('class', 'hover');

    var legend = d3.select('#legend').append('ul')
        .attr('class', 'list-inline');
    
    var keys = legend.selectAll('li.key')
        .data(_.map(colors.range(), colors.invertExtent));
    
    keys.enter().append('li')
        .attr('class', 'key')
        .call(legendStyle, key);
        /***
        .style('background-color', function(d) { return colors(d[0]); })
        .text(function(d) {
            return formats[key](d[0]) + ' - ' + formats[key](d[1]);
        });
        ***/
}


function resize() {
    // adjust things when the window size changes
    width = parseInt(d3.select('#map').style('width'));
    width = width - margin.left - margin.right;
    height = width * mapRatio;

    var key = d3.select('[name=key]').property('value');

    projection
        .translate([width / 2, height / 2])
        .scale(width);

    map
        .style('width', width + 'px')
        .style('height', height + 'px');

    d3.select(chart.node().parentNode)
        .style('width', width + 'px')
        .style('height', height + 'px');

    // resize the chart
    x.range([0, width]);
    d3.select(chart.node().parentNode)
        .style('height', (y.rangeExtent()[1] + margin.top + margin.bottom) + 'px')
        .style('width', (width + margin.left + margin.right) + 'px');

    chart.select('.x.axis').call(xAxis);


    bars.select('rect.non-manufacturing')
        .attr('width', width);

    bars.select('rect.manufacturing')
        .attr('width', function(d) { return x(d[key]); });

    // resize the map
    map.select('.land').attr('d', path);
    map.selectAll('.states').attr('d', path);
}

function legendStyle(selection, key) {
    selection
        .style('background-color', function(d) { return colors(d[0]); })
        .text(function(d) {
            return formats[key](d[0]) + ' - ' + formats[key](d[1]);
        });
}

function stateStyle(selection, key) {
    selection.style('fill', function(d) {
        var name = d.properties.name
          , value = gdp[name] ? gdp[name][key] : null;

        return colors(value);
    });
}


function translate(x, y) {
    return "translate(" + [x, y] + ")";
}
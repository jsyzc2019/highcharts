/**
 * Faster scatter charts mod for Highcharts
 *
 * Author: Torstein Honsi
 * Last updated: 2016-09-23
 */
(function (H) {

    // Skip advanced options testing, assume all points are given as [x, y]
    class ScatterPoint extends H.Point {
        init(series, options) {
            this.series = series;
            this.x = options[0];
            this.y = options[1];
            this.options = options;
            return this;
        }
    }
    H.seriesTypes.scatter.prototype.pointClass = ScatterPoint;

    // Draw points as composite shapes
    H.seriesTypes.scatter.prototype.drawPoints = function () {
        const data = this.points,
            renderer = this.chart.renderer,
            radius = this.options.marker.radius,
            stripes = [];

        let group,
            i = data.length,
            point,
            layers = this.layers;

        if (!layers) {
            layers = this.layers = [];
        }

        // Divide the points into stripes. Points within the same group won't overlap in the y
        // dimension
        while (i--) {
            point = data[i];
            group = Math.round(point.plotY / radius);
            if (!stripes[group]) {
                stripes[group] = [];
            }
            stripes[group].push(point);
        }

        // Sort the members of each stripe by x value
        i = stripes.length;
        while (i--) {
            if (stripes[i]) {
                stripes[i].sort(function (a, b) {
                    return a.plotX - b.plotX;
                });
            }
        }

        // Loop over the members of each stripe and add them to a group if they don't overlap
        // in the x dimension.
        const groups = [];

        let oddOrEven = 0,
            stripe,
            remaining = data.length,
            x,
            lastX,
            j;

        // first do even stripes, where points are guaranteed not to overlap with points in even stripes
        while (remaining) {
            group = [];

            for (i = oddOrEven; i < stripes.length; i += 2) {
                stripe = stripes[i];
                if (stripe) {
                    j = stripe.length;
                    lastX = null;
                    while (j--) {
                        x = stripe[j].plotX;
                        if (lastX === null || lastX - x >= radius * 2) {
                            group.push(stripe[j]); // push it to the group
                            stripe.splice(j, 1); // remove it from the stripe
                            remaining--;
                            lastX = x;
                        }
                    }
                }
            }

            if (group.length) {
                groups.push(group);
            }

            if (!group.length && !oddOrEven) { // finished adding points to even stripes
                oddOrEven = 1;
            }
        }

        i = groups.length;
        const paths = [];
        while (i--) {
            const path = [];
            let y;

            group = groups[i];

            for (j = 0; j < group.length; j += 1) {
                // Math.round reduces rendering times by 20% in a 50,000 points chart
                x = Math.round(group[j].plotX);
                y = Math.round(group[j].plotY);
                path.push(
                    ['M', x - radius, y - radius],
                    ['L', x + radius, y - radius],
                    ['L', x + radius, y + radius],
                    ['L', x - radius, y + radius]
                );

                /* Note: using the symbol prototype gives  higher
                processing times. The rendering time is slightly higher for
                complex paths like circles, and lower for simple paths like
                triangles. Tested in Chrome. Probably the best solution is to
                use a simplified shape calculation inline. */
                /*
                symbolPath = Highcharts.Renderer.prototype.symbols.circle(
                x - radius,
                y - radius,
                size,
                size);

                // faster than concat:
                for (let m = 0, len = symbolPath.length; m < len; m += 1)
                path.push(symbolPath[m]);
                */
            }

            paths.push(path);


        }

        // render
        for (i = 0; i < paths.length; i += 1) {
            if (!layers[i]) {
                layers[i] = renderer.path(paths[i]).attr({
                    fill: this.pointAttribs().fill
                }).add(this.markerGroup);
            } else {
                layers[i].attr({
                    d: paths[i]
                });
            }
        }
        layers.length = i;
    };

}(Highcharts));
// End faster scatter mod

// Prepare the data
const data = [];
for (let i = 0; i < 50000; i += 1) {
    data.push([
        Math.pow(Math.random(), 2) * 100,
        Math.pow(Math.random(), 2) * 100
    ]);
}

const start = +new Date();
// console.profile('scatter');
Highcharts.chart('container', {

    xAxis: {
        gridLineWidth: 1
    },
    yAxis: {
        min: 0,
        max: 100
    },

    title: {
        text: 'Scatter chart with ' + data.length + ' points'
    },
    subtitle: {
        text: 'Rendered in ...'
    },
    legend: {
        enabled: false
    },
    series: [{
        type: 'scatter',
        animation: false,
        data: data,
        color: 'rgba(152,0,67,0.2)',
        marker: {
            radius: 1,
            states: {
                hover: {
                    radius: 2,
                    lineWidth: 1,
                    lineColor: 'black'
                }
            }
        },
        tooltip: {
            followPointer: false,
            pointFormat: '[{point.x:.1f}, {point.y:.1f}]'
        }
    }]

}, function (chart) {
    // console.profileEnd('scatter');
    chart.setTitle(null, {
        text: 'Rendered in ' + (new Date() - start) + ' ms by Highcharts'
    });
});
/* *
 *
 *  (c) 2016-2021 Highsoft AS
 *
 *  Author: Lars A. V. Cabrera
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

import type {
    HTMLDOMElement
} from '../Renderer/DOMElementType';
import Chart from './Chart.js';

/**
 * Internal types
 * @private
 */
declare global {
    namespace Highcharts {
        interface Options {
            isGantt?: boolean;
        }
    }
}

import U from '../Utilities.js';
const {
    getOptions,
    isArray,
    merge,
    splat
} = U;

import '../../Series/Gantt/GanttSeries.js';

class GanttChart extends Chart {
    /**
     * Initializes the chart. The constructor's arguments are passed on
     * directly.
     *
     * @function Highcharts.GanttChart#init
     *
     * @param {Highcharts.Options} userOptions
     *        Custom options.
     *
     * @param {Function} [callback]
     *        Function to run when the chart has loaded and and all external
     *        images are loaded.
     *
     * @return {void}
     *
     * @fires Highcharts.GanttChart#event:init
     * @fires Highcharts.GanttChart#event:afterInit
     */
    public init(
        userOptions: Partial<Highcharts.Options>,
        callback?: Chart.CallbackFunction
    ): void {
        var seriesOptions = userOptions.series,
            defaultOptions = getOptions(),
            defaultLinkedTo: number;

        // If user hasn't defined axes as array, make it into an array and add a
        // second axis by default.
        if (!isArray(userOptions.xAxis)) {
            userOptions.xAxis = [userOptions.xAxis || {}, {}];
        }

        // apply X axis options to both single and multi x axes
        userOptions.xAxis = userOptions.xAxis.map(function (
            xAxisOptions: Highcharts.XAxisOptions,
            i: number
        ): Highcharts.XAxisOptions {
            if (i === 1) { // Second xAxis
                defaultLinkedTo = 0;
            }
            return merge<Highcharts.XAxisOptions>(
                defaultOptions.xAxis as any,
                { // defaults
                    grid: {
                        enabled: true
                    },
                    opposite: true,
                    linkedTo: defaultLinkedTo
                } as Highcharts.XAxisOptions,
                xAxisOptions, // user options
                { // forced options
                    type: 'datetime'
                } as Highcharts.XAxisOptions
            );
        });

        // apply Y axis options to both single and multi y axes
        userOptions.yAxis = (splat(userOptions.yAxis || {})).map(function (
            yAxisOptions: Highcharts.YAxisOptions
        ): Highcharts.YAxisOptions {
            return merge<Highcharts.YAxisOptions>(
                defaultOptions.yAxis as any, // #3802
                { // defaults
                    grid: {
                        enabled: true
                    },

                    staticScale: 50,

                    reversed: true,

                    // Set default type treegrid, but only if 'categories' is
                    // undefined
                    type: yAxisOptions.categories ? yAxisOptions.type : 'treegrid'
                } as Highcharts.YAxisOptions,
                yAxisOptions // user options
            );
        });

        userOptions.series = void 0;

        userOptions = merge(
            true,
            {
                chart: {
                    type: 'gantt'
                },
                title: {
                    text: null as any
                },
                legend: {
                    enabled: false
                },
                navigator: {
                    series: { type: 'gantt' },
                    // Bars were clipped, #14060.
                    yAxis: {
                        type: 'category'
                    }
                }
            } as Highcharts.Options,

            userOptions, // user's options

            // forced options
            {
                isGantt: true
            } as Highcharts.Options
        );

        userOptions.series = seriesOptions;

        super.init(userOptions, callback);
    }
}

/* eslint-disable valid-jsdoc */

/**
 * The factory function for creating new gantt charts. Creates a new {@link
 * Highcharts.GanttChart|GanttChart} object with different default options than
 * the basic Chart.
 *
 * @example
 * // Render a chart in to div#container
 * var chart = Highcharts.ganttChart('container', {
 *     title: {
 *         text: 'My chart'
 *     },
 *     series: [{
 *         data: ...
 *     }]
 * });
 *
 * @function Highcharts.ganttChart
 *
 * @param {string|Highcharts.HTMLDOMElement} renderTo
 *        The DOM element to render to, or its id.
 *
 * @param {Highcharts.Options} options
 *        The chart options structure.
 *
 * @param {Highcharts.ChartCallbackFunction} [callback]
 *        Function to run when the chart has loaded and and all external images
 *        are loaded. Defining a
 *        [chart.events.load](https://api.highcharts.com/highcharts/chart.events.load)
 *        handler is equivalent.
 *
 * @return {Highcharts.GanttChart}
 *         Returns the Chart object.
 */
function ganttChart(
    a: (string|HTMLDOMElement|Highcharts.Options),
    b?: (Chart.CallbackFunction|Highcharts.Options),
    c?: Chart.CallbackFunction
): GanttChart {
    return new GanttChart(a as any, b as any, c);
}

const ganttModule = {
    ganttChart,
    GanttChart
};

export default ganttModule;

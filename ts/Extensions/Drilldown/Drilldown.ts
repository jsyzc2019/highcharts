/* *
 *
 *  Highcharts Drilldown module
 *
 *  Author: Torstein Honsi
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

'use strict';

/* *
 *
 *  Imports
 *
 * */

import type AnimationOptions from '../../Core/Animation/AnimationOptions';
import type BBoxObject from '../../Core/Renderer/BBoxObject';
import type { BreadcrumbOptions } from '../Breadcrumbs/BreadcrumbsOptions';
import type Chart from '../../Core/Chart/Chart';
import type ColorType from '../../Core/Color/ColorType';
import type {
    CSSObject,
    CursorValue
} from '../../Core/Renderer/CSSObject';
import type DrilldownOptions from './DrilldownOptions';
import type Options from '../../Core/Options';
import type MapPointType from '../../Series/Map/MapPoint.js';
import type MapSeriesType from '../../Series/Map/MapSeries.js';
import type {
    PointOptions,
    PointShortOptions
} from '../../Core/Series/PointOptions';
import type SeriesOptions from '../../Core/Series/SeriesOptions';
import type { SeriesTypeOptions } from '../../Core/Series/SeriesType';
import type SVGAttributes from '../../Core/Renderer/SVG/SVGAttributes';
import type SVGElement from '../../Core/Renderer/SVG/SVGElement';

import A from '../../Core/Animation/AnimationUtilities.js';
const { animObject } = A;
import Axis from '../../Core/Axis/Axis.js';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs.js';
import Color from '../../Core/Color/Color.js';
import H from '../../Core/Globals.js';
const { noop } = H;
import DrilldownDefaults from './DrilldownDefaults.js';
import Point from '../../Core/Series/Point.js';
import Series from '../../Core/Series/Series.js';
import SeriesRegistry from '../../Core/Series/SeriesRegistry.js';
const {
    column: ColumnSeries,
    map: MapSeries,
    pie: PieSeries
} = SeriesRegistry.seriesTypes;
import SVGRenderer from '../../Core/Renderer/SVG/SVGRenderer.js';
import Tick from '../../Core/Axis/Tick.js';
import U from '../../Core/Utilities.js';
const {
    addEvent,
    defined,
    diffObjects,
    extend,
    fireEvent,
    merge,
    objectEach,
    pick,
    pushUnique,
    removeEvent,
    syncTimeout
} = U;

/* *
 *
 *  Declarations
 *
 * */

declare module '../../Core/Axis/AxisLike' {
    interface AxisLike {
        ddPoints?: Record<string, Array<(false|Point)>>;
        oldPos?: number;
        drilldownCategory(x: number, e: MouseEvent): void;
        getDDPoints(x: number): Array<(false|Point)>;
    }
}

declare module '../../Core/Axis/TickLike' {
    interface TickLike {
        drillable(): void;
    }
}

declare module '../../Core/Chart/ChartLike' {
    interface ChartLike {
        ddDupes?: Array<string>;
        drilldownLevels?: Array<Drilldown.LevelObject>;
        drillUpButton?: SVGElement;
        addSeriesAsDrilldown(
            point: Point,
            options: SeriesTypeOptions
        ): void;
        addSingleSeriesAsDrilldown(
            point: Point,
            ddOptions: SeriesTypeOptions
        ): void;
        applyDrilldown(): void;
        drillUp(isMultipleDrillUp?: boolean): void;
    }
}

declare module '../../Core/Options'{
    interface Options {
        drilldown?: DrilldownOptions;
    }
}

declare module '../../Core/Options' {
    interface LangOptions {
        /** @deprecated */
        drillUpText?: string;
    }
}

declare module '../../Core/Renderer/SVG/SVGElementLike' {
    interface SVGElementLike {
        fadeIn(animation?: (boolean|Partial<AnimationOptions>)): void;
    }
}

declare module '../../Core/Series/PointLike' {
    interface PointLike {
        drilldown?: string;
        doDrilldown(): void;
        runDrilldown(
            holdRedraw?: boolean,
            category?: number,
            originalEvent?: Event
        ): void;
        unbindDrilldownClick?: Function;
    }
}

declare module '../../Core/Series/SeriesLike' {
    interface SeriesLike {
        drilldownLevel?: Drilldown.LevelObject;
        isDrilling?: boolean;
        purgedOptions?: SeriesTypeOptions;
        /** @requires Extensions/Drilldown */
        animateDrilldown(init?: boolean): void;
        /** @requires Extensions/Drilldown */
        animateDrillupFrom(level: Drilldown.LevelObject): void;
        /** @requires Extensions/Drilldown */
        animateDrillupTo(init?: boolean): void;
    }
}

declare module '../../Core/Series/SeriesOptions' {
    interface SeriesOptions {
        _ddSeriesId?: number;
        _levelNumber?: number;
        drilldown?: string;
    }
}

/* *
 *
 *  Variables
 *
 * */

let ddSeriesId = 1;

/* *
 *
 *  Functions
 *
 * */

/** @private */
function applyCursorCSS(
    element: SVGElement,
    cursor: CursorValue,
    addClass?: boolean,
    styledMode?: boolean
): void {
    element[addClass ? 'addClass' : 'removeClass'](
        'highcharts-drilldown-point'
    );

    if (!styledMode) {
        element.css({ cursor: cursor });
    }
}

/**
 * This method creates an array of arrays containing a level number
 * with the corresponding series/point.
 *
 * @requires  modules/breadcrumbs
 *
 * @private
 * @param {Highcharts.Chart} chart
 *        Highcharts Chart object.
 * @return {Array<Breadcrumbs.BreadcrumbOptions>}
 * List for Highcharts Breadcrumbs.
 */
function createBreadcrumbsList(
    chart: Chart
): Array<BreadcrumbOptions> {
    const list: Array<BreadcrumbOptions> = [],
        drilldownLevels = chart.drilldownLevels;

    // The list is based on drilldown levels from the chart object
    if (drilldownLevels && drilldownLevels.length) {
        // Add the initial series as the first element.
        if (!list[0]) {
            list.push({
                level: 0,
                levelOptions: drilldownLevels[0].seriesOptions
            });
        }

        drilldownLevels.forEach(function (level, i): void {
            const lastBreadcrumb = list[list.length - 1];

            // If level is already added to breadcrumbs list,
            // don't add it again- drilling categories
            // + 1 because of the wrong levels numeration
            // in drilldownLevels array.
            if (level.levelNumber + 1 > lastBreadcrumb.level) {
                list.push({
                    level: level.levelNumber + 1,
                    levelOptions: merge({
                        name: level.lowerSeries.name
                    }, level.pointOptions)
                });
            }
        });
    }
    return list;
}

/** @private */
function onPointClick(
    this: Point,
    e: MouseEvent
): void {
    const point = this,
        series = point.series;

    if (
        series.xAxis &&
        (series.chart.options.drilldown as any).allowPointDrilldown ===
        false
    ) {
        // #5822, x changed
        series.xAxis.drilldownCategory(point.x as any, e);
    } else {
        point.runDrilldown(void 0, void 0, e);
    }
}

/* *
 *
 *  Class
 *
 * */

/**
 * @private
 */
class ChartAdditions {

    /* *
     *
     *  Constructor
     *
     * */

    public constructor(
        chart: Drilldown.ChartComposition
    ) {
        this.chart = chart;
    }

    /* *
     *
     *  Properties
     *
     * */

    public chart: Drilldown.ChartComposition;

    /* *
     *
     *  Functions
     *
     * */

    /**
     * Add a series to the chart as drilldown from a specific point in the
     * parent series. This method is used for async drilldown, when clicking a
     * point in a series should result in loading and displaying a more
     * high-resolution series. When not async, the setup is simpler using the
     * [drilldown.series](https://api.highcharts.com/highcharts/drilldown.series)
     * options structure.
     *
     * @sample highcharts/drilldown/async/
     *         Async drilldown
     *
     * @function Highcharts.Chart#addSeriesAsDrilldown
     *
     * @param {Highcharts.Point} point
     * The point from which the drilldown will start.
     *
     * @param {Highcharts.SeriesOptionsType} options
     * The series options for the new, detailed series.
     */
    public addSeriesAsDrilldown(
        this: (this|Drilldown.ChartComposition),
        point: Point,
        options: SeriesTypeOptions
    ): void {
        const chart = (
            (this as this).chart ||
            (this as Drilldown.ChartComposition)
        );

        if (chart.mapView) {
            // stop hovering while drilling down
            point.series.isDrilling = true;

            chart.series.forEach((series): void => {
                // stop duplicating and overriding animations
                series.options.inactiveOtherPoints = true;

                // hide and disable dataLabels
                series.dataLabelsGroup?.destroy();
                delete series.dataLabelsGroup;
            });

            // #18925 map zooming is not working with geoJSON maps
            if (
                chart.options.drilldown &&
                !chart.mapView.projection.hasGeoProjection &&
                DrilldownDefaults
            ) {
                const userDrilldown = diffObjects(
                    chart.options.drilldown,
                    DrilldownDefaults
                );

                // set mapZooming to false if user didn't set any in chart
                // config
                if (!defined(userDrilldown.mapZooming)) {
                    chart.options.drilldown.mapZooming = false;
                }
            }

            if (
                chart.options.drilldown &&
                chart.options.drilldown.animation &&
                chart.options.drilldown.mapZooming
            ) {
                // first zoomTo then crossfade series
                chart.mapView.allowTransformAnimation = true;

                const animOptions =
                    animObject(chart.options.drilldown.animation);

                if (typeof animOptions !== 'boolean') {
                    const userComplete = animOptions.complete,
                        drilldownComplete = function (
                            obj?: { applyDrilldown?: boolean }): void {
                            if (obj && obj.applyDrilldown && chart.mapView) {
                                chart
                                    .addSingleSeriesAsDrilldown(point, options);
                                chart.applyDrilldown();
                                chart.mapView.allowTransformAnimation = false;
                            }
                        };
                    animOptions.complete =
                        function (): void {
                            if (userComplete) {
                                userComplete.apply(this, arguments);
                            }
                            drilldownComplete.apply(this, arguments);
                        };
                }

                (point as MapPointType).zoomTo(animOptions);

            } else {
                chart.addSingleSeriesAsDrilldown(point, options);
                chart.applyDrilldown();
            }
        } else {
            chart.addSingleSeriesAsDrilldown(point, options);
            chart.applyDrilldown();
        }
    }

    /** @private */
    public addSingleSeriesAsDrilldown(
        this: (this|Drilldown.ChartComposition),
        point: Point,
        ddOptions: SeriesTypeOptions
    ): void {
        const chart = (
            (this as this).chart ||
            (this as Drilldown.ChartComposition)
        );

        let oldSeries = point.series,
            xAxis = oldSeries.xAxis,
            yAxis = oldSeries.yAxis,
            newSeries: Series,
            pointIndex: number,
            levelSeries: Array<Series> = [],
            levelSeriesOptions: Array<SeriesOptions> = [],
            level: Drilldown.LevelObject,
            levelNumber: number,
            last: (Drilldown.LevelObject|undefined),
            colorProp: SeriesOptions;


        colorProp = chart.styledMode ?
            { colorIndex: pick(point.colorIndex, oldSeries.colorIndex) } :
            { color: point.color || oldSeries.color };

        if (!chart.drilldownLevels) {
            chart.drilldownLevels = [];
        }

        levelNumber = oldSeries.options._levelNumber || 0;

        // See if we can reuse the registered series from last run
        last = chart.drilldownLevels[chart.drilldownLevels.length - 1];
        if (last && last.levelNumber !== levelNumber) {
            last = void 0;
        }

        ddOptions = extend(extend<SeriesOptions>({
            _ddSeriesId: ddSeriesId++
        }, colorProp), ddOptions);
        pointIndex = oldSeries.points.indexOf(point);

        // Record options for all current series
        oldSeries.chart.series.forEach((series): void => {
            if (series.xAxis === xAxis) {
                series.options._ddSeriesId =
                    series.options._ddSeriesId || ddSeriesId++;
                series.options.colorIndex = series.colorIndex;
                series.options._levelNumber =
                    series.options._levelNumber || levelNumber; // #3182

                if (last) {
                    levelSeries = last.levelSeries;
                    levelSeriesOptions = last.levelSeriesOptions;
                } else {
                    levelSeries.push(series);

                    // (#10597)
                    series.purgedOptions = merge<SeriesTypeOptions>({
                        _ddSeriesId: series.options._ddSeriesId,
                        _levelNumber: series.options._levelNumber,
                        selected: series.options.selected
                    }, series.userOptions);

                    levelSeriesOptions.push(series.purgedOptions);
                }
            }
        });

        // Add a record of properties for each drilldown level
        level = extend<Drilldown.LevelObject>({
            levelNumber: levelNumber,
            seriesOptions: oldSeries.options,
            seriesPurgedOptions: oldSeries.purgedOptions as any,
            levelSeriesOptions: levelSeriesOptions,
            levelSeries: levelSeries,
            shapeArgs: point.shapeArgs,
            // no graphic in line series with markers disabled
            bBox: point.graphic ? point.graphic.getBBox() : {},
            color: point.isNull ?
                Color.parse(colorProp.color).setOpacity(0).get() :
                colorProp.color,
            lowerSeriesOptions: ddOptions,
            pointOptions: (oldSeries.options.data as any)[pointIndex],
            pointIndex: pointIndex,
            oldExtremes: {
                xMin: xAxis && xAxis.userMin,
                xMax: xAxis && xAxis.userMax,
                yMin: yAxis && yAxis.userMin,
                yMax: yAxis && yAxis.userMax
            },
            resetZoomButton: last && last.levelNumber === levelNumber ?
                void 0 : chart.resetZoomButton as any
        } as any, colorProp);

        // Push it to the lookup array
        chart.drilldownLevels.push(level);

        // Reset names to prevent extending (#6704)
        if (xAxis && xAxis.names) {
            xAxis.names.length = 0;
        }

        newSeries = level.lowerSeries = chart.addSeries(ddOptions, false);
        newSeries.options._levelNumber = levelNumber + 1;
        if (xAxis) {
            xAxis.oldPos = xAxis.pos;
            xAxis.userMin = xAxis.userMax = null as any;
            yAxis.userMin = yAxis.userMax = null as any;
        }
        newSeries.isDrilling = true;

        // Run fancy cross-animation on supported and equal types
        if (oldSeries.type === newSeries.type) {
            newSeries.animate = (newSeries.animateDrilldown || noop);
            newSeries.options.animation = true;
        }
    }

    public applyDrilldown(
        this: (this|Drilldown.ChartComposition)
    ): void {
        const chart = (
                (this as this).chart ||
                (this as Drilldown.ChartComposition)
            ),
            drilldownLevels = chart.drilldownLevels;

        let levelToRemove: (number|undefined);

        if (drilldownLevels && drilldownLevels.length > 0) {
            // #3352, async loading
            levelToRemove =
                drilldownLevels[drilldownLevels.length - 1].levelNumber;
            chart.hasCartesianSeries = drilldownLevels.some((level): boolean =>
                level.lowerSeries.isCartesian); // #19725
            (chart.drilldownLevels || []).forEach((level): void => {

                if (
                    chart.mapView &&
                    chart.options.drilldown &&
                    chart.options.drilldown.mapZooming
                ) {
                    chart.redraw();
                    level.lowerSeries.isDrilling = false;
                    chart.mapView.fitToBounds(
                        (level.lowerSeries as MapSeriesType).bounds);
                    level.lowerSeries.isDrilling = true;
                }

                if (level.levelNumber === levelToRemove) {
                    level.levelSeries.forEach((series): void => {
                        if (!chart.mapView) {
                            // Not removed, not added as part of a multi-series
                            // drilldown
                            if (
                                series.options &&
                                series.options._levelNumber === levelToRemove
                            ) {
                                series.remove(false);
                            }
                        } else {
                            // Deal with asonchrynous removing of map series
                            // after zooming into
                            if (
                                series.options &&
                                series.options._levelNumber === levelToRemove &&
                                series.group
                            ) {
                                let animOptions: (
                                    boolean|Partial<AnimationOptions>|
                                    undefined
                                ) = {};

                                if (chart.options.drilldown) {
                                    animOptions =
                                        chart.options.drilldown.animation;
                                }

                                series.group.animate({
                                    opacity: 0
                                },
                                animOptions,
                                function (): void {
                                    series.remove(false);
                                    // If it is the last series
                                    if (
                                        !(level.levelSeries
                                            .filter((el): number =>
                                                Object.keys(el).length
                                            )
                                        ).length
                                    ) {
                                        // We have a reset zoom button. Hide it
                                        // and detatch it from the chart. It is
                                        // preserved to the layer config above.
                                        if (chart.resetZoomButton) {
                                            chart.resetZoomButton.hide();
                                            delete chart.resetZoomButton;
                                        }

                                        chart.pointer.reset();

                                        fireEvent(chart, 'afterDrilldown');

                                        if (chart.mapView) {
                                            chart.series
                                                .forEach((series): void => {
                                                    series.isDirtyData = true;
                                                    series.isDrilling = false;
                                                });
                                            chart.mapView
                                                .fitToBounds(void 0, void 0);
                                        }
                                        fireEvent(chart, 'afterApplyDrilldown');
                                    }
                                });
                            }
                        }
                    });
                }
            });
        }

        if (!chart.mapView) {
            // We have a reset zoom button. Hide it and detatch it from the
            // chart. It is preserved to the layer config above.
            if (chart.resetZoomButton) {
                chart.resetZoomButton.hide();
                delete chart.resetZoomButton;
            }

            chart.pointer.reset();

            fireEvent(chart, 'afterDrilldown');

            // Axes shouldn't be visible after drilling into non-cartesian
            // (#19725)
            if (!chart.hasCartesianSeries) {
                chart.axes.forEach((axis): void => {
                    axis.destroy(true);
                    axis.init(chart, merge(axis.userOptions, axis.options));
                });
            }

            chart.redraw();
            fireEvent(chart, 'afterApplyDrilldown');
        }
    }

    /**
     * When the chart is drilled down to a child series, calling
     * `chart.drillUp()` will drill up to the parent series.
     *
     * @requires  modules/drilldown
     *
     * @function Highcharts.Chart#drillUp
     *
     * @sample {highcharts} highcharts/drilldown/programmatic
     *         Programmatic drilldown
     */
    public drillUp(
        this: (this|Drilldown.ChartComposition),
        isMultipleDrillUp?: boolean
    ): void {
        const chart = (
            (this as this).chart ||
            (this as Drilldown.ChartComposition)
        );

        if (!chart.drilldownLevels || chart.drilldownLevels.length === 0) {
            return;
        }
        fireEvent(chart, 'beforeDrillUp');

        const drilldownLevels = chart.drilldownLevels as any,
            levelNumber =
                drilldownLevels[drilldownLevels.length - 1].levelNumber,
            chartSeries = chart.series,
            drilldownLevelsNumber = (chart.drilldownLevels as any).length,
            addSeries = function (
                seriesOptions: SeriesOptions,
                oldSeries: Series
            ): Series | undefined {
                let addedSeries;

                chartSeries.forEach((series): void => {
                    if (
                        series.options._ddSeriesId ===
                            seriesOptions._ddSeriesId
                    ) {
                        addedSeries = series;
                    }
                });

                addedSeries =
                    addedSeries || chart.addSeries(seriesOptions, false);
                if (
                    addedSeries.type === oldSeries.type &&
                    addedSeries.animateDrillupTo
                ) {
                    addedSeries.animate = addedSeries.animateDrillupTo;
                }

                if (seriesOptions === level.seriesPurgedOptions) {
                    return addedSeries;
                }
            },
            removeSeries = (oldSeries: Series): void => {
                oldSeries.remove(false);
                chart.series.forEach((series): void => {
                    // ensures to redraw series to get correct colors
                    if (series.colorAxis) {
                        series.isDirtyData = true;
                    }
                    series.options.inactiveOtherPoints = false;
                });
                chart.redraw();
            };

        let i = drilldownLevels.length,
            seriesI: number,
            level: Drilldown.LevelObject,
            oldExtremes: Record<string, (number|undefined)>;

        // Reset symbol and color counters after every drill-up. (#19134)
        chart.symbolCounter = chart.colorCounter = 0;

        while (i--) {

            let oldSeries: Series,
                newSeries: Series | undefined;

            level = drilldownLevels[i];
            if (level.levelNumber === levelNumber) {
                drilldownLevels.pop();

                // Get the lower series by reference or id
                oldSeries = level.lowerSeries;
                if (!oldSeries.chart) { // #2786
                    seriesI = chartSeries.length; // #2919
                    while (seriesI--) {
                        if (
                            chartSeries[seriesI].options.id ===
                                level.lowerSeriesOptions.id &&
                            chartSeries[seriesI].options._levelNumber ===
                                levelNumber + 1
                        ) { // #3867
                            oldSeries = chartSeries[seriesI];
                            break;
                        }
                    }
                }
                oldSeries.xData = []; // Overcome problems with minRange (#2898)

                // Reset the names to start new series from the beginning.
                // Do it once to preserve names when multiple
                // series are added for the same axis, #16135.
                if (
                    oldSeries.xAxis &&
                    oldSeries.xAxis.names &&
                    (drilldownLevelsNumber === 0 || i === drilldownLevelsNumber)
                ) {
                    oldSeries.xAxis.names.length = 0;
                }

                level.levelSeriesOptions.forEach((el): void => {
                    const addedSeries = addSeries(el, oldSeries);
                    if (addedSeries) {
                        newSeries = addedSeries;
                    }
                });

                fireEvent(chart, 'drillup', {
                    seriesOptions: level.seriesPurgedOptions ||
                        level.seriesOptions
                });

                if (newSeries) {
                    if (newSeries.type === oldSeries.type) {
                        newSeries.drilldownLevel = level;
                        newSeries.options.animation =
                            (chart.options.drilldown as any).animation;
                        // #2919
                        if (oldSeries.animateDrillupFrom && oldSeries.chart) {
                            oldSeries.animateDrillupFrom(level);
                        }
                    }
                    newSeries.options._levelNumber = levelNumber;
                }

                const seriesToRemove = oldSeries;
                // cannot access variable changed in loop
                if (!chart.mapView) {
                    seriesToRemove.remove(false);
                }

                // Reset the zoom level of the upper series
                if (newSeries && newSeries.xAxis) {
                    oldExtremes = level.oldExtremes;
                    newSeries.xAxis.setExtremes(
                        oldExtremes.xMin,
                        oldExtremes.xMax,
                        false
                    );
                    newSeries.yAxis.setExtremes(
                        oldExtremes.yMin,
                        oldExtremes.yMax,
                        false
                    );
                }

                // We have a resetZoomButton tucked away for this level. Attatch
                // it to the chart and show it.
                if (level.resetZoomButton) {
                    chart.resetZoomButton = level.resetZoomButton;
                }

                if (!chart.mapView) {
                    fireEvent(chart, 'afterDrillUp');
                    chart.redraw();
                    if (chart.ddDupes) {
                        chart.ddDupes.length = 0; // #3315
                    } // #8324
                    // Fire a once-off event after all series have been drilled
                    // up (#5158)
                    fireEvent(chart, 'drillupall');
                } else {
                    const shouldAnimate = level.levelNumber === levelNumber &&
                        isMultipleDrillUp,
                        zoomingDrill = chart.options.drilldown &&
                        chart.options.drilldown.animation &&
                        chart.options.drilldown.mapZooming;

                    if (shouldAnimate) {
                        oldSeries.remove(false);
                    } else {
                        // hide and disable dataLabels
                        if (oldSeries.dataLabelsGroup) {
                            oldSeries.dataLabelsGroup.destroy();
                            delete oldSeries.dataLabelsGroup;
                        }

                        if (chart.mapView && newSeries) {
                            if (zoomingDrill) {
                                // stop hovering while drilling down
                                oldSeries.isDrilling = true;
                                newSeries.isDrilling = true;
                                chart.redraw(false);
                                // Fit to previous bounds
                                chart.mapView.fitToBounds(
                                    (oldSeries as any).bounds,
                                    void 0,
                                    true,
                                    false
                                );
                            }

                            chart.mapView.allowTransformAnimation = true;

                            fireEvent(chart, 'afterDrillUp', {
                                seriesOptions:
                                    newSeries ? newSeries.userOptions : void 0
                            });

                            if (zoomingDrill) {
                                // Fit to natural bounds
                                chart.mapView.setView(void 0, 1, true, {
                                    complete: function (): void {
                                        // fire it only on complete in this
                                        // place (once)
                                        if (
                                            Object.prototype.hasOwnProperty
                                                .call(this, 'complete')
                                        ) {
                                            removeSeries(oldSeries);
                                        }
                                    }
                                });
                            } else {
                                // When user don't want to zoom into region only
                                // fade out
                                chart.mapView.allowTransformAnimation = false;
                                if (oldSeries.group) {
                                    oldSeries.group.animate({
                                        opacity: 0
                                    },
                                    (chart.options.drilldown as any).animation,
                                    function (): void {
                                        removeSeries(oldSeries);
                                        if (chart.mapView) {
                                            chart.mapView
                                                .allowTransformAnimation = true;
                                        }
                                    });
                                } else {
                                    removeSeries(oldSeries);
                                    chart.mapView
                                        .allowTransformAnimation = true;
                                }
                            }

                            newSeries.isDrilling = false;
                            if (chart.ddDupes) {
                                chart.ddDupes.length = 0; // #3315
                            } // #8324
                            // Fire a once-off event after all series have been
                            // drilled up (#5158)
                            fireEvent(chart, 'drillupall');
                        }
                    }
                }
            }
        }
    }

    /**
     * A function to fade in a group. First, the element is being hidden, then,
     * using `opactiy`, is faded in. Used for example by `dataLabelsGroup` where
     * simple SVGElement.fadeIn() is not enough, because of other features (e.g.
     * InactiveState) using `opacity` to fadeIn/fadeOut.
     *
     * @requires module:modules/drilldown
     *
     * @private
     * @param {SVGElement} [group]
     *        The SVG element to be faded in.
     */
    public fadeInGroup(
        group?: SVGElement
    ): void {
        const chart = this.chart,
            animationOptions = animObject(
                (chart.options.drilldown as any).animation
            );

        if (group) {
            group.hide();

            syncTimeout(
                (): void => {
                    // Make sure neither group nor chart were destroyed
                    if (group && group.added) {
                        group.fadeIn();
                    }
                },
                Math.max(animationOptions.duration - 50, 0)
            );
        }
    }

    /**
     * Update function to be called internally from Chart.update (#7600, #12855)
     * @private
     */
    public update(
        options: Partial<DrilldownOptions>,
        redraw?: boolean
    ): void {
        const chart = this.chart;

        merge(true, chart.options.drilldown, options);

        if (pick(redraw, true)) {
            chart.redraw();
        }
    }
}

/* *
 *
 *  Composition
 *
 * */

namespace Drilldown {

    /* *
     *
     *  Declarations
     *
     * */

    export declare class ChartComposition extends Chart {
        drilldown?: ChartAdditions;
    }

    export interface EventObject {
        category?: number;
        originalEvent?: Event;
        point: Point;
        points?: Array<(boolean|Point)>;
        preventDefault: Function;
        seriesOptions?: SeriesTypeOptions;
        target: Chart;
        type: 'drilldown';
    }

    export interface LevelObject {
        bBox: (BBoxObject|Record<string, undefined>);
        color?: ColorType;
        colorIndex?: number;
        levelNumber: number;
        levelSeries: Array<Series>;
        levelSeriesOptions: Array<SeriesOptions>;
        lowerSeries: Series;
        lowerSeriesOptions: SeriesOptions;
        oldExtremes: Record<string, (number|undefined)>;
        pointIndex: number;
        pointOptions: (PointOptions|PointShortOptions);
        seriesOptions: SeriesOptions;
        seriesPurgedOptions: SeriesOptions;
        shapeArgs?: SVGAttributes;
        resetZoomButton: SVGElement;
    }

    /* *
     *
     *  Constants
     *
     * */

    const composedMembers: Array<unknown> = [];

    /* *
     *
     *  Functions
     *
     * */

    /** @private */
    export function compose(
        ChartClass: typeof Chart,
        highchartsDefaultOptions: Options
    ): void {

        if (pushUnique(composedMembers, Breadcrumbs)) {
            Breadcrumbs.compose(ChartClass, highchartsDefaultOptions);

            addEvent(Breadcrumbs, 'up', onBreadcrumbsUp);
        }

        if (pushUnique(composedMembers, ChartClass)) {
            const DrilldownChart = ChartClass as typeof ChartComposition;
            const chartProto = DrilldownChart.prototype;
            const addonProto = ChartAdditions.prototype;

            chartProto.addSeriesAsDrilldown = addonProto.addSeriesAsDrilldown;
            chartProto.addSingleSeriesAsDrilldown =
                addonProto.addSingleSeriesAsDrilldown;
            chartProto.applyDrilldown = addonProto.applyDrilldown;
            chartProto.drillUp = addonProto.drillUp;

            addEvent(DrilldownChart, 'afterDrilldown', onChartAfterDrilldown);
            addEvent(DrilldownChart, 'afterDrillUp', onChartAfterDrillUp);
            addEvent(DrilldownChart, 'afterInit', onChartAfterInit);
            addEvent(DrilldownChart, 'drillup', onChartDrillup);
            addEvent(DrilldownChart, 'drillupall', onChartDrillupall);
            addEvent(DrilldownChart, 'render', onChartRender);
            addEvent(DrilldownChart, 'update', onChartUpdate);
        }

        if (pushUnique(composedMembers, ChartClass)) {
            const ChartCompoClass = ChartClass as typeof ChartComposition,
                addsProto = ChartAdditions.prototype,
                chartProto = ChartCompoClass.prototype;

            // chartProto.drillUp = addsProto.drillUp;

            addEvent(ChartCompoClass, 'afterDrilldown', onChartAfterDrilldown);
            addEvent(ChartCompoClass, 'afterDrillUp', onChartAfterDrillUp);
            addEvent(ChartCompoClass, 'afterInit', onChartAfterInit);
            addEvent(ChartCompoClass, 'drillup', onChartDrillup);
            addEvent(ChartCompoClass, 'drillupall', onChartDrillupall);
            addEvent(ChartCompoClass, 'render', onChartRender);
            addEvent(ChartCompoClass, 'update', onChartUpdate);
        }

        if (pushUnique(composedMembers, highchartsDefaultOptions)) {
            highchartsDefaultOptions.drilldown = DrilldownDefaults;
        }

    }

    /** @private */
    function onBreadcrumbsUp(
        this: Breadcrumbs,
        e: AnyRecord
    ): void {
        const chart = this.chart,
            drillUpsNumber = this.getLevel() - e.newLevel;

        let isMultipleDrillUp = drillUpsNumber > 1;

        for (let i = 0; i < drillUpsNumber; i++) {
            if (i === drillUpsNumber - 1) {
                isMultipleDrillUp = false;
            }
            chart.drillUp(isMultipleDrillUp);
        }

    }

    /** @private */
    function onChartAfterDrilldown(
        this: ChartComposition
    ): void {
        const chart = this,
            drilldownOptions = chart.options.drilldown,
            breadcrumbsOptions =
                drilldownOptions && drilldownOptions.breadcrumbs;

        if (!chart.breadcrumbs) {
            chart.breadcrumbs = new Breadcrumbs(chart, breadcrumbsOptions);
        }

        chart.breadcrumbs.updateProperties(createBreadcrumbsList(chart));

    }

    /** @private */
    function onChartAfterDrillUp(
        this: ChartComposition
    ): void {
        const chart = this;
        chart.breadcrumbs &&
            chart.breadcrumbs.updateProperties(createBreadcrumbsList(chart));
    }


    /**
     * Add update function to be called internally from Chart.update (#7600,
     * #12855)
     * @private
     */
    function onChartAfterInit(
        this: ChartComposition
    ): void {
        this.drilldown = new ChartAdditions(this);
    }

    /** @private */
    function onChartDrillup(
        this: ChartComposition
    ): void {
        const chart = this;

        if (chart.resetZoomButton) {
            chart.resetZoomButton = chart.resetZoomButton.destroy();
        }
    }

    /** @private */
    function onChartDrillupall(
        this: ChartComposition
    ): void {
        const chart = this;

        if (chart.resetZoomButton) {
            chart.showResetZoom();
        }
    }

    /** @private */
    function onChartRender(
        this: ChartComposition
    ): void {
        (this.xAxis || []).forEach((axis): void => {
            axis.ddPoints = {};
            axis.series.forEach((series): void => {
                const xData = series.xData || [],
                    points = series.points;

                for (let i = 0, iEnd = xData.length, p; i < iEnd; i++) {
                    p = (series.options.data as any)[i];

                    // The `drilldown` property can only be set on an array or an
                    // object
                    if (typeof p !== 'number') {

                        // Convert array to object (#8008)
                        p = series.pointClass.prototype.optionsToObject
                            .call({ series: series }, p);

                        if (p.drilldown) {
                            if (!(axis.ddPoints as any)[xData[i]]) {
                                (axis.ddPoints as any)[xData[i]] = [];
                            }

                            const index = i - (series.cropStart || 0);

                            (axis.ddPoints as any)[xData[i]].push(
                                points && index >= 0 && index < points.length ?
                                    points[index] :
                                    true
                            );
                        }
                    }
                }
            });

            // Add drillability to ticks, and always keep it drillability
            // updated (#3951)
            objectEach(axis.ticks, Tick.prototype.drillable);
        });
    }

    /** @private */
    function onChartUpdate(
        this: ChartComposition,
        e: { options: Options }
    ): void {
        const breadcrumbs = this.breadcrumbs,
            breadcrumbOptions =
                e.options.drilldown && e.options.drilldown.breadcrumbs;

        if (breadcrumbs && breadcrumbOptions) {
            breadcrumbs.update(breadcrumbOptions);
        }
    }

}

/**
 * A general fadeIn method.
 *
 * @requires module:modules/drilldown
 *
 * @function Highcharts.SVGElement#fadeIn
 *
 * @param {boolean|Partial<Highcharts.AnimationOptionsObject>} [animation]
 * The animation options for the element fade.
 */
SVGRenderer.prototype.Element.prototype.fadeIn = function (
    animation?: (boolean|Partial<AnimationOptions>)
): void {
    this
        .attr({
            opacity: 0.1,
            visibility: 'inherit'
        })
        .animate({
            opacity: pick(this.newOpacity, 1) // newOpacity used in maps
        }, animation || {
            duration: 250
        });
};

/**
 * When drilling up, keep the upper series invisible until the lower series has
 * moved into place.
 *
 * @private
 * @function Highcharts.ColumnSeries#animateDrillupTo
 * @param {boolean} [init=false]
 * Whether to initialize animation
 */
ColumnSeries.prototype.animateDrillupTo = function (init?: boolean): void {
    if (!init) {
        const newSeries = this,
            level = newSeries.drilldownLevel;

        // First hide all items before animating in again
        this.points.forEach(function (point: Point): void {
            const dataLabel = point.dataLabel;

            if (point.graphic) { // #3407
                point.graphic.hide();
            }

            if (dataLabel) {
                // The data label is initially hidden, make sure it is not faded
                // in (#6127)
                dataLabel.hidden = dataLabel.attr('visibility') === 'hidden';

                if (!dataLabel.hidden) {
                    dataLabel.hide();
                    dataLabel.connector?.hide();
                }
            }
        });


        // Do dummy animation on first point to get to complete
        syncTimeout(function (): void {
            if (newSeries.points) { // May be destroyed in the meantime, #3389
                // Unable to drillup with nodes, #13711
                let pointsWithNodes: Array<any> = [];
                newSeries.data.forEach(function (el): void {
                    pointsWithNodes.push(el);
                });
                if (newSeries.nodes) {
                    pointsWithNodes = pointsWithNodes.concat(newSeries.nodes);
                }
                pointsWithNodes.forEach(function (
                    point: Point,
                    i: number
                ): void {
                    // Fade in other points
                    const verb =
                        i === (level && level.pointIndex) ? 'show' : 'fadeIn',
                        inherit = verb === 'show' ? true : void 0,
                        dataLabel = point.dataLabel;


                    if (
                        point.graphic && // #3407
                        point.visible // Don't show if invisible (#18303)
                    ) {
                        point.graphic[verb](inherit);
                    }

                    if (dataLabel && !dataLabel.hidden) { // #6127
                        dataLabel.fadeIn(); // #7384
                        dataLabel.connector?.fadeIn();
                    }
                });
            }
        }, Math.max(
            (this.chart.options.drilldown as any).animation.duration - 50, 0
        ));

        // Reset to prototype
        delete (this as AnyRecord).animate;
    }

};

ColumnSeries.prototype.animateDrilldown = function (init?: boolean): void {
    const series = this,
        chart = this.chart as Drilldown.ChartComposition;

    let drilldownLevels = chart.drilldownLevels,
        animateFrom: (SVGAttributes|undefined),
        animationOptions =
            animObject((chart.options.drilldown as any).animation),
        xAxis = this.xAxis,
        styledMode = chart.styledMode;

    if (!init) {
        (drilldownLevels as any).forEach(function (
            level: Drilldown.LevelObject
        ): void {
            if (
                series.options._ddSeriesId ===
                    level.lowerSeriesOptions._ddSeriesId
            ) {
                animateFrom = level.shapeArgs;
                if (!styledMode) {
                    // Add the point colors to animate from
                    (animateFrom as any).fill = level.color;
                }
            }
        });

        (animateFrom as any).x += pick(xAxis.oldPos, xAxis.pos) - xAxis.pos;

        this.points.forEach(function (point: Point): void {
            const animateTo = point.shapeArgs;

            if (!styledMode) {
                // Add the point colors to animate to
                (animateTo as any).fill = point.color;
            }

            if (point.graphic) {
                point.graphic
                    .attr(animateFrom)
                    .animate(
                        extend(
                            point.shapeArgs,
                            { fill: point.color || series.color }
                        ),
                        animationOptions
                    );
            }
        });

        if (chart.drilldown) {
            chart.drilldown.fadeInGroup(this.dataLabelsGroup);
        }

        // Reset to prototype
        delete (this as AnyRecord).animate;
    }

};

/**
 * When drilling up, pull out the individual point graphics from the lower
 * series and animate them into the origin point in the upper series.
 *
 * @private
 * @function Highcharts.ColumnSeries#animateDrillupFrom
 * @param {Highcharts.DrilldownLevelObject} level
 *        Level container
 * @return {void}
 */
ColumnSeries.prototype.animateDrillupFrom = function (
    level: Drilldown.LevelObject
): void {
    let animationOptions =
            animObject((this.chart.options.drilldown as any).animation),
        group: (SVGElement|undefined) = this.group,
        // For 3d column series all columns are added to one group
        // so we should not delete the whole group. #5297
        removeGroup = group !== this.chart.columnGroup,
        series = this;

    // Cancel mouse events on the series group (#2787)
    (series.trackerGroups as any).forEach(function (key: string): void {
        if ((series as any)[key]) { // we don't always have dataLabelsGroup
            (series as any)[key].on('mouseover');
        }
    });

    if (removeGroup) {
        delete (this as any).group;
    }

    this.points.forEach(function (point: Point): void {
        const graphic = point.graphic,
            animateTo = level.shapeArgs,
            complete = function (): void {
                (graphic as any).destroy();
                if (group && removeGroup) {
                    group = group.destroy();
                }
            };

        if (graphic && animateTo) {

            delete point.graphic;

            if (!series.chart.styledMode) {
                (animateTo as any).fill = level.color;
            }

            if (animationOptions.duration) {
                graphic.animate(
                    animateTo as any,
                    merge(animationOptions, { complete: complete })
                );
            } else {
                graphic.attr(animateTo);
                complete();
            }
        }
    });
};

if (PieSeries) {
    extend(PieSeries.prototype, {
        animateDrillupTo: ColumnSeries.prototype.animateDrillupTo,
        animateDrillupFrom: ColumnSeries.prototype.animateDrillupFrom,

        animateDrilldown: function (
            this: typeof PieSeries.prototype,
            init?: boolean
        ): void {
            const series = this,
                chart = series.chart as Drilldown.ChartComposition,
                level: Drilldown.LevelObject =
                    (chart.drilldownLevels as any)[
                        (chart.drilldownLevels as any).length - 1
                    ],
                animationOptions =
                    (chart.options.drilldown as any).animation;

            if (series.is('item')) {
                animationOptions.duration = 0;
            }
            // Unable to drill down in the horizontal item series #13372
            if (series.center) {
                const animateFrom = level.shapeArgs,
                    start = (animateFrom as any).start,
                    angle = (animateFrom as any).end - start,
                    startAngle = angle / this.points.length,
                    styledMode = chart.styledMode;

                if (!init) {
                    this.points.forEach(function (point, i): void {
                        const animateTo = point.shapeArgs;

                        if (!styledMode) {
                            (animateFrom as any).fill = level.color;
                            (animateTo as any).fill = point.color;
                        }

                        if (point.graphic) {
                            point.graphic
                                .attr(merge(animateFrom, {
                                    start: start + i * startAngle,
                                    end: start + (i + 1) * startAngle
                                }))[animationOptions ? 'animate' : 'attr'](
                                    (animateTo as any),
                                    animationOptions
                                );
                        }
                    });

                    if (chart.drilldown) {
                        chart.drilldown.fadeInGroup(series.dataLabelsGroup);
                    }

                    // Reset to prototype
                    delete (series as Partial<typeof series>).animate;
                }
            }
        }
    });
}

if (MapSeries) {
    extend(MapSeries.prototype, {
        /**
         * Animate in the new series.
         * @private
         */
        animateDrilldown(init?: boolean): void {
            const series = this,
                chart = series.chart as Drilldown.ChartComposition,
                group = series.group;

            if (
                chart &&
                group &&
                series.options &&
                chart.options.drilldown &&
                chart.options.drilldown.animation
            ) {
                // Initialize the animation
                if (init && chart.mapView) {
                    group.attr({
                        opacity: 0.01
                    });
                    chart.mapView.allowTransformAnimation = false;
                    // Stop duplicating and overriding animations
                    series.options.inactiveOtherPoints = true;
                    series.options.enableMouseTracking = false;

                // Run the animation
                } else {
                    group.animate({
                        opacity: 1
                    },
                    chart.options.drilldown.animation,
                    function (): void {
                        if (series.options) {
                            series.options.inactiveOtherPoints = false;
                            series.options.enableMouseTracking =
                                pick(
                                    (
                                        series.userOptions &&
                                        series.userOptions.enableMouseTracking
                                    ),
                                    true
                                );
                            series.isDirty = true;
                            chart.redraw();
                        }
                    });

                    if (chart.drilldown) {
                        chart.drilldown.fadeInGroup(this.dataLabelsGroup);
                    }
                }
            }
        },

        /**
         * When drilling up, pull out the individual point graphics from the
         * lower series and animate them into the origin point in the upper
         * series.
         * @private
         */
        animateDrillupFrom(): void {
            const series = this,
                chart = series.chart as Drilldown.ChartComposition;

            if (chart && chart.mapView) {
                chart.mapView.allowTransformAnimation = false;
            }
            // stop duplicating and overriding animations
            if (series.options) {
                series.options.inactiveOtherPoints = true;
            }
        },

        /**
         * When drilling up, keep the upper series invisible until the lower
         * series has moved into place.
         * @private
         */
        animateDrillupTo(init?: boolean): void {
            const series = this,
                chart = series.chart as Drilldown.ChartComposition,
                group = series.group;

            if (chart && group) {

                // Initialize the animation
                if (init) {
                    group.attr({
                        opacity: 0.01
                    });
                    // stop duplicating and overriding animations
                    if (series.options) {
                        series.options.inactiveOtherPoints = true;
                    }
                // Run the animation
                } else {
                    group.animate({
                        opacity: 1
                    }, (chart.options.drilldown as any).animation);

                    if (chart.drilldown) {
                        chart.drilldown.fadeInGroup(this.dataLabelsGroup);
                    }
                }
            }
        }
    });
}

/**
 * Perform drilldown on a point instance. The [drilldown](https://api.highcharts.com/highcharts/series.line.data.drilldown)
 * property must be set on the point options.
 *
 * To drill down multiple points in the same category, use
 * `Axis.drilldownCategory` instead.
 *
 * @requires  modules/drilldown
 *
 * @function Highcharts.Point#doDrilldown
 *
 * @sample {highcharts} highcharts/drilldown/programmatic
 *         Programmatic drilldown
 */
Point.prototype.doDrilldown = function (): void {
    this.runDrilldown();
};

Point.prototype.runDrilldown = function (
    holdRedraw: (boolean|undefined),
    category: (number|undefined),
    originalEvent: Event|undefined
): void {

    const series = this.series,
        chart = series.chart,
        drilldown = chart.options.drilldown;

    let i: number = ((drilldown as any).series || []).length,
        seriesOptions: (SeriesOptions|undefined);

    if (!chart.ddDupes) {
        chart.ddDupes = [];
    }

    // Reset the color and symbol counters after every drilldown. (#19134)
    chart.colorCounter = chart.symbolCounter = 0;

    while (i-- && !seriesOptions) {
        if (
            (drilldown as any).series[i].id === this.drilldown &&
            chart.ddDupes.indexOf(this.drilldown as any) === -1
        ) {
            seriesOptions = (drilldown as any).series[i];
            chart.ddDupes.push(this.drilldown as any);
        }
    }

    // Fire the event. If seriesOptions is undefined, the implementer can check
    // for  seriesOptions, and call addSeriesAsDrilldown async if necessary.
    fireEvent(chart, 'drilldown', {
        point: this,
        seriesOptions: seriesOptions,
        category: category,
        originalEvent: originalEvent,
        points: (
            typeof category !== 'undefined' &&
            this.series.xAxis.getDDPoints(category).slice(0)
        )
    } as Drilldown.EventObject, (e: Drilldown.EventObject): void => {
        const chart = e.point.series && e.point.series.chart,
            seriesOptions = e.seriesOptions;

        if (chart && seriesOptions) {
            if (holdRedraw) {
                chart.addSingleSeriesAsDrilldown(e.point, seriesOptions);
            } else {
                chart.addSeriesAsDrilldown(e.point, seriesOptions);
            }
        }
    });
};

/**
 * Drill down to a given category. This is the same as clicking on an axis
 * label. If multiple series with drilldown are present, all will drill down to
 * the given category.
 *
 * See also `Point.doDrilldown` for drilling down on a single point instance.
 *
 * @function Highcharts.Axis#drilldownCategory
 *
 * @sample {highcharts} highcharts/drilldown/programmatic
 *         Programmatic drilldown
 *
 * @param {number} x
 *        The index of the category
 * @param {global.MouseEvent} [originalEvent]
 *        The original event, used internally.
 */
Axis.prototype.drilldownCategory = function (
    x: number,
    originalEvent?: MouseEvent
): void {
    this.getDDPoints(x).forEach(function (point): void {
        if (
            point &&
            point.series &&
            point.series.visible &&
            point.runDrilldown
        ) { // #3197
            point.runDrilldown(true, x, originalEvent);
        }
    });
    this.chart.applyDrilldown();
};

/**
 * Return drillable points for this specific X value.
 *
 * @private
 * @function Highcharts.Axis#getDDPoints
 * @param {number} x
 *        Tick position
 * @return {Array<(false|Highcharts.Point)>}
 *         Drillable points
 */
Axis.prototype.getDDPoints = function (
    x: number
): Array<(false|Point)> {
    return (this.ddPoints && this.ddPoints[x] || []);
};


/**
 * Make a tick label drillable, or remove drilling on update.
 *
 * @private
 * @function Highcharts.Axis#drillable
 */
Tick.prototype.drillable = function (): void {
    const pos = this.pos,
        label = this.label,
        axis = this.axis,
        isDrillable = axis.coll === 'xAxis' && axis.getDDPoints,
        ddPointsX = isDrillable && axis.getDDPoints(pos),
        styledMode = axis.chart.styledMode;

    if (isDrillable) {
        if (label && ddPointsX && ddPointsX.length) {
            label.drillable = true;

            if (!label.basicStyles && !styledMode) {
                label.basicStyles = merge(label.styles);
            }

            label.addClass('highcharts-drilldown-axis-label');

            // #12656 - avoid duplicate of attach event
            if (label.removeOnDrillableClick) {
                removeEvent(label.element, 'click');
            }

            label.removeOnDrillableClick = addEvent(
                label.element,
                'click',
                function (e: MouseEvent): void {
                    e.preventDefault();
                    axis.drilldownCategory(pos, e);
                }
            );

            if (!styledMode) {
                label.css(
                    (axis.chart.options.drilldown as any).activeAxisLabelStyle
                );
            }

        } else if (label && label.drillable && label.removeOnDrillableClick) {
            if (!styledMode) {
                label.styles = {}; // reset for full overwrite of styles
                label.element.removeAttribute('style'); // #17933
                label.css(label.basicStyles);
            }

            label.removeOnDrillableClick(); // #3806
            label.removeClass('highcharts-drilldown-axis-label');
        }
    }
};


// On initialization of each point, identify its label and make it clickable.
// Also, provide a list of points associated to that label.
addEvent(Point, 'afterInit', function (): Point {
    const point = this;

    if (point.drilldown && !point.unbindDrilldownClick) {
        // Add the click event to the point
        point.unbindDrilldownClick = addEvent(point, 'click', onPointClick);
    }

    return point;
});

addEvent(Point, 'update', function (e: { options: Options }): void {
    const point = this,
        options = e.options || {};

    if (options.drilldown && !point.unbindDrilldownClick) {
        // Add the click event to the point
        point.unbindDrilldownClick = addEvent(point, 'click', onPointClick);
    } else if (
        !options.drilldown &&
        options.drilldown !== void 0 &&
        point.unbindDrilldownClick
    ) {
        point.unbindDrilldownClick = point.unbindDrilldownClick();
    }
});

addEvent(Series, 'afterDrawDataLabels', function (): void {
    const css = (this.chart.options.drilldown as any).activeDataLabelStyle,
        renderer = this.chart.renderer,
        styledMode = this.chart.styledMode;

    this.points.forEach(function (point: Point): void {
        const dataLabelsOptions = point.options.dataLabels,
            pointCSS = pick(
                point.dlOptions as any,
                dataLabelsOptions && (dataLabelsOptions as any).style,
                {}
            ) as CSSObject;

        if (point.drilldown && point.dataLabel) {

            if (css.color === 'contrast' && !styledMode) {
                pointCSS.color = renderer.getContrast(
                    (point.color as any) || (this.color as any)
                );
            }

            if (dataLabelsOptions && (dataLabelsOptions as any).color) {
                pointCSS.color = (dataLabelsOptions as any).color;
            }
            point.dataLabel
                .addClass('highcharts-drilldown-data-label');

            if (!styledMode) {
                point.dataLabel
                    .css(css)
                    .css(pointCSS);
            }
        }
    }, this);
});

// Mark the trackers with a pointer
addEvent(Series, 'afterDrawTracker', function (): void {
    const styledMode = this.chart.styledMode;

    this.points.forEach(function (point): void {
        if (point.drilldown && point.graphic) {
            applyCursorCSS(point.graphic, 'pointer', true, styledMode);
        }
    });
});

addEvent(Point, 'afterSetState', function (): void {
    const styledMode = this.series.chart.styledMode;

    if (this.drilldown && this.series.halo && this.state === 'hover') {
        applyCursorCSS(this.series.halo, 'pointer', true, styledMode);
    } else if (this.series.halo) {
        applyCursorCSS(this.series.halo, 'auto', false, styledMode);
    }
});

/* *
 *
 *  Default Export
 *
 * */

export default Drilldown;

/* *
 *
 *  API Declarations
 *
 * */

/**
 * Gets fired when a drilldown point is clicked, before the new series is added.
 * Note that when clicking a category label to trigger multiple series
 * drilldown, one `drilldown` event is triggered per point in the category.
 *
 * @callback Highcharts.DrilldownCallbackFunction
 *
 * @param {Highcharts.Chart} this
 *        The chart where the event occurs.
 *
 * @param {Highcharts.DrilldownEventObject} e
 *        The drilldown event.
 */

/**
 * The event arguments when a drilldown point is clicked.
 *
 * @interface Highcharts.DrilldownEventObject
 *//**
 * If a category label was clicked, which index.
 * @name Highcharts.DrilldownEventObject#category
 * @type {number|undefined}
 *//**
 * The original browser event (usually click) that triggered the drilldown.
 * @name Highcharts.DrilldownEventObject#originalEvent
 * @type {global.Event|undefined}
 *//**
 * Prevents the default behaviour of the event.
 * @name Highcharts.DrilldownEventObject#preventDefault
 * @type {Function}
 *//**
 * The originating point.
 * @name Highcharts.DrilldownEventObject#point
 * @type {Highcharts.Point}
 *//**
 * If a category label was clicked, this array holds all points corresponding to
 * the category. Otherwise it is set to false.
 * @name Highcharts.DrilldownEventObject#points
 * @type {boolean|Array<Highcharts.Point>|undefined}
 *//**
 * Options for the new series. If the event is utilized for async drilldown, the
 * seriesOptions are not added, but rather loaded async.
 * @name Highcharts.DrilldownEventObject#seriesOptions
 * @type {Highcharts.SeriesOptionsType|undefined}
 *//**
 * The event target.
 * @name Highcharts.DrilldownEventObject#target
 * @type {Highcharts.Chart}
 *//**
 * The event type.
 * @name Highcharts.DrilldownEventObject#type
 * @type {"drilldown"}
 */

/**
 * This gets fired after all the series have been drilled up. This is especially
 * usefull in a chart with multiple drilldown series.
 *
 * @callback Highcharts.DrillupAllCallbackFunction
 *
 * @param {Highcharts.Chart} this
 *        The chart where the event occurs.
 *
 * @param {Highcharts.DrillupAllEventObject} e
 *        The final drillup event.
 */

/**
 * The event arguments when all the series have been drilled up.
 *
 * @interface Highcharts.DrillupAllEventObject
 *//**
 * Prevents the default behaviour of the event.
 * @name Highcharts.DrillupAllEventObject#preventDefault
 * @type {Function}
 *//**
 * The event target.
 * @name Highcharts.DrillupAllEventObject#target
 * @type {Highcharts.Chart}
 *//**
 * The event type.
 * @name Highcharts.DrillupAllEventObject#type
 * @type {"drillupall"}
 */

/**
 * Gets fired when drilling up from a drilldown series.
 *
 * @callback Highcharts.DrillupCallbackFunction
 *
 * @param {Highcharts.Chart} this
 *        The chart where the event occurs.
 *
 * @param {Highcharts.DrillupEventObject} e
 *        The drillup event.
 */

/**
 * The event arguments when drilling up from a drilldown series.
 *
 * @interface Highcharts.DrillupEventObject
 *//**
 * Prevents the default behaviour of the event.
 * @name Highcharts.DrillupEventObject#preventDefault
 * @type {Function}
 *//**
 * Options for the new series.
 * @name Highcharts.DrillupEventObject#seriesOptions
 * @type {Highcharts.SeriesOptionsType|undefined}
 *//**
 * The event target.
 * @name Highcharts.DrillupEventObject#target
 * @type {Highcharts.Chart}
 *//**
 * The event type.
 * @name Highcharts.DrillupEventObject#type
 * @type {"drillup"}
 */

''; // keeps doclets above in JS file
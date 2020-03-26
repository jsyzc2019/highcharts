/* *
 *
 *  (c) 2010-2020 Torstein Honsi
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

'use strict';

import Axis from './Axis.js';
import U from './Utilities.js';
const {
    addEvent,
    getMagnitude,
    normalizeTickInterval,
    pick
} = U;

/**
 * Internal types
 * @private
 */
declare global {
    namespace Highcharts {
        interface Axis {
            /** @deprecated */
            lin2log(num: number): number;
            /** @deprecated */
            log2lin(num: number): number;
        }
    }
}

/* eslint-disable valid-jsdoc */

/**
 * Provides logarithmic support for axes.
 *
 * @private
 * @class
 */
class LogarithmicAxisAdditions {

    /* *
     *
     *  Constructors
     *
     * */

    public constructor(axis: LogarithmicAxis) {
        this.axis = axis;
    }

    /* *
     *
     *  Properties
     *
     * */

    public axis: LogarithmicAxis;
    public minorAutoInterval?: number;

    /* *
     *
     *  Functions
     *
     * */

    public destroy(): void {
        this.axis = void 0 as any;
        this.minorAutoInterval = void 0;
    }

    /**
     * Set the tick positions of a logarithmic axis.
     */
    public getLogTickPositions(
        interval: number,
        min: number,
        max: number,
        minor?: boolean
    ): Array<number> {
        const log = this;
        const axis = log.axis;
        const axisLength = axis.len;
        const options = axis.options;

        // Since we use this method for both major and minor ticks,
        // use a local variable and return the result
        let positions = [];

        // Reset
        if (!minor) {
            log.minorAutoInterval = void 0;
        }

        // First case: All ticks fall on whole logarithms: 1, 10, 100 etc.
        if (interval >= 0.5) {
            interval = Math.round(interval);
            positions = axis.getLinearTickPositions(interval, min, max);

        // Second case: We need intermediary ticks. For example
        // 1, 2, 4, 6, 8, 10, 20, 40 etc.
        } else if (interval >= 0.08) {
            var roundedMin = Math.floor(min),
                intermediate,
                i,
                j,
                len,
                pos,
                lastPos,
                break2;

            if (interval > 0.3) {
                intermediate = [1, 2, 4];

            // 0.2 equals five minor ticks per 1, 10, 100 etc
            } else if (interval > 0.15) {
                intermediate = [1, 2, 4, 6, 8];
            } else { // 0.1 equals ten minor ticks per 1, 10, 100 etc
                intermediate = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            }

            for (i = roundedMin; i < max + 1 && !break2; i++) {
                len = intermediate.length;
                for (j = 0; j < len && !break2; j++) {
                    pos = axis.log2lin(axis.lin2log(i) * intermediate[j]);
                    // #1670, lastPos is #3113
                    if (
                        pos > min &&
                        (!minor || (lastPos as any) <= max) &&
                        typeof lastPos !== 'undefined'
                    ) {
                        positions.push(lastPos);
                    }

                    if ((lastPos as any) > max) {
                        break2 = true;
                    }
                    lastPos = pos;
                }
            }

        // Third case: We are so deep in between whole logarithmic values that
        // we might as well handle the tick positions like a linear axis. For
        // example 1.01, 1.02, 1.03, 1.04.
        } else {
            var realMin = axis.lin2log(min),
                realMax = axis.lin2log(max),
                tickIntervalOption = minor ?
                    axis.getMinorTickInterval() :
                    options.tickInterval,
                filteredTickIntervalOption = tickIntervalOption === 'auto' ?
                    null :
                    tickIntervalOption,
                tickPixelIntervalOption =
                    (options.tickPixelInterval as any) / (minor ? 5 : 1),
                totalPixelLength = minor ?
                    axisLength / axis.tickPositions.length :
                    axisLength;

            interval = pick(
                filteredTickIntervalOption,
                log.minorAutoInterval,
                (realMax - realMin) *
                    tickPixelIntervalOption / (totalPixelLength || 1)
            );

            interval = normalizeTickInterval(
                interval,
                void 0,
                getMagnitude(interval)
            );

            positions = axis.getLinearTickPositions(
                interval,
                realMin,
                realMax
            ).map(axis.log2lin);

            if (!minor) {
                log.minorAutoInterval = interval / 5;
            }
        }

        // Set the axis-level tickInterval variable
        if (!minor) {
            axis.tickInterval = interval;
        }
        return positions;
    }

    public lin2log(num: number): number {
        const axis = this.axis;
        const lin2log = axis.options.linearToLogConverter;

        if (typeof lin2log === 'function') {
            return lin2log.apply(axis, arguments);
        }

        return Math.pow(10, num);
    }

    public log2lin(num: number): number {
        return Math.log(num) / Math.LN10;
    }

}

class LogarithmicAxis {

    /**
     * Provides logarithmic support for axes.
     *
     * @private
     */
    public static compose(AxisClass: typeof Axis): void {

        const axisProto = AxisClass.prototype as LogarithmicAxis;

        /**
         * @deprecated
         * @private
         * @function Highcharts.Axis#lin2log
         *
         * @param {number} num
         *
         * @return {number}
         */
        axisProto.lin2log = function (this: Highcharts.Axis, num: number): number {
            const axis = this;
            const lin2log = axis.options.linearToLogConverter;

            if (typeof lin2log === 'function') {
                return lin2log.apply(axis, arguments);
            }

            return Math.pow(10, num);
        };

        /**
         * @deprecated
         * @private
         * @function Highcharts.Axis#log2lin
         *
         * @param {number} num
         *
         * @return {number}
         */
        axisProto.log2lin = function (this: Highcharts.Axis, num: number): number {
            return Math.log(num) / Math.LN10;
        };

        /* eslint-disable no-invalid-this */

        addEvent(AxisClass, 'init', function (e: { userOptions: Axis['options'] }): void {
            const axis = this;
            const options = e.userOptions;

            if (options.type === 'logarithmic') {
                axis.logarithmic = new LogarithmicAxisAdditions(axis as LogarithmicAxis);
            } else if (axis.logarithmic) {
                axis.logarithmic.destroy();
                axis.logarithmic = void 0;
            }
        });

        addEvent(AxisClass, 'afterInit', function (): void {
            const axis = this as LogarithmicAxis;
            // extend logarithmic axis
            if (axis.logarithmic) {
                axis.val2lin = axis.log2lin;
                axis.lin2val = axis.lin2log;
            }
        });
    }
}

interface LogarithmicAxis extends Axis {
    logarithmic: LogarithmicAxisAdditions;
    /** @deprecated */
    lin2log(num: number): number;
    /** @deprecated */
    log2lin(num: number): number;
}

LogarithmicAxis.compose(Axis); // @todo move to factory functions

export default LogarithmicAxis;

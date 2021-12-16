/* *
 *
 *  Organization chart module
 *
 *  (c) 2018-2021 Torstein Honsi
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

/* *
 *
 *  Imports
 *
 * */

import type ColorString from '../../Core/Color/ColorString';
import type OrganizationDataLabelOptions from './OrganizationDataLabelOptions';
import type OrganizationSeries from './OrganizationSeries';
import type {
    SankeySeriesLevelOptions,
    SankeySeriesNodeOptions,
    SankeySeriesOptions
} from '../Sankey/SankeySeriesOptions';
import type { SeriesStatesOptions } from '../../Core/Series/SeriesOptions';

/* *
 *
 *  Declarations
 *
 * */

export type OrganizationNodesLayoutValue = ('normal'|'hanging');

export interface LinkOptions {
    color?: ColorString;
    lineWidth?: number;
    radius: number;
}
export interface OrganizationSeriesLevelOptions extends SankeySeriesLevelOptions {
    borderRadius?: number;
    linkColor?: ColorString;
    linkLineWidth?: number;
    link?: LinkOptions;
    states: SeriesStatesOptions<OrganizationSeries>;
}

export interface OrganizationSeriesNodeOptions extends SankeySeriesNodeOptions {
    description?: string;
    image?: string;
    layout?: OrganizationNodesLayoutValue;
    title?: string;
}

export interface OrganizationSeriesOptions extends SankeySeriesOptions {
    dataLabels?: OrganizationDataLabelOptions;
    hangingIndent?: number;
    levels?: Array<OrganizationSeriesLevelOptions>;
    link?: LinkOptions;
    linkColor?: ColorString;
    linkLineWidth?: number;
    linkRadius?: number;
    nodes?: Array<OrganizationSeriesNodeOptions>;
    states?: SeriesStatesOptions<OrganizationSeries>;
}

declare module '../Sankey/SankeySeriesOptions' {
    interface SankeySeriesOptions {
        /** @requires OrganizationSeries */
        linkColor?: OrganizationSeriesOptions['linkColor'];
        /** @requires OrganizationSeries */
        linkLineWidth?: OrganizationSeriesOptions['linkLineWidth'];
        /** @requires OrganizationSeries */
        link?: OrganizationSeriesOptions['link'];
    }
}

export default OrganizationSeriesOptions;

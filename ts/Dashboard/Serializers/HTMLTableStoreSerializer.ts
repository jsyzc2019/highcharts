/* *
 *
 *  (c) 2020 - 2021 Highsoft AS
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 *  Authors:
 *  - Sophie Bremer
 *
 * */

'use strict';

/* *
 *
 *  Imports
 *
 * */

import type DataParser from '../../Data/Parsers/DataParser';
import type DataStore from '../../Data/Stores/DataStore';
import type Serializable from '../Serializable';

import DataTableSerializer from './DataTableSerializer.js';
import HTMLTableStore from '../../Data/Stores/HTMLTableStore.js';
import U from '../../Core/Utilities.js';
const { merge } = U;

/* *
 *
 *  Constants
 *
 * */

const HTMLTableStoreSerializer: Serializable<HTMLTableStore, HTMLTableStoreSerializer.JSON> = {
    fromJSON,
    jsonSupportFor,
    toJSON
};

/* *
 *
 *  Functions
 *
 * */

/**
 * Converts the given JSON to a class instance.
 *
 * @param {HTMLTableStoreSerializer.JSON} json
 * JSON to deserialize as a class instance or object.
 *
 * @return {HTMLTableStore}
 * Returns the class instance or object, or throws an exception.
 */
function fromJSON(
    json: HTMLTableStoreSerializer.JSON
): HTMLTableStore {
    const table = DataTableSerializer.fromJSON(json.table),
        store = new HTMLTableStore(table, json.options);

    merge(true, store.metadata, json.metadata);

    return store;
}

/**
 * Validates the given class instance for JSON support.
 *
 * @param {AnyRecord} obj
 * Class instance or object to validate.
 *
 * @return {boolean}
 * Returns true, if the function set can convert the given object, otherwise
 * false.
 */
function jsonSupportFor(
    obj: AnyRecord
): obj is HTMLTableStore {
    return obj instanceof HTMLTableStore;
}

/**
 * Converts the given class instance to JSON.
 *
 * @param {HTMLTableStore} obj
 * Class instance or object to serialize as JSON.
 *
 * @return {HTMLTableStoreSerializer.JSON}
 * Returns the JSON of the class instance or object.
 */
function toJSON(
    obj?: HTMLTableStore
): HTMLTableStoreSerializer.JSON {
    const json: HTMLTableStoreSerializer.JSON = {
        $class: 'Data.HTMLTableStore',
        metadata: obj && obj.metadata,
        table: DataTableSerializer.toJSON(obj && obj.table)
    };

    if (obj) {
        const jsonOptions: HTMLTableStoreSerializer.OptionsJSON = json.options = {},
            options = obj.options;

        jsonOptions.endColumn = options.endColumn;
        jsonOptions.endRow = options.endRow;
        jsonOptions.firstRowAsNames = options.firstRowAsNames;
        jsonOptions.startColumn = options.startColumn;
        jsonOptions.startRow = options.startRow;
        jsonOptions.switchRowsAndColumns = options.switchRowsAndColumns;

        if (typeof options.table === 'string') {
            jsonOptions.table = options.table;
        } else {
            jsonOptions.table = options.table.id;
        }
    }

    return json;
}

/* *
 *
 *  Namespace
 *
 * */

namespace HTMLTableStoreSerializer {

    /* *
     *
     *  Declarations
     *
     * */

    export interface JSON extends Serializable.JSON<'Data.HTMLTableStore'> {
        metadata?: DataStore.Metadata;
        options?: OptionsJSON;
        table: DataTableSerializer.JSON;
    }

    export interface OptionsJSON extends Partial<DataParser.Options> {
        table?: string;
    }

}

/* *
 *
 *  Default Export
 *
 * */

export default HTMLTableStoreSerializer;

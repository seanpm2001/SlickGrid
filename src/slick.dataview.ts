import type {
  Aggregator,
  CssStyleHash,
  Grouping,
  GroupingComparerItem,
  GroupingFormatterItem,
  GroupingGetterFunction,
  OnGroupCollapsedEventArgs,
  OnGroupExpandedEventArgs,
  OnRowCountChangedEventArgs,
  OnRowsChangedEventArgs,
  OnRowsOrCountChangedEventArgs,
  OnSelectedRowIdsChangedEventArgs,
  OnSetItemsCalledEventArgs,
  PagingInfo,
  SortDirectionNumber
} from './models/index';
import {
  SlickEvent as SlickEvent_,
  SlickEventData as SlickEventData_,
  SlickGroup as SlickGroup_,
  SlickGroupTotals as SlickGroupTotals_,
  Utils as Utils_,
  SlickNonDataItem,
} from './slick.core';
import type { SlickGrid } from './slick.grid';
import { SlickGroupItemMetadataProvider as SlickGroupItemMetadataProvider_ } from './slick.groupitemmetadataprovider';

// for (iife) load Slick methods from global Slick object, or use imports for (cjs/esm)
const SlickEvent = IIFE_ONLY ? Slick.Event : SlickEvent_;
const SlickEventData = IIFE_ONLY ? Slick.EventData : SlickEventData_;
const SlickGroup = IIFE_ONLY ? Slick.Group : SlickGroup_;
const SlickGroupTotals = IIFE_ONLY ? Slick.GroupTotals : SlickGroupTotals_;
const Utils = IIFE_ONLY ? Slick.Utils : Utils_;
const SlickGroupItemMetadataProvider = IIFE_ONLY ? Slick.Data?.GroupItemMetadataProvider ?? {} : SlickGroupItemMetadataProvider_;

export interface DataViewOption {
  groupItemMetadataProvider?: SlickGroupItemMetadataProvider_;
  inlineFilters?: boolean;
}

/**
   * A sample Model implementation.
   * Provides a filtered view of the underlying data.
   *
   * Relies on the data item having an "id" property uniquely identifying it.
   */
export class SlickDataView<T = any> {
  protected defaults = {
    groupItemMetadataProvider: null,
    inlineFilters: false
  };

  // private
  protected idProperty = 'id';          // property holding a unique row id
  protected items: T[] = [];            // data by index
  protected rows: T[] = [];             // data by row
  protected idxById = new Map<number | string, number>();   // indexes by id
  protected rowsById: any = null;       // rows by id; lazy-calculated
  protected filter: any = null;         // filter function
  protected updated: any = null;        // updated item ids
  protected suspend = false;            // suspends the recalculation
  protected isBulkSuspend = false;      // delays protectedious operations like the
  // index update and delete to efficient
  // versions at endUpdate
  protected bulkDeleteIds = new Map<number | string, boolean>();
  protected sortAsc = true;
  protected fastSortField?: string | null | (() => string);
  protected sortComparer!: ((a: T, b: T) => number);
  protected refreshHints: any = {};
  protected prevRefreshHints: any = {};
  protected filterArgs: any;
  protected filteredItems: T[] = [];
  protected compiledFilter?: Function | null;
  protected compiledFilterWithCaching?: Function | null;
  protected filterCache: any[] = [];
  protected _grid?: SlickGrid; // grid object will be defined only after using "syncGridSelection()" method"

  // grouping
  protected groupingInfoDefaults: Grouping = {
    getter: undefined,
    formatter: undefined,
    comparer: (a: { value: any; }, b: { value: any; }) => {
      return (a.value === b.value ? 0 : (a.value > b.value ? 1 : -1));
    },
    predefinedValues: [],
    aggregators: [],
    aggregateEmpty: false,
    aggregateCollapsed: false,
    aggregateChildGroups: false,
    collapsed: false,
    displayTotalsRow: true,
    lazyTotalsCalculation: false
  };
  protected groupingInfos: Array<Grouping & { aggregators: Aggregator[]; getterIsAFn?: boolean; compiledAccumulators: any[]; getter: Function | string }> = [];
  protected groups: any[] = [];
  protected toggledGroupsByLevel: any[] = [];
  protected groupingDelimiter = ':|:';
  protected selectedRowIds: Array<number | string> = [];
  protected preSelectedRowIdsChangeFn?: Function;

  protected pagesize = 0;
  protected pagenum = 0;
  protected totalRows = 0;
  protected _options;

  // public events
  onBeforePagingInfoChanged = new SlickEvent<PagingInfo>();
  onGroupExpanded = new SlickEvent<OnGroupExpandedEventArgs>();
  onGroupCollapsed = new SlickEvent<OnGroupCollapsedEventArgs>();
  onPagingInfoChanged = new SlickEvent<PagingInfo>();
  onRowCountChanged = new SlickEvent<OnRowCountChangedEventArgs>();
  onRowsChanged = new SlickEvent<OnRowsChangedEventArgs>();
  onRowsOrCountChanged = new SlickEvent<OnRowsOrCountChangedEventArgs>();
  onSelectedRowIdsChanged = new SlickEvent<OnSelectedRowIdsChangedEventArgs>();
  onSetItemsCalled = new SlickEvent<OnSetItemsCalledEventArgs>();

  constructor(options: DataViewOption) {
    this._options = Utils.extend(true, {}, this.defaults, options);
  }

  /**
   * Begins a bached update of the items in the data view.
   * including deletes and the related events are postponed to the endUpdate call.
   * As certain operations are postponed during this update, some methods might not
   * deliver fully consistent information.
   * @param {Boolean} [bulkUpdate] - if set to true, most data view modifications
   */
  beginUpdate(bulkUpdate?: boolean) {
    this.suspend = true;
    this.isBulkSuspend = bulkUpdate === true;
  }

  endUpdate() {
    let wasBulkSuspend = this.isBulkSuspend;
    this.isBulkSuspend = false;
    this.suspend = false;
    if (wasBulkSuspend) {
      this.processBulkDelete();
      this.ensureIdUniqueness();
    }
    this.refresh();
  }

  destroy() {
    this.items = [];
    this.idxById = null as any;
    this.rowsById = null as any;
    this.filter = null as any;
    this.updated = null as any;
    this.sortComparer = null as any;
    this.filterCache = [];
    this.filteredItems = [];
    this.compiledFilter = null;
    this.compiledFilterWithCaching = null;

    if (this._grid && this._grid.onSelectedRowsChanged && this._grid.onCellCssStylesChanged) {
      this._grid.onSelectedRowsChanged.unsubscribe();
      this._grid.onCellCssStylesChanged.unsubscribe();
    }
    if (this.onRowsOrCountChanged) {
      this.onRowsOrCountChanged.unsubscribe();
    }
  }

  setRefreshHints(hints: any) {
    this.refreshHints = hints;
  }

  setFilterArgs(args: any) {
    this.filterArgs = args;
  }

  /**
   * Processes all delete requests placed during bulk update
   * by recomputing the items and idxById members.
   */
  protected processBulkDelete() {
    if (!this.idxById) return;
    // the bulk update is processed by
    // recomputing the whole items array and the index lookup in one go.
    // this is done by placing the not-deleted items
    // from left to right into the array and shrink the array the the new
    // size afterwards.
    // see https://github.com/6pac/SlickGrid/issues/571 for further details.

    let id, item, newIdx = 0;
    for (let i = 0, l = this.items.length; i < l; i++) {
      item = this.items[i];
      id = item[this.idProperty];
      if (id === undefined) {
        throw new Error("[SlickGrid DataView] Each data element must implement a unique 'id' property");
      }

      // if items have been marked as deleted we skip them for the new final items array
      // and we remove them from the lookup table.
      if (this.bulkDeleteIds.has(id)) {
        this.idxById.delete(id);
      } else {
        // for items which are not deleted, we add them to the
        // next free position in the array and register the index in the lookup.
        this.items[newIdx] = item;
        this.idxById.set(id, newIdx);
        ++newIdx;
      }
    }

    // here we shrink down the full item array to the ones actually
    // inserted in the cleanup loop above.
    this.items.length = newIdx;
    // and finally cleanup the deleted ids to start cleanly on the next update.
    this.bulkDeleteIds = new Map();
  }

  protected updateIdxById(startingIndex?: number) {
    if (this.isBulkSuspend || !this.idxById) { // during bulk update we do not reorganize
      return;
    }
    startingIndex = startingIndex || 0;
    let id;
    for (let i = startingIndex, l = this.items.length; i < l; i++) {
      id = this.items[i][this.idProperty];
      if (id === undefined) {
        throw new Error("[SlickGrid DataView] Each data element must implement a unique 'id' property");
      }
      this.idxById.set(id, i);
    }
  }

  protected ensureIdUniqueness() {
    if (this.isBulkSuspend || !this.idxById) { // during bulk update we do not reorganize
      return;
    }
    let id;
    for (let i = 0, l = this.items.length; i < l; i++) {
      id = this.items[i][this.idProperty];
      if (id === undefined || this.idxById.get(id) !== i) {
        throw new Error("[SlickGrid DataView] Each data element must implement a unique 'id' property");
      }
    }
  }

  /** Get all DataView Items */
  getItems() {
    return this.items;
  }

  /** Get the DataView Id property name to use (defaults to "Id" but could be customized to something else when instantiating the DataView) */
  getIdPropertyName() {
    return this.idProperty;
  }

  /**
   * Set the Items with a new Dataset and optionally pass a different Id property name
   * @param {Array<*>} data - array of data
   * @param {String} [objectIdProperty] - optional id property to use as primary id
   */
  setItems(data: T[], objectIdProperty?: string) {
    if (objectIdProperty !== undefined) {
      this.idProperty = objectIdProperty;
    }
    this.items = this.filteredItems = data;
    this.onSetItemsCalled.notify({ idProperty: this.idProperty, itemCount: this.items.length }, null, this);
    this.idxById = new Map();
    this.updateIdxById();
    this.ensureIdUniqueness();
    this.refresh();
  }

  /** Set Paging Options */
  setPagingOptions(args: Partial<PagingInfo>) {
    if (this.onBeforePagingInfoChanged.notify(this.getPagingInfo(), null, this).getReturnValue() !== false) {
      if (args.pageSize != undefined) {
        this.pagesize = args.pageSize;
        this.pagenum = this.pagesize ? Math.min(this.pagenum, Math.max(0, Math.ceil(this.totalRows / this.pagesize) - 1)) : 0;
      }

      if (args.pageNum != undefined) {
        this.pagenum = Math.min(args.pageNum, Math.max(0, Math.ceil(this.totalRows / this.pagesize) - 1));
      }

      this.onPagingInfoChanged.notify(this.getPagingInfo(), null, this);

      this.refresh();
    }
  }

  /** Get Paging Options */
  getPagingInfo(): PagingInfo {
    const totalPages = this.pagesize ? Math.max(1, Math.ceil(this.totalRows / this.pagesize)) : 1;
    return { pageSize: this.pagesize, pageNum: this.pagenum, totalRows: this.totalRows, totalPages: totalPages, dataView: this as SlickDataView };
  }

  /** Sort Method to use by the DataView */
  sort(comparer: (a: T, b: T) => number, ascending: boolean) {
    this.sortAsc = ascending;
    this.sortComparer = comparer;
    this.fastSortField = null;
    if (ascending === false) {
      this.items.reverse();
    }
    this.items.sort(comparer);
    if (ascending === false) {
      this.items.reverse();
    }
    this.idxById = new Map();
    this.updateIdxById();
    this.refresh();
  }

  /**
   * Provides a workaround for the extremely slow sorting in IE.
   * Does a [lexicographic] sort on a give column by temporarily overriding Object.prototype.toString
   * to return the value of that field and then doing a native Array.sort().
   */
  fastSort(field: string | (() => string), ascending: boolean) {
    this.sortAsc = ascending;
    this.fastSortField = field;
    this.sortComparer = null as any;
    let oldToString = Object.prototype.toString;
    Object.prototype.toString = (typeof field === 'function') ? field : function () {
      // @ts-ignore
      return this[field];
    };
    // an extra reversal for descending sort keeps the sort stable
    // (assuming a stable native sort implementation, which isn't true in some cases)
    if (ascending === false) {
      this.items.reverse();
    }
    this.items.sort();
    Object.prototype.toString = oldToString;
    if (ascending === false) {
      this.items.reverse();
    }
    this.idxById = new Map();
    this.updateIdxById();
    this.refresh();
  }

  /** Re-Sort the dataset */
  reSort() {
    if (this.sortComparer) {
      this.sort(this.sortComparer, this.sortAsc);
    } else if (this.fastSortField) {
      this.fastSort(this.fastSortField, this.sortAsc);
    }
  }

  /** Get only the DataView filtered items */
  getFilteredItems() {
    return this.filteredItems;
  }

  /** Get the array length (count) of only the DataView filtered items */
  getFilteredItemCount() {
    return this.filteredItems.length;
  }

  /** Get current Filter used by the DataView */
  getFilter() {
    return this.filter;
  }

  /**
   * Set a Filter that will be used by the DataView
   * @param {Function} fn - filter callback function
   */
  setFilter(filterFn: (a: T, b: T) => number) {
    this.filter = filterFn;
    if (this._options.inlineFilters) {
      this.compiledFilter = this.compileFilter();
      this.compiledFilterWithCaching = this.compileFilterWithCaching();
    }
    this.refresh();
  }

  /** Get current Grouping info */
  getGrouping(): Grouping[] {
    return this.groupingInfos;
  }

  /** Set some Grouping */
  setGrouping(groupingInfo: Grouping | Grouping[]) {
    if (!this._options.groupItemMetadataProvider) {
      this._options.groupItemMetadataProvider = new SlickGroupItemMetadataProvider();
    }

    this.groups = [];
    this.toggledGroupsByLevel = [];
    groupingInfo = groupingInfo || [];
    this.groupingInfos = ((groupingInfo instanceof Array) ? groupingInfo : [groupingInfo]) as any;

    for (let i = 0; i < this.groupingInfos.length; i++) {
      let gi = this.groupingInfos[i] = Utils.extend(true, {}, this.groupingInfoDefaults, this.groupingInfos[i]);
      gi.getterIsAFn = typeof gi.getter === 'function';

      // pre-compile accumulator loops
      gi.compiledAccumulators = [];
      let idx = gi.aggregators.length;
      while (idx--) {
        gi.compiledAccumulators[idx] = this.compileAccumulatorLoop(gi.aggregators[idx]);
      }

      this.toggledGroupsByLevel[i] = {};
    }

    this.refresh();
  }

  /**
   * @deprecated Please use {@link setGrouping}.
   */
  groupBy(valueGetter: string | GroupingGetterFunction<T>, valueFormatter: (g: GroupingFormatterItem) => string, sortComparer?: (a: GroupingComparerItem, b: GroupingComparerItem) => SortDirectionNumber) {
    if (valueGetter == null) {
      this.setGrouping([]);
      return;
    }

    this.setGrouping({
      getter: valueGetter,
      formatter: valueFormatter,
      comparer: sortComparer
    });
  }

  /**
   * @deprecated Please use {@link setGrouping}.
   */
  setAggregators(groupAggregators: Aggregator[], includeCollapsed: boolean) {
    if (!this.groupingInfos.length) {
      throw new Error("[SlickGrid DataView] At least one grouping must be specified before calling setAggregators().");
    }

    this.groupingInfos[0].aggregators = groupAggregators;
    this.groupingInfos[0].aggregateCollapsed = includeCollapsed;

    this.setGrouping(this.groupingInfos);
  }

  /** Get an item in the DataView by its row index */
  getItemByIdx(i: number) {
    return this.items[i];
  }

  /** Get row index in the DataView by its Id */
  getIdxById(id: number | string) {
    return this.idxById && this.idxById.get(id);
  }

  protected ensureRowsByIdCache() {
    if (!this.rowsById) {
      this.rowsById = {};
      for (let i = 0, l = this.rows.length; i < l; i++) {
        this.rowsById[this.rows[i][this.idProperty]] = i;
      }
    }
  }

  /** Get row number in the grid by its item object */
  getRowByItem(item: T) {
    this.ensureRowsByIdCache();
    return this.rowsById[item[this.idProperty]];
  }

  /** Get row number in the grid by its Id */
  getRowById(id: number | string) {
    this.ensureRowsByIdCache();
    return this.rowsById[id];
  }

  /** Get an item in the DataView by its Id */
  getItemById(id: number | string) {
    return this.items[this.idxById.get(id) || ''];
  }

  /** From the items array provided, return the mapped rows */
  mapItemsToRows(itemArray: T[]) {
    const rows: number[] = [];
    this.ensureRowsByIdCache();
    for (let i = 0, l = itemArray.length; i < l; i++) {
      let row = this.rowsById[itemArray[i][this.idProperty]];
      if (row != null) {
        rows[rows.length] = row;
      }
    }
    return rows;
  }

  /** From the Ids array provided, return the mapped rows */
  mapIdsToRows(idArray: Array<number | string>) {
    const rows: number[] = [];
    this.ensureRowsByIdCache();
    for (let i = 0, l = idArray.length; i < l; i++) {
      let row = this.rowsById[idArray[i]];
      if (row != null) {
        rows[rows.length] = row;
      }
    }
    return rows;
  }

  /** From the rows array provided, return the mapped Ids */
  mapRowsToIds(rowArray: number[]) {
    const ids: Array<number | string> = [];
    for (let i = 0, l = rowArray.length; i < l; i++) {
      if (rowArray[i] < this.rows.length) {
        const rowItem = this.rows[rowArray[i]];
        ids[ids.length] = rowItem && rowItem[this.idProperty];
      }
    }
    return ids;
  }

  /**
   * Performs the update operations of a single item by id without
   * triggering any events or refresh operations.
   * @param id The new id of the item.
   * @param item The item which should be the new value for the given id.
   */
  updateSingleItem(id: number | string, item: T) {
    if (!this.idxById) return;

    // see also https://github.com/mleibman/SlickGrid/issues/1082
    if (!this.idxById.has(id)) {
      throw new Error('[SlickGrid DataView] Invalid id');
    }

    // What if the specified item also has an updated idProperty?
    // Then we'll have to update the index as well, and possibly the `updated` cache too.
    if (id !== item[this.idProperty]) {
      // make sure the new id is unique:
      let newId = item[this.idProperty];
      if (newId == null) {
        throw new Error('[SlickGrid DataView] Cannot update item to associate with a null id');
      }
      if (this.idxById.has(newId)) {
        throw new Error('[SlickGrid DataView] Cannot update item to associate with a non-unique id');
      }
      this.idxById.set(newId, this.idxById.get(id) as number);
      this.idxById.delete(id);

      // Also update the `updated` hashtable/markercache? Yes, `recalc()` inside `refresh()` needs that one!
      if (this.updated?.[id]) {
        delete this.updated[id];
      }

      // Also update the row indexes? no need since the `refresh()`, further down, blows away the `rowsById[]` cache!

      id = newId;
    }
    this.items[this.idxById.get(id) as number] = item;

    // Also update the rows? no need since the `refresh()`, further down, blows away the `rows[]` cache and recalculates it via `recalc()`!

    if (!this.updated) {
      this.updated = {};
    }
    this.updated[id] = true;
  }

  /**
   * Updates a single item in the data view given the id and new value.
   * @param id The new id of the item.
   * @param item The item which should be the new value for the given id.
   */
  updateItem(id: number | string, item: T) {
    this.updateSingleItem(id, item);
    this.refresh();
  }

  /**
   * Updates multiple items in the data view given the new ids and new values.
   * @param id {Array} The array of new ids which is in the same order as the items.
   * @param newItems {Array} The new items that should be set in the data view for the given ids.
   */
  updateItems(ids: Array<number | string>, newItems: T[]) {
    if (ids.length !== newItems.length) {
      throw new Error("[SlickGrid DataView] Mismatch on the length of ids and items provided to update");
    }
    for (let i = 0, l = newItems.length; i < l; i++) {
      this.updateSingleItem(ids[i], newItems[i]);
    }
    this.refresh();
  }

  /**
   * Inserts a single item into the data view at the given position.
   * @param insertBefore {Number} The 0-based index before which the item should be inserted.
   * @param item The item to insert.
   */
  insertItem(insertBefore: number, item: T) {
    this.items.splice(insertBefore, 0, item);
    this.updateIdxById(insertBefore);
    this.refresh();
  }

  /**
   * Inserts multiple items into the data view at the given position.
   * @param insertBefore {Number} The 0-based index before which the items should be inserted.
   * @param newItems {Array}  The items to insert.
   */
  insertItems(insertBefore: number, newItems: T[]) {
    // @ts-ignore
    Array.prototype.splice.apply(this.items, [insertBefore, 0].concat(newItems));
    this.updateIdxById(insertBefore);
    this.refresh();
  }

  /**
   * Adds a single item at the end of the data view.
   * @param item The item to add at the end.
   */
  addItem(item: T) {
    this.items.push(item);
    this.updateIdxById(this.items.length - 1);
    this.refresh();
  }

  /**
   * Adds multiple items at the end of the data view.
   * @param {Array} newItems The items to add at the end.
   */
  addItems(newItems: T[]) {
    this.items = this.items.concat(newItems);
    this.updateIdxById(this.items.length - newItems.length);
    this.refresh();
  }

  /**
   * Deletes a single item identified by the given id from the data view.
   * @param {String|Number} id The id identifying the object to delete.
   */
  deleteItem(id: number | string) {
    if (!this.idxById) return;
    if (this.isBulkSuspend) {
      this.bulkDeleteIds.set(id, true);
    } else {
      let idx = this.idxById.get(id);
      if (idx === undefined) {
        throw new Error('[SlickGrid DataView] Invalid id');
      }
      this.idxById.delete(id);
      this.items.splice(idx, 1);
      this.updateIdxById(idx);
      this.refresh();
    }
  }

  /**
   * Deletes multiple item identified by the given ids from the data view.
   * @param {Array} ids The ids of the items to delete.
   */
  deleteItems(ids: Array<number | string>) {
    if (ids.length === 0 || !this.idxById) {
      return;
    }

    if (this.isBulkSuspend) {
      for (let i = 0, l = ids.length; i < l; i++) {
        let id = ids[i];
        let idx = this.idxById.get(id);
        if (idx === undefined) {
          throw new Error('[SlickGrid DataView] Invalid id');
        }
        this.bulkDeleteIds.set(id, true);
      }
    } else {
      // collect all indexes
      let indexesToDelete: number[] = [];
      for (let i = 0, l = ids.length; i < l; i++) {
        let id = ids[i];
        let idx = this.idxById.get(id);
        if (idx === undefined) {
          throw new Error('[SlickGrid DataView] Invalid id');
        }
        this.idxById.delete(id);
        indexesToDelete.push(idx);
      }

      // Remove from back to front
      indexesToDelete.sort();
      for (let i = indexesToDelete.length - 1; i >= 0; --i) {
        this.items.splice(indexesToDelete[i], 1);
      }

      // update lookup from front to back
      this.updateIdxById(indexesToDelete[0]);
      this.refresh();
    }
  }

  /** Add an item in a sorted dataset (a Sort function must be defined) */
  sortedAddItem(item: T) {
    if (!this.sortComparer) {
      throw new Error('[SlickGrid DataView] sortedAddItem() requires a sort comparer, use sort()');
    }
    this.insertItem(this.sortedIndex(item), item);
  }

  /** Update an item in a sorted dataset (a Sort function must be defined) */
  sortedUpdateItem(id: string | number, item: T) {
    if (!this.idxById) return;
    if (!this.idxById.has(id) || id !== item[this.idProperty]) {
      throw new Error('[SlickGrid DataView] Invalid or non-matching id ' + this.idxById.get(id));
    }
    if (!this.sortComparer) {
      throw new Error("[SlickGrid DataView] sortedUpdateItem() requires a sort comparer, use sort()");
    }
    const oldItem = this.getItemById(id);
    if (this.sortComparer(oldItem, item) !== 0) {
      // item affects sorting -> must use sorted add
      this.deleteItem(id);
      this.sortedAddItem(item);
    } else { // update does not affect sorting -> regular update works fine
      this.updateItem(id, item);
    }
  }

  protected sortedIndex(searchItem: T) {
    let low = 0;
    let high = this.items.length;

    while (low < high) {
      let mid = low + high >>> 1;
      if (this.sortComparer(this.items[mid], searchItem) === -1) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  }

  /** Get item count, that is the full dataset lenght of the DataView */
  getItemCount() {
    return this.items.length;
  }

  /** Get row count (rows displayed in current page) */
  getLength() {
    return this.rows.length;
  }

  /** Retrieve an item from the DataView at specific index */
  getItem(i: number) {
    const item = this.rows[i];

    // if this is a group row, make sure totals are calculated and update the title
    if ((item as SlickGroup_)?.__group && (item as SlickGroup_).totals && !(item as SlickGroup_).totals?.initialized) {
      const gi = this.groupingInfos[(item as SlickGroup_).level];
      if (!gi.displayTotalsRow) {
        this.calculateTotals((item as SlickGroup_).totals);
        (item as SlickGroup_).title = gi.formatter ? gi.formatter((item as SlickGroup_)) : (item as SlickGroup_).value;
      }
    }
    // if this is a totals row, make sure it's calculated
    else if ((item as SlickGroupTotals_)?.__groupTotals && !(item as SlickGroupTotals_).initialized) {
      this.calculateTotals(item as SlickGroupTotals_);
    }

    return item;
  }

  getItemMetadata(i: number) {
    let item = this.rows[i];
    if (item === undefined) {
      return null;
    }

    // overrides for grouping rows
    if ((item as SlickGroup_).__group) {
      return this._options.groupItemMetadataProvider.getGroupRowMetadata(item);
    }

    // overrides for totals rows
    if ((item as SlickGroupTotals_).__groupTotals) {
      return this._options.groupItemMetadataProvider.getTotalsRowMetadata(item);
    }

    return null;
  }

  protected expandCollapseAllGroups(level?: number, collapse?: boolean) {
    if (level == null) {
      for (let i = 0; i < this.groupingInfos.length; i++) {
        this.toggledGroupsByLevel[i] = {};
        this.groupingInfos[i].collapsed = collapse;

        if (collapse === true) {
          this.onGroupCollapsed.notify({ level: i, groupingKey: null });
        } else {
          this.onGroupExpanded.notify({ level: i, groupingKey: null });
        }
      }
    } else {
      this.toggledGroupsByLevel[level] = {};
      this.groupingInfos[level].collapsed = collapse;

      if (collapse === true) {
        this.onGroupCollapsed.notify({ level: level, groupingKey: null });
      } else {
        this.onGroupExpanded.notify({ level: level, groupingKey: null });
      }
    }
    this.refresh();
  }

  /**
   * @param {Number} [level] Optional level to collapse.  If not specified, applies to all levels.
   */
  collapseAllGroups(level?: number) {
    this.expandCollapseAllGroups(level, true);
  }

  /**
   * @param {Number} [level] Optional level to expand.  If not specified, applies to all levels.
   */
  expandAllGroups(level?: number) {
    this.expandCollapseAllGroups(level, false);
  }

  expandCollapseGroup(level: number, groupingKey: string, collapse?: boolean) {
    // @ts-ignore
    this.toggledGroupsByLevel[level][groupingKey] = this.groupingInfos[level].collapsed ^ collapse;
    this.refresh();
  }

  /**
   * @param varArgs Either a Slick.Group's "groupingKey" property, or a
   *     variable argument list of grouping values denoting a unique path to the row.  For
   *     example, calling collapseGroup('high', '10%') will collapse the '10%' subgroup of
   *     the 'high' group.
   */
  collapseGroup(_varArgs: any) {
    const args = Array.prototype.slice.call(arguments);
    const arg0 = args[0];
    let groupingKey;
    let level;

    if (args.length === 1 && arg0.indexOf(this.groupingDelimiter) !== -1) {
      groupingKey = arg0;
      level = arg0.split(this.groupingDelimiter).length - 1;
    } else {
      groupingKey = args.join(this.groupingDelimiter);
      level = args.length - 1;
    }

    this.expandCollapseGroup(level, groupingKey, true);
    this.onGroupCollapsed.notify({ level: level, groupingKey: groupingKey });
  }

  /**
   * @param varArgs Either a Slick.Group's "groupingKey" property, or a
   *     variable argument list of grouping values denoting a unique path to the row.  For
   *     example, calling expandGroup('high', '10%') will expand the '10%' subgroup of
   *     the 'high' group.
   */
  expandGroup(_varArgs: any) {
    const args = Array.prototype.slice.call(arguments);
    const arg0 = args[0];
    let groupingKey;
    let level;

    if (args.length === 1 && arg0.indexOf(this.groupingDelimiter) !== -1) {
      level = arg0.split(this.groupingDelimiter).length - 1;
      groupingKey = arg0;
    } else {
      level = args.length - 1;
      groupingKey = args.join(this.groupingDelimiter);
    }

    this.expandCollapseGroup(level, groupingKey, false);
    this.onGroupExpanded.notify({ level: level, groupingKey: groupingKey });
  }

  getGroups() {
    return this.groups;
  }

  protected extractGroups(rows: number[], parentGroup?: SlickGroup_) {
    let group;
    let val;
    let groups: SlickGroup_[] = [];
    let groupsByVal = {};
    let r;
    let level = parentGroup ? parentGroup.level + 1 : 0;
    let gi = this.groupingInfos[level];

    for (let i = 0, l = gi.predefinedValues?.length ?? 0; i < l; i++) {
      val = gi.predefinedValues?.[i];
      group = groupsByVal[val];
      if (!group) {
        group = new SlickGroup();
        group.value = val;
        group.level = level;
        group.groupingKey = (parentGroup ? parentGroup.groupingKey + this.groupingDelimiter : '') + val;
        groups[groups.length] = group;
        groupsByVal[val] = group;
      }
    }

    for (let i = 0, l = rows.length; i < l; i++) {
      r = rows[i];
      val = gi.getterIsAFn ? (gi.getter as Function)(r) : r[gi.getter as string];
      group = groupsByVal[val];
      if (!group) {
        group = new SlickGroup();
        group.value = val;
        group.level = level;
        group.groupingKey = (parentGroup ? parentGroup.groupingKey + this.groupingDelimiter : '') + val;
        groups[groups.length] = group;
        groupsByVal[val] = group;
      }

      group.rows[group.count++] = r;
    }

    if (level < this.groupingInfos.length - 1) {
      for (let i = 0; i < groups.length; i++) {
        group = groups[i];
        group.groups = this.extractGroups(group.rows, group);
      }
    }

    if (groups.length) {
      this.addTotals(groups, level);
    }

    groups.sort(this.groupingInfos[level].comparer);

    return groups;
  }

  protected calculateTotals(totals: SlickGroupTotals_) {
    let group = totals.group;
    let gi = this.groupingInfos[group.level ?? 0];
    let isLeafLevel = (group.level === this.groupingInfos.length);
    let agg: Aggregator, idx = gi.aggregators.length;

    if (!isLeafLevel && gi.aggregateChildGroups) {
      // make sure all the subgroups are calculated
      let i = group.groups?.length ?? 0;
      while (i--) {
        if (!group.groups[i].totals.initialized) {
          this.calculateTotals(group.groups[i].totals);
        }
      }
    }

    while (idx--) {
      agg = gi.aggregators[idx];
      agg.init();
      if (!isLeafLevel && gi.aggregateChildGroups) {
        gi.compiledAccumulators[idx].call(agg, group.groups);
      } else {
        gi.compiledAccumulators[idx].call(agg, group.rows);
      }
      agg.storeResult(totals);
    }
    totals.initialized = true;
  }

  protected addGroupTotals(group: SlickGroup_) {
    let gi = this.groupingInfos[group.level];
    let totals = new SlickGroupTotals();
    totals.group = group;
    group.totals = totals;
    if (!gi.lazyTotalsCalculation) {
      this.calculateTotals(totals);
    }
  }

  protected addTotals(groups: Grouping[], level?: number) {
    level = level || 0;
    let gi = this.groupingInfos[level];
    let groupCollapsed = gi.collapsed;
    let toggledGroups = this.toggledGroupsByLevel[level];
    let idx = groups.length, g;
    while (idx--) {
      g = groups[idx];

      if (g.collapsed && !gi.aggregateCollapsed) {
        continue;
      }

      // Do a depth-first aggregation so that parent group aggregators can access subgroup totals.
      if (g.groups) {
        this.addTotals(g.groups, level + 1);
      }

      if (gi.aggregators?.length && (
        gi.aggregateEmpty || g.rows.length || (g.groups && g.groups.length))) {
        this.addGroupTotals(g);
      }

      g.collapsed = (groupCollapsed as any) ^ toggledGroups[g.groupingKey];
      g.title = gi.formatter ? gi.formatter(g) : g.value;
    }
  }

  protected flattenGroupedRows(groups: Grouping[], level?: number) {
    level = level || 0;
    const gi = this.groupingInfos[level];
    let groupedRows: number[] = [], rows, gl = 0, g;
    for (let i = 0, l = groups.length; i < l; i++) {
      g = groups[i];
      groupedRows[gl++] = g;

      if (!g.collapsed) {
        rows = g.groups ? this.flattenGroupedRows(g.groups, level + 1) : g.rows;
        for (let j = 0, jj = rows.length; j < jj; j++) {
          groupedRows[gl++] = rows[j];
        }
      }

      if (g.totals && gi.displayTotalsRow && (!g.collapsed || gi.aggregateCollapsed)) {
        groupedRows[gl++] = g.totals;
      }
    }
    return groupedRows;
  }

  protected getFunctionInfo(fn: Function) {
    const fnStr = fn.toString();
    const usingEs5 = fnStr.indexOf('function') >= 0; // with ES6, the word function is not present
    const fnRegex = usingEs5 ? /^function[^(]*\(([^)]*)\)\s*{([\s\S]*)}$/ : /^[^(]*\(([^)]*)\)\s*{([\s\S]*)}$/;
    const matches = fn.toString().match(fnRegex) || [];
    return {
      params: matches[1].split(","),
      body: matches[2]
    };
  }

  protected compileAccumulatorLoop(aggregator: Aggregator) {
    if (aggregator.accumulate) {
      const accumulatorInfo = this.getFunctionInfo(aggregator.accumulate);
      const fn: any = new Function(
        "_items",
        "for (var " + accumulatorInfo.params[0] + ", _i=0, _il=_items.length; _i<_il; _i++) {" +
        accumulatorInfo.params[0] + " = _items[_i]; " +
        accumulatorInfo.body +
        "}"
      );
      const fnName = "compiledAccumulatorLoop";
      fn.displayName = fnName;
      fn.name = this.setFunctionName(fn, fnName);
      return fn;
    } else {
      return function noAccumulator() { }
    }
  }

  protected compileFilter(): Function {
    const filterInfo = this.getFunctionInfo(this.filter);

    const filterPath1 = "{ continue _coreloop; }$1";
    const filterPath2 = "{ _retval[_idx++] = $item$; continue _coreloop; }$1";
    // make some allowances for minification - there's only so far we can go with RegEx
    const filterBody = filterInfo.body
      .replace(/return false\s*([;}]|\}|$)/gi, filterPath1)
      .replace(/return!1([;}]|\}|$)/gi, filterPath1)
      .replace(/return true\s*([;}]|\}|$)/gi, filterPath2)
      .replace(/return!0([;}]|\}|$)/gi, filterPath2)
      .replace(/return ([^;}]+?)\s*([;}]|$)/gi,
        "{ if ($1) { _retval[_idx++] = $item$; }; continue _coreloop; }$2");

    // This preserves the function template code after JS compression,
    // so that replace() commands still work as expected.
    let tpl = [
      //"function(_items, _args) { ",
      "var _retval = [], _idx = 0; ",
      "var $item$, $args$ = _args; ",
      "_coreloop: ",
      "for (var _i = 0, _il = _items.length; _i < _il; _i++) { ",
      "$item$ = _items[_i]; ",
      "$filter$; ",
      "} ",
      "return _retval; "
      //"}"
    ].join("");
    tpl = tpl.replace(/\$filter\$/gi, filterBody);
    tpl = tpl.replace(/\$item\$/gi, filterInfo.params[0]);
    tpl = tpl.replace(/\$args\$/gi, filterInfo.params[1]);

    const fn: any = new Function("_items,_args", tpl);
    const fnName = "compiledFilter";
    fn.displayName = fnName;
    fn.name = this.setFunctionName(fn, fnName);
    return fn;
  }

  protected compileFilterWithCaching() {
    const filterInfo = this.getFunctionInfo(this.filter);

    const filterPath1 = "{ continue _coreloop; }$1";
    const filterPath2 = "{ _cache[_i] = true;_retval[_idx++] = $item$; continue _coreloop; }$1";
    // make some allowances for minification - there's only so far we can go with RegEx
    const filterBody = filterInfo.body
      .replace(/return false\s*([;}]|\}|$)/gi, filterPath1)
      .replace(/return!1([;}]|\}|$)/gi, filterPath1)
      .replace(/return true\s*([;}]|\}|$)/gi, filterPath2)
      .replace(/return!0([;}]|\}|$)/gi, filterPath2)
      .replace(/return ([^;}]+?)\s*([;}]|$)/gi,
        "{ if ((_cache[_i] = $1)) { _retval[_idx++] = $item$; }; continue _coreloop; }$2");

    // This preserves the function template code after JS compression,
    // so that replace() commands still work as expected.
    let tpl = [
      //"function(_items, _args, _cache) { ",
      "var _retval = [], _idx = 0; ",
      "var $item$, $args$ = _args; ",
      "_coreloop: ",
      "for (var _i = 0, _il = _items.length; _i < _il; _i++) { ",
      "$item$ = _items[_i]; ",
      "if (_cache[_i]) { ",
      "_retval[_idx++] = $item$; ",
      "continue _coreloop; ",
      "} ",
      "$filter$; ",
      "} ",
      "return _retval; "
      //"}"
    ].join("");
    tpl = tpl.replace(/\$filter\$/gi, filterBody);
    tpl = tpl.replace(/\$item\$/gi, filterInfo.params[0]);
    tpl = tpl.replace(/\$args\$/gi, filterInfo.params[1]);

    const fn: any = new Function("_items,_args,_cache", tpl);
    const fnName = "compiledFilterWithCaching";
    fn.displayName = fnName;
    fn.name = this.setFunctionName(fn, fnName);
    return fn;
  }

  /**
   * In ES5 we could set the function name on the fly but in ES6 this is forbidden and we need to set it through differently
   * We can use Object.defineProperty and set it the property to writable, see MDN for reference
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
   * @param {*} fn
   * @param {string} fnName
   */
  protected setFunctionName(fn: any, fnName: string) {
    try {
      Object.defineProperty(fn, 'name', {
        writable: true,
        value: fnName
      });
    } catch (err) {
      fn.name = fnName;
    }
  }

  protected uncompiledFilter(items: T[], args: any) {
    let retval: any[] = [], idx = 0;

    for (let i = 0, ii = items.length; i < ii; i++) {
      if (this.filter(items[i], args)) {
        retval[idx++] = items[i];
      }
    }

    return retval;
  }

  protected uncompiledFilterWithCaching(items: T[], args: any, cache: any) {
    let retval: any[] = [], idx = 0, item: T;

    for (let i = 0, ii = items.length; i < ii; i++) {
      item = items[i];
      if (cache[i]) {
        retval[idx++] = item;
      } else if (this.filter(item, args)) {
        retval[idx++] = item;
        cache[i] = true;
      }
    }

    return retval;
  }

  protected getFilteredAndPagedItems(items: T[]) {
    if (this.filter) {
      const batchFilter = (this._options.inlineFilters ? this.compiledFilter : this.uncompiledFilter) as Function;
      const batchFilterWithCaching = (this._options.inlineFilters ? this.compiledFilterWithCaching : this.uncompiledFilterWithCaching) as Function;

      if (this.refreshHints.isFilterNarrowing) {
        this.filteredItems = batchFilter.call(this, this.filteredItems, this.filterArgs);
      } else if (this.refreshHints.isFilterExpanding) {
        this.filteredItems = batchFilterWithCaching.call(this, items, this.filterArgs, this.filterCache);
      } else if (!this.refreshHints.isFilterUnchanged) {
        this.filteredItems = batchFilter.call(this, items, this.filterArgs);
      }
    } else {
      // special case:  if not filtering and not paging, the resulting
      // rows collection needs to be a copy so that changes due to sort
      // can be caught
      this.filteredItems = this.pagesize ? items : items.concat();
    }

    // get the current page
    let paged;
    if (this.pagesize) {
      if (this.filteredItems.length <= this.pagenum * this.pagesize) {
        if (this.filteredItems.length === 0) {
          this.pagenum = 0;
        } else {
          this.pagenum = Math.floor((this.filteredItems.length - 1) / this.pagesize);
        }
      }
      paged = this.filteredItems.slice(this.pagesize * this.pagenum, this.pagesize * this.pagenum + this.pagesize);
    } else {
      paged = this.filteredItems;
    }
    return { totalRows: this.filteredItems.length, rows: paged };
  }

  protected getRowDiffs(rows: any[], newRows: any[]) {
    let item, r, eitherIsNonData, diff: any[] = [];
    let from = 0, to = Math.max(newRows.length, rows.length);

    if (this.refreshHints && this.refreshHints.ignoreDiffsBefore) {
      from = Math.max(0,
        Math.min(newRows.length, this.refreshHints.ignoreDiffsBefore));
    }

    if (this.refreshHints && this.refreshHints.ignoreDiffsAfter) {
      to = Math.min(newRows.length,
        Math.max(0, this.refreshHints.ignoreDiffsAfter));
    }

    for (let i = from, rl = rows.length; i < to; i++) {
      if (i >= rl) {
        diff[diff.length] = i;
      } else {
        item = newRows[i];
        r = rows[i];

        if (!item || (this.groupingInfos.length && (eitherIsNonData = ((item as SlickNonDataItem).__nonDataRow) || (r.__nonDataRow)) &&
          (item as SlickGroup_).__group !== r.__group ||
          (item as SlickGroup_).__group && !item.equals(r))
          || (eitherIsNonData &&
            // no good way to compare totals since they are arbitrary DTOs
            // deep object comparison is pretty expensive
            // always considering them 'dirty' seems easier for the time being
            ((item as SlickGroupTotals_).__groupTotals || r.__groupTotals))
          || item[this.idProperty] != r[this.idProperty]
          || (this.updated?.[item[this.idProperty]])
        ) {
          diff[diff.length] = i;
        }
      }
    }
    return diff;
  }

  protected recalc(_items: T[]) {
    this.rowsById = null;

    if (this.refreshHints.isFilterNarrowing != this.prevRefreshHints.isFilterNarrowing ||
      this.refreshHints.isFilterExpanding != this.prevRefreshHints.isFilterExpanding) {
      this.filterCache = [];
    }

    const filteredItems = this.getFilteredAndPagedItems(_items);
    this.totalRows = filteredItems.totalRows;
    let newRows: number[] = filteredItems.rows;

    this.groups = [];
    if (this.groupingInfos.length) {
      this.groups = this.extractGroups(newRows);
      if (this.groups.length) {
        newRows = this.flattenGroupedRows(this.groups);
      }
    }

    let diff = this.getRowDiffs(this.rows, newRows);

    this.rows = newRows as any;

    return diff;
  }

  refresh() {
    if (this.suspend) {
      return;
    }

    let previousPagingInfo = Utils.extend(true, {}, this.getPagingInfo());

    let countBefore = this.rows.length;
    let totalRowsBefore = this.totalRows;

    let diff = this.recalc(this.items); // pass as direct refs to avoid closure perf hit

    // if the current page is no longer valid, go to last page and recalc
    // we suffer a performance penalty here, but the main loop (recalc) remains highly optimized
    if (this.pagesize && this.totalRows < this.pagenum * this.pagesize) {
      this.pagenum = Math.max(0, Math.ceil(this.totalRows / this.pagesize) - 1);
      diff = this.recalc(this.items);
    }

    this.updated = null;
    this.prevRefreshHints = this.refreshHints;
    this.refreshHints = {};

    if (totalRowsBefore !== this.totalRows) {
      // use the previously saved paging info
      if (this.onBeforePagingInfoChanged.notify(previousPagingInfo, null, this).getReturnValue() !== false) {
        this.onPagingInfoChanged.notify(this.getPagingInfo(), null, this);
      }
    }
    if (countBefore !== this.rows.length) {
      this.onRowCountChanged.notify({ previous: countBefore, current: this.rows.length, itemCount: this.items.length, dataView: this, callingOnRowsChanged: (diff.length > 0) }, null, this);
    }
    if (diff.length > 0) {
      this.onRowsChanged.notify({ rows: diff, itemCount: this.items.length, dataView: this, calledOnRowCountChanged: (countBefore !== this.rows.length) }, null, this);
    }
    if (countBefore !== this.rows.length || diff.length > 0) {
      this.onRowsOrCountChanged.notify({
        rowsDiff: diff, previousRowCount: countBefore, currentRowCount: this.rows.length, itemCount: this.items.length,
        rowCountChanged: countBefore !== this.rows.length, rowsChanged: diff.length > 0, dataView: this
      }, null, this);
    }
  }

  /**
   * Wires the grid and the DataView together to keep row selection tied to item ids.
   * This is useful since, without it, the grid only knows about rows, so if the items
   * move around, the same rows stay selected instead of the selection moving along
   * with the items.
   *
   * NOTE:  This doesn't work with cell selection model.
   *
   * @param {SlickGrid} grid - The grid to sync selection with.
   * @param {Boolean} preserveHidden - Whether to keep selected items that go out of the
   *     view due to them getting filtered out.
   * @param {Boolean} [preserveHiddenOnSelectionChange] - Whether to keep selected items
   *     that are currently out of the view (see preserveHidden) as selected when selection
   *     changes.
   * @return {Event} An event that notifies when an internal list of selected row ids
   *     changes.  This is useful since, in combination with the above two options, it allows
   *     access to the full list selected row ids, and not just the ones visible to the grid.
   * @method syncGridSelection
   */
  syncGridSelection(grid: SlickGrid, preserveHidden: boolean, preserveHiddenOnSelectionChange?: boolean) {
    this._grid = grid;
    let inHandler;
    this.selectedRowIds = this.mapRowsToIds(grid.getSelectedRows());

    /** @param {Array} rowIds */
    const setSelectedRowIds = (rowIds: Array<number | string> | false) => {
      if (rowIds === false) {
        this.selectedRowIds = [];
      } else {
        if (this.selectedRowIds!.sort().join(',') !== rowIds.sort().join(',')) {
          this.selectedRowIds = rowIds;
        }
      }
    }

    const update = () => {
      if ((this.selectedRowIds || []).length > 0 && !inHandler) {
        inHandler = true;
        let selectedRows = this.mapIdsToRows(this.selectedRowIds || []);
        if (!preserveHidden) {
          let selectedRowsChangedArgs = {
            grid: this._grid,
            ids: this.mapRowsToIds(selectedRows),
            rows: selectedRows,
            dataView: this
          };
          this.preSelectedRowIdsChangeFn!(selectedRowsChangedArgs);
          this.onSelectedRowIdsChanged.notify(Object.assign(selectedRowsChangedArgs, {
            selectedRowIds: this.selectedRowIds,
            filteredIds: this.getAllSelectedFilteredIds(),
          }), new SlickEventData(), this);
        }
        grid.setSelectedRows(selectedRows);
        inHandler = false;
      }
    }

    grid.onSelectedRowsChanged.subscribe((_e: Event, args: { rows: number[]; }) => {
      if (!inHandler) {
        let newSelectedRowIds = this.mapRowsToIds(args.rows);
        let selectedRowsChangedArgs = {
          grid: this._grid,
          ids: newSelectedRowIds,
          rows: args.rows,
          added: true,
          dataView: this
        };
        this.preSelectedRowIdsChangeFn!(selectedRowsChangedArgs);
        this.onSelectedRowIdsChanged.notify(Object.assign(selectedRowsChangedArgs, {
          selectedRowIds: this.selectedRowIds,
          filteredIds: this.getAllSelectedFilteredIds(),
        }), new SlickEventData(), this);
      }
    });

    this.preSelectedRowIdsChangeFn = (args: { ids: Array<number | string>; added?: boolean; }) => {
      if (!inHandler) {
        inHandler = true;
        const overwrite = (typeof args.added === typeof undefined);

        if (overwrite) {
          setSelectedRowIds(args.ids);
        } else {
          let rowIds: Array<number | string>;
          if (args.added) {
            if (preserveHiddenOnSelectionChange && grid.getOptions().multiSelect) {
              // find the ones that are hidden
              let hiddenSelectedRowIds = this.selectedRowIds?.filter((id) => this.getRowById(id) === undefined);
              // add the newly selected ones
              rowIds = hiddenSelectedRowIds!.concat(args.ids);
            } else {
              rowIds = args.ids;
            }
          } else {
            if (preserveHiddenOnSelectionChange && grid.getOptions().multiSelect) {
              // remove rows whose id is on the list
              rowIds = this.selectedRowIds!.filter((id) => args.ids.indexOf(id) === -1);
            } else {
              rowIds = [];
            }
          }
          setSelectedRowIds(rowIds);
        }
        inHandler = false;
      }
    };

    this.onRowsOrCountChanged.subscribe(update.bind(this));

    return this.onSelectedRowIdsChanged;
  }

  /**
   * Get all selected IDs
   * Note: when using Pagination it will also include hidden selections assuming `preserveHiddenOnSelectionChange` is set to true.
   */
  getAllSelectedIds() {
    return this.selectedRowIds;
  }

  /**
   * Get all selected filtered IDs (similar to "getAllSelectedIds" but only return filtered data)
   * Note: when using Pagination it will also include hidden selections assuming `preserveHiddenOnSelectionChange` is set to true.
   */
  getAllSelectedFilteredIds() {
    return this.getAllSelectedFilteredItems().map((item) => item[this.idProperty]);
  }

  /**
   * Set current row selected IDs array (regardless of Pagination)
   * NOTE: This will NOT change the selection in the grid, if you need to do that then you still need to call
   * "grid.setSelectedRows(rows)"
   * @param {Array} selectedIds - list of IDs which have been selected for this action
   * @param {Object} options
   *  - `isRowBeingAdded`: defaults to true, are the new selected IDs being added (or removed) as new row selections
   *  - `shouldTriggerEvent`: defaults to true, should we trigger `onSelectedRowIdsChanged` event
   *  - `applyRowSelectionToGrid`: defaults to true, should we apply the row selections to the grid in the UI
   */
  setSelectedIds(selectedIds: Array<number | string>, options: Partial<{ isRowBeingAdded: boolean; shouldTriggerEvent: boolean; applyRowSelectionToGrid: boolean; }>) {
    let isRowBeingAdded = options?.isRowBeingAdded;
    const shouldTriggerEvent = options?.shouldTriggerEvent;
    const applyRowSelectionToGrid = options?.applyRowSelectionToGrid;

    if (isRowBeingAdded !== false) {
      isRowBeingAdded = true;
    }
    const selectedRows = this.mapIdsToRows(selectedIds);
    const selectedRowsChangedArgs = {
      grid: this._grid,
      ids: selectedIds,
      rows: selectedRows,
      added: isRowBeingAdded,
      dataView: this
    };
    this.preSelectedRowIdsChangeFn?.(selectedRowsChangedArgs);

    if (shouldTriggerEvent !== false) {
      this.onSelectedRowIdsChanged.notify(Object.assign(selectedRowsChangedArgs, {
        "selectedRowIds": this.selectedRowIds,
        "filteredIds": this.getAllSelectedFilteredIds(),
      }), new SlickEventData(), this);
    }

    // should we also apply the row selection in to the grid (UI) as well?
    if (applyRowSelectionToGrid !== false && this._grid) {
      this._grid.setSelectedRows(selectedRows);
    }
  }

  /**
   * Get all selected dataContext items
   * Note: when using Pagination it will also include hidden selections assuming `preserveHiddenOnSelectionChange` is set to true.
   */
  getAllSelectedItems() {
    const selectedData: T[] = [];
    const selectedIds = this.getAllSelectedIds();
    selectedIds!.forEach((id) => {
      selectedData.push(this.getItemById(id));
    });
    return selectedData;
  }

  /**
  * Get all selected filtered dataContext items (similar to "getAllSelectedItems" but only return filtered data)
  * Note: when using Pagination it will also include hidden selections assuming `preserveHiddenOnSelectionChange` is set to true.
  */
  getAllSelectedFilteredItems() {
    if (!Array.isArray(this.selectedRowIds)) {
      return [];
    }

    const intersection = this.filteredItems.filter((a) => this.selectedRowIds!.some((b) => a[this.idProperty] === b));
    return intersection || [];
  }

  syncGridCellCssStyles(grid: SlickGrid, key: string) {
    let hashById: any;
    let inHandler: boolean;

    const storeCellCssStyles = (hash: CssStyleHash) => {
      hashById = {};
      for (let row in hash) {
        let id = this.rows[row][this.idProperty];
        hashById[id] = hash[row];
      }
    }

    // since this method can be called after the cell styles have been set,
    // get the existing ones right away
    storeCellCssStyles(grid.getCellCssStyles(key));

    const update = () => {
      if (hashById) {
        inHandler = true;
        this.ensureRowsByIdCache();
        let newHash = {};
        for (let id in hashById) {
          let row = this.rowsById[id];
          if (row != undefined) {
            newHash[row] = hashById[id];
          }
        }
        grid.setCellCssStyles(key, newHash);
        inHandler = false;
      }
    }

    grid.onCellCssStylesChanged.subscribe((e, args) => {
      if (inHandler) { return; }
      if (key != args.key) { return; }
      if (args.hash) {
        storeCellCssStyles(args.hash);
      } else {
        grid.onCellCssStylesChanged.unsubscribe();
        this.onRowsOrCountChanged.unsubscribe(update);
      }
    });

    this.onRowsOrCountChanged.subscribe(update.bind(this));
  }
}

export class AvgAggregator<T = any> implements Aggregator {
  private _nonNullCount = 0;
  private _sum = 0;
  private _field: number | string;
  private _type = 'avg';

  constructor(field: number | string) {
    this._field = field;
  }

  get field(): number | string {
    return this._field;
  }

  get type(): string {
    return this._type;
  }

  init(): void {
    this._nonNullCount = 0;
    this._sum = 0;
  }

  accumulate(item: T) {
    const val = (item && item.hasOwnProperty(this._field)) ? item[this._field] : null;
    if (val !== null && val !== '' && !isNaN(val)) {
      this._nonNullCount++;
      this._sum += parseFloat(val);
    }
  }

  storeResult(groupTotals: SlickGroupTotals_) {
    if (!groupTotals || groupTotals[this._type] === undefined) {
      groupTotals[this._type] = {};
    }
    if (this._nonNullCount !== 0) {
      groupTotals[this._type][this._field] = this._sum / this._nonNullCount;
    }
  }
}

export class MinAggregator<T = any> implements Aggregator {
  private _min: number | null = null;
  private _field: number | string;
  private _type = 'min';

  constructor(field: number | string) {
    this._field = field;
  }

  get field(): number | string {
    return this._field;
  }

  get type(): string {
    return this._type;
  }

  init() {
    this._min = null;
  }

  accumulate(item: T) {
    const val = (item && item.hasOwnProperty(this._field)) ? item[this._field] : null;
    if (val !== null && val !== '' && !isNaN(val)) {
      if (this._min === null || val < this._min) {
        this._min = parseFloat(val);
      }
    }
  }

  storeResult(groupTotals: SlickGroupTotals_) {
    if (!groupTotals || groupTotals[this._type] === undefined) {
      groupTotals[this._type] = {};
    }
    groupTotals[this._type][this._field] = this._min;
  }
}

export class MaxAggregator<T = any> implements Aggregator {
  private _max: number | null = null;
  private _field: number | string;
  private _type = 'max';

  constructor(field: number | string) {
    this._field = field;
  }

  get field(): number | string {
    return this._field;
  }

  get type(): string {
    return this._type;
  }

  init(): void {
    this._max = null;
  }

  accumulate(item: T) {
    const val = (item && item.hasOwnProperty(this._field)) ? item[this._field] : null;
    if (val !== null && val !== '' && !isNaN(val)) {
      if (this._max === null || val > this._max) {
        this._max = parseFloat(val);
      }
    }
  }

  storeResult(groupTotals: SlickGroupTotals_) {
    if (!groupTotals || groupTotals[this._type] === undefined) {
      groupTotals[this._type] = {};
    }
    groupTotals[this._type][this._field] = this._max;
  }
}

export class SumAggregator<T = any> implements Aggregator {
  private _sum = 0;
  private _field: number | string;
  private _type = 'sum';

  constructor(field: number | string) {
    this._field = field;
  }

  get field(): number | string {
    return this._field;
  }

  get type(): string {
    return this._type;
  }

  init() {
    this._sum = 0;
  }

  accumulate(item: T) {
    const val = (item && item.hasOwnProperty(this._field)) ? item[this._field] : null;
    if (val !== null && val !== '' && !isNaN(val)) {
      this._sum += parseFloat(val);
    }
  }

  storeResult(groupTotals: SlickGroupTotals_) {
    if (!groupTotals || groupTotals[this._type] === undefined) {
      groupTotals[this._type] = {};
    }
    groupTotals[this._type][this._field] = this._sum;
  }
}

export class CountAggregator implements Aggregator {
  private _field: number | string;
  private _type = 'count';

  constructor(field: number | string) {
    this._field = field;
  }

  get field(): number | string {
    return this._field;
  }

  get type(): string {
    return this._type;
  }

  init(): void {
  }

  storeResult(groupTotals: SlickGroupTotals_) {
    if (!groupTotals || groupTotals[this._type] === undefined) {
      groupTotals[this._type] = {};
    }
    groupTotals[this._type][this._field] = groupTotals.group.rows.length;
  }
}

// TODO:  add more built-in aggregators
// TODO:  merge common aggregators in one to prevent needles iterating

export const Aggregators = {
  Avg: AvgAggregator,
  Min: MinAggregator,
  Max: MaxAggregator,
  Sum: SumAggregator,
  Count: CountAggregator
};

// extend Slick namespace on window object when building as iife
if (IIFE_ONLY && window.Slick) {
  window.Slick.Data = window.Slick.Data || {};
  window.Slick.Data.DataView = SlickDataView;
  window.Slick.Data.Aggregators = Aggregators;
}
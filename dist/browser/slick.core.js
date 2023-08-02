"use strict";
var Slick = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: !0, configurable: !0, writable: !0, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  }, __copyProps = (to, from, except, desc) => {
    if (from && typeof from == "object" || typeof from == "function")
      for (let key of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);
  var __publicField = (obj, key, value) => (__defNormalProp(obj, typeof key != "symbol" ? key + "" : key, value), value);

  // src/slick.core.ts
  var slick_core_exports = {};
  __export(slick_core_exports, {
    BindingEventService: () => BindingEventService,
    ColAutosizeMode: () => ColAutosizeMode,
    EditorLock: () => EditorLock,
    Event: () => Event,
    EventData: () => EventData,
    EventHandler: () => EventHandler,
    GlobalEditorLock: () => GlobalEditorLock,
    GridAutosizeColsMode: () => GridAutosizeColsMode,
    Group: () => Group,
    GroupTotals: () => GroupTotals,
    NonDataRow: () => NonDataRow,
    Range: () => Range,
    RegexSanitizer: () => RegexSanitizer,
    RowSelectionMode: () => RowSelectionMode,
    SlickEditorLock: () => SlickEditorLock,
    SlickEvent: () => SlickEvent,
    SlickEventData: () => SlickEventData,
    SlickEventHandler: () => SlickEventHandler,
    SlickGlobalEditorLock: () => SlickGlobalEditorLock,
    SlickGroup: () => SlickGroup,
    SlickGroupTotals: () => SlickGroupTotals,
    SlickNonDataItem: () => SlickNonDataItem,
    SlickRange: () => SlickRange,
    Utils: () => Utils,
    ValueFilterMode: () => ValueFilterMode,
    WidthEvalMode: () => WidthEvalMode,
    keyCode: () => keyCode,
    preClickClassName: () => preClickClassName
  });
  var SlickEventData = class {
    constructor(event, args) {
      this.event = event;
      this.args = args;
      __publicField(this, "_isPropagationStopped", !1);
      __publicField(this, "_isImmediatePropagationStopped", !1);
      __publicField(this, "_isDefaultPrevented", !1);
      __publicField(this, "returnValues", []);
      __publicField(this, "returnValue");
      __publicField(this, "target");
      __publicField(this, "nativeEvent");
      __publicField(this, "arguments_");
      if (this.nativeEvent = event, this.arguments_ = args, event) {
        let eventProps = [
          "altKey",
          "ctrlKey",
          "metaKey",
          "shiftKey",
          "key",
          "keyCode",
          "clientX",
          "clientY",
          "offsetX",
          "offsetY",
          "pageX",
          "pageY",
          "bubbles",
          "type",
          "which",
          "x",
          "y"
        ];
        for (let key of eventProps)
          this[key] = event[key];
      }
      this.target = this.nativeEvent ? this.nativeEvent.target : void 0;
    }
    /**
     * Stops event from propagating up the DOM tree.
     * @method stopPropagation
     */
    stopPropagation() {
      this._isPropagationStopped = !0, this.nativeEvent && this.nativeEvent.stopPropagation();
    }
    /**
     * Returns whether stopPropagation was called on this event object.
     * @method isPropagationStopped
     * @return {Boolean}
     */
    isPropagationStopped() {
      return this._isPropagationStopped;
    }
    /**
     * Prevents the rest of the handlers from being executed.
     * @method stopImmediatePropagation
     */
    stopImmediatePropagation() {
      this._isImmediatePropagationStopped = !0, this.nativeEvent && this.nativeEvent.stopImmediatePropagation();
    }
    /**
     * Returns whether stopImmediatePropagation was called on this event object.\
     * @method isImmediatePropagationStopped
     * @return {Boolean}
     */
    isImmediatePropagationStopped() {
      return this._isImmediatePropagationStopped;
    }
    getNativeEvent() {
      return this.nativeEvent;
    }
    preventDefault() {
      this.nativeEvent && this.nativeEvent.preventDefault(), this._isDefaultPrevented = !0;
    }
    isDefaultPrevented() {
      return this.nativeEvent ? this.nativeEvent.defaultPrevented : this._isDefaultPrevented;
    }
    addReturnValue(value) {
      this.returnValues.push(value), this.returnValue === void 0 && value !== void 0 && (this.returnValue = value);
    }
    getReturnValue() {
      return this.returnValue;
    }
    getArguments() {
      return this.arguments_;
    }
  }, SlickEvent = class {
    constructor() {
      __publicField(this, "handlers", []);
    }
    /**
     * Adds an event handler to be called when the event is fired.
     * <p>Event handler will receive two arguments - an <code>EventData</code> and the <code>data</code>
     * object the event was fired with.<p>
     * @method subscribe
     * @param fn {Function} Event handler.
     */
    subscribe(fn) {
      this.handlers.push(fn);
    }
    /**
     * Removes an event handler added with <code>subscribe(fn)</code>.
     * @method unsubscribe
     * @param fn {Function} Event handler to be removed.
     */
    unsubscribe(fn) {
      for (let i = this.handlers.length - 1; i >= 0; i--)
        this.handlers[i] === fn && this.handlers.splice(i, 1);
    }
    /**
     * Fires an event notifying all subscribers.
     * @method notify
     * @param args {Object} Additional data object to be passed to all handlers.
     * @param e {EventData}
     *      Optional.
     *      An <code>EventData</code> object to be passed to all handlers.
     *      For DOM events, an existing W3C event object can be passed in.
     * @param scope {Object}
     *      Optional.
     *      The scope ("this") within which the handler will be executed.
     *      If not specified, the scope will be set to the <code>Event</code> instance.
     */
    notify(args, evt, scope) {
      let sed = evt instanceof SlickEventData ? evt : new SlickEventData(evt, args);
      scope = scope || this;
      for (let i = 0; i < this.handlers.length && !(sed.isPropagationStopped() || sed.isImmediatePropagationStopped()); i++) {
        let returnValue = this.handlers[i].call(scope, sed, args);
        sed.addReturnValue(returnValue);
      }
      return sed;
    }
  }, SlickEventHandler = class {
    constructor() {
      __publicField(this, "handlers", []);
    }
    subscribe(event, handler) {
      return this.handlers.push({ event, handler }), event.subscribe(handler), this;
    }
    unsubscribe(event, handler) {
      let i = this.handlers.length;
      for (; i--; )
        if (this.handlers[i].event === event && this.handlers[i].handler === handler) {
          this.handlers.splice(i, 1), event.unsubscribe(handler);
          return;
        }
      return this;
    }
    unsubscribeAll() {
      let i = this.handlers.length;
      for (; i--; )
        this.handlers[i].event.unsubscribe(this.handlers[i].handler);
      return this.handlers = [], this;
    }
  }, SlickRange = class {
    constructor(fromRow, fromCell, toRow, toCell) {
      __publicField(this, "fromRow");
      __publicField(this, "fromCell");
      __publicField(this, "toCell");
      __publicField(this, "toRow");
      toRow === void 0 && toCell === void 0 && (toRow = fromRow, toCell = fromCell), this.fromRow = Math.min(fromRow, toRow), this.fromCell = Math.min(fromCell, toCell), this.toRow = Math.max(fromRow, toRow), this.toCell = Math.max(fromCell, toCell);
    }
    /**
     * Returns whether a range represents a single row.
     * @method isSingleRow
     * @return {Boolean}
     */
    isSingleRow() {
      return this.fromRow == this.toRow;
    }
    /**
     * Returns whether a range represents a single cell.
     * @method isSingleCell
     * @return {Boolean}
     */
    isSingleCell() {
      return this.fromRow == this.toRow && this.fromCell == this.toCell;
    }
    /**
     * Returns whether a range contains a given cell.
     * @method contains
     * @param row {Integer}
     * @param cell {Integer}
     * @return {Boolean}
     */
    contains(row, cell) {
      return row >= this.fromRow && row <= this.toRow && cell >= this.fromCell && cell <= this.toCell;
    }
    /**
     * Returns a readable representation of a range.
     * @method toString
     * @return {String}
     */
    toString() {
      return this.isSingleCell() ? `(${this.fromRow}:${this.fromCell})` : `(${this.fromRow}:${this.fromCell} - ${this.toRow}:${this.toCell})`;
    }
  }, SlickNonDataItem = class {
    constructor() {
      __publicField(this, "__nonDataRow", !0);
    }
  }, SlickGroup = class extends SlickNonDataItem {
    constructor() {
      super();
      __publicField(this, "__group", !0);
      /**
       * Grouping level, starting with 0.
       * @property level
       * @type {Number}
       */
      __publicField(this, "level", 0);
      /**
       * Number of rows in the group.
       * @property count
       * @type {Integer}
       */
      __publicField(this, "count", 0);
      /**
       * Grouping value.
       * @property value
       * @type {Object}
       */
      __publicField(this, "value", null);
      /**
       * Formatted display value of the group.
       * @property title
       * @type {String}
       */
      __publicField(this, "title", null);
      /**
       * Whether a group is collapsed.
       * @property collapsed
       * @type {Boolean}
       */
      __publicField(this, "collapsed", !1);
      /**
       * Whether a group selection checkbox is checked.
       * @property selectChecked
       * @type {Boolean}
       */
      __publicField(this, "selectChecked", !1);
      /**
       * GroupTotals, if any.
       * @property totals
       * @type {GroupTotals}
       */
      __publicField(this, "totals", null);
      /**
       * Rows that are part of the group.
       * @property rows
       * @type {Array}
       */
      __publicField(this, "rows", []);
      /**
       * Sub-groups that are part of the group.
       * @property groups
       * @type {Array}
       */
      __publicField(this, "groups", null);
      /**
       * A unique key used to identify the group.  This key can be used in calls to DataView
       * collapseGroup() or expandGroup().
       * @property groupingKey
       * @type {Object}
       */
      __publicField(this, "groupingKey", null);
    }
    /**
     * Compares two Group instances.
     * @method equals
     * @return {Boolean}
     * @param group {Group} Group instance to compare to.
     */
    equals(group) {
      return this.value === group.value && this.count === group.count && this.collapsed === group.collapsed && this.title === group.title;
    }
  }, SlickGroupTotals = class extends SlickNonDataItem {
    constructor() {
      super();
      __publicField(this, "__groupTotals", !0);
      /**
       * Parent Group.
       * @param group
       * @type {Group}
       */
      __publicField(this, "group", null);
      /**
       * Whether the totals have been fully initialized / calculated.
       * Will be set to false for lazy-calculated group totals.
       * @param initialized
       * @type {Boolean}
       */
      __publicField(this, "initialized", !1);
    }
  }, SlickEditorLock = class {
    constructor() {
      __publicField(this, "activeEditController", null);
    }
    /**
     * Returns true if a specified edit controller is active (has the edit lock).
     * If the parameter is not specified, returns true if any edit controller is active.
     * @method isActive
     * @param editController {EditController}
     * @return {Boolean}
     */
    isActive(editController) {
      return editController ? this.activeEditController === editController : this.activeEditController !== null;
    }
    /**
     * Sets the specified edit controller as the active edit controller (acquire edit lock).
     * If another edit controller is already active, and exception will be throw new Error(.
     * @method activate
     * @param editController {EditController} edit controller acquiring the lock
     */
    activate(editController) {
      if (editController !== this.activeEditController) {
        if (this.activeEditController !== null)
          throw new Error("Slick.EditorLock.activate: an editController is still active, can't activate another editController");
        if (!editController.commitCurrentEdit)
          throw new Error("Slick.EditorLock.activate: editController must implement .commitCurrentEdit()");
        if (!editController.cancelCurrentEdit)
          throw new Error("Slick.EditorLock.activate: editController must implement .cancelCurrentEdit()");
        this.activeEditController = editController;
      }
    }
    /**
     * Unsets the specified edit controller as the active edit controller (release edit lock).
     * If the specified edit controller is not the active one, an exception will be throw new Error(.
     * @method deactivate
     * @param editController {EditController} edit controller releasing the lock
     */
    deactivate(editController) {
      if (this.activeEditController) {
        if (this.activeEditController !== editController)
          throw new Error("Slick.EditorLock.deactivate: specified editController is not the currently active one");
        this.activeEditController = null;
      }
    }
    /**
     * Attempts to commit the current edit by calling "commitCurrentEdit" method on the active edit
     * controller and returns whether the commit attempt was successful (commit may fail due to validation
     * errors, etc.).  Edit controller's "commitCurrentEdit" must return true if the commit has succeeded
     * and false otherwise.  If no edit controller is active, returns true.
     * @method commitCurrentEdit
     * @return {Boolean}
     */
    commitCurrentEdit() {
      return this.activeEditController ? this.activeEditController.commitCurrentEdit() : !0;
    }
    /**
     * Attempts to cancel the current edit by calling "cancelCurrentEdit" method on the active edit
     * controller and returns whether the edit was successfully cancelled.  If no edit controller is
     * active, returns true.
     * @method cancelCurrentEdit
     * @return {Boolean}
     */
    cancelCurrentEdit() {
      return this.activeEditController ? this.activeEditController.cancelCurrentEdit() : !0;
    }
  };
  function regexSanitizer(dirtyHtml) {
    return dirtyHtml.replace(/(\b)(on[a-z]+)(\s*)=|javascript:([^>]*)[^>]*|(<\s*)(\/*)script([<>]*).*(<\s*)(\/*)script(>*)|(&lt;)(\/*)(script|script defer)(.*)(&gt;|&gt;">)/gi, "");
  }
  function calculateAvailableSpace(element) {
    let bottom = 0, top = 0, left = 0, right = 0, windowHeight = window.innerHeight || 0, windowWidth = window.innerWidth || 0, scrollPosition = windowScrollPosition(), pageScrollTop = scrollPosition.top, pageScrollLeft = scrollPosition.left, elmOffset = offset(element);
    if (elmOffset) {
      let elementOffsetTop = elmOffset.top || 0, elementOffsetLeft = elmOffset.left || 0;
      top = elementOffsetTop - pageScrollTop, bottom = windowHeight - (elementOffsetTop - pageScrollTop), left = elementOffsetLeft - pageScrollLeft, right = windowWidth - (elementOffsetLeft - pageScrollLeft);
    }
    return { top, bottom, left, right };
  }
  function createDomElement(tagName, elementOptions, appendToParent) {
    let elm = document.createElement(tagName);
    return elementOptions && Object.keys(elementOptions).forEach((elmOptionKey) => {
      let elmValue = elementOptions[elmOptionKey];
      typeof elmValue == "object" ? Object.assign(elm[elmOptionKey], elmValue) : elm[elmOptionKey] = elementOptions[elmOptionKey];
    }), appendToParent != null && appendToParent.appendChild && appendToParent.appendChild(elm), elm;
  }
  function emptyElement(element) {
    if (element != null && element.firstChild)
      for (; element.firstChild; )
        element.lastChild && element.removeChild(element.lastChild);
    return element;
  }
  function innerSize(elm, type) {
    let size = 0;
    if (elm) {
      let clientSize = type === "height" ? "clientHeight" : "clientWidth", sides = type === "height" ? ["top", "bottom"] : ["left", "right"];
      size = elm[clientSize];
      for (let side of sides) {
        let sideSize = parseFloat(getElementProp(elm, `padding-${side}`) || "") || 0;
        size -= sideSize;
      }
    }
    return size;
  }
  function getElementProp(elm, property) {
    return elm != null && elm.getComputedStyle ? window.getComputedStyle(elm, null).getPropertyValue(property) : null;
  }
  function isEmptyObject(obj) {
    return obj == null ? !0 : Object.entries(obj).length === 0;
  }
  function noop() {
  }
  function offset(el) {
    if (!el || !el.getBoundingClientRect)
      return;
    let box = el.getBoundingClientRect(), docElem = document.documentElement;
    return {
      top: box.top + window.pageYOffset - docElem.clientTop,
      left: box.left + window.pageXOffset - docElem.clientLeft
    };
  }
  function windowScrollPosition() {
    return {
      left: window.pageXOffset || document.documentElement.scrollLeft || 0,
      top: window.pageYOffset || document.documentElement.scrollTop || 0
    };
  }
  function width(el, value) {
    if (!(!el || !el.getBoundingClientRect)) {
      if (value === void 0)
        return el.getBoundingClientRect().width;
      setStyleSize(el, "width", value);
    }
  }
  function height(el, value) {
    if (el) {
      if (value === void 0)
        return el.getBoundingClientRect().height;
      setStyleSize(el, "height", value);
    }
  }
  function setStyleSize(el, style, val) {
    typeof val == "function" ? val = val() : typeof val == "string" ? el.style[style] = val : el.style[style] = val + "px";
  }
  function contains(parent, child) {
    return !parent || !child ? !1 : !parents(child).every(function(p) {
      return parent != p;
    });
  }
  function isHidden(el) {
    return el.offsetWidth === 0 && el.offsetHeight === 0;
  }
  function parents(el, selector) {
    let parents2 = [], visible = selector == ":visible", hidden = selector == ":hidden";
    for (; (el = el.parentNode) && el !== document && !(!el || !el.parentNode); )
      hidden ? isHidden(el) && parents2.push(el) : visible ? isHidden(el) || parents2.push(el) : (!selector || el.matches(selector)) && parents2.push(el);
    return parents2;
  }
  function toFloat(value) {
    let x = parseFloat(value);
    return isNaN(x) ? 0 : x;
  }
  function show(el, type = "") {
    Array.isArray(el) ? el.forEach((e) => e.style.display = type) : el.style.display = type;
  }
  function hide(el) {
    Array.isArray(el) ? el.forEach(function(e) {
      e.style.display = "none";
    }) : el.style.display = "none";
  }
  function slideUp(el, callback) {
    return slideAnimation(el, "slideUp", callback);
  }
  function slideDown(el, callback) {
    return slideAnimation(el, "slideDown", callback);
  }
  function slideAnimation(el, slideDirection, callback) {
    if (window.jQuery !== void 0) {
      window.jQuery(el)[slideDirection]("fast", callback);
      return;
    }
    slideDirection === "slideUp" ? hide(el) : show(el), callback();
  }
  var getProto = Object.getPrototypeOf, class2type = {}, toString = class2type.toString, hasOwn = class2type.hasOwnProperty, fnToString = hasOwn.toString, ObjectFunctionString = fnToString.call(Object);
  function isFunction(obj) {
    return typeof obj == "function" && typeof obj.nodeType != "number" && typeof obj.item != "function";
  }
  function isPlainObject(obj) {
    if (!obj || toString.call(obj) !== "[object Object]")
      return !1;
    let proto = getProto(obj);
    if (!proto)
      return !0;
    let Ctor = hasOwn.call(proto, "constructor") && proto.constructor;
    return typeof Ctor == "function" && fnToString.call(Ctor) === ObjectFunctionString;
  }
  function extend(...args) {
    let options, name, src, copy, copyIsArray, clone, target = args[0], i = 1, deep = !1, length = args.length;
    for (typeof target == "boolean" ? (deep = target, target = args[i] || {}, i++) : target = target || {}, typeof target != "object" && !isFunction(target) && (target = {}), i === length && (target = this, i--); i < length; i++)
      if ((options = args[i]) != null)
        for (name in options)
          copy = options[name], !(name === "__proto__" || target === copy) && (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy))) ? (src = target[name], copyIsArray && !Array.isArray(src) ? clone = [] : !copyIsArray && !isPlainObject(src) ? clone = {} : clone = src, copyIsArray = !1, target[name] = extend(deep, clone, copy)) : copy !== void 0 && (target[name] = copy));
    return target;
  }
  var BindingEventService = class {
    constructor() {
      __publicField(this, "_boundedEvents", []);
    }
    getBoundedEvents() {
      return this._boundedEvents;
    }
    destroy() {
      this.unbindAll();
    }
    /** Bind an event listener to any element */
    bind(element, eventName, listener, options) {
      element.addEventListener(eventName, listener, options), this._boundedEvents.push({ element, eventName, listener });
    }
    /** Unbind all will remove every every event handlers that were bounded earlier */
    unbind(element, eventName, listener) {
      element != null && element.removeEventListener && element.removeEventListener(eventName, listener);
    }
    unbindByEventName(element, eventName) {
      let boundedEvent = this._boundedEvents.find((e) => e.element === element && e.eventName === eventName);
      boundedEvent && this.unbind(boundedEvent.element, boundedEvent.eventName, boundedEvent.listener);
    }
    /** Unbind all will remove every every event handlers that were bounded earlier */
    unbindAll() {
      for (; this._boundedEvents.length > 0; ) {
        let boundedEvent = this._boundedEvents.pop();
        this.unbind(boundedEvent.element, boundedEvent.eventName, boundedEvent.listener);
      }
    }
  }, SlickGlobalEditorLock = new SlickEditorLock(), SlickCore = {
    Event: SlickEvent,
    EventData: SlickEventData,
    EventHandler: SlickEventHandler,
    Range: SlickRange,
    NonDataRow: SlickNonDataItem,
    Group: SlickGroup,
    GroupTotals: SlickGroupTotals,
    EditorLock: SlickEditorLock,
    RegexSanitizer: regexSanitizer,
    // BindingEventService: BindingEventService,
    Utils: {
      extend,
      calculateAvailableSpace,
      createDomElement,
      emptyElement,
      innerSize,
      isEmptyObject,
      noop,
      offset,
      height,
      width,
      setStyleSize,
      contains,
      toFloat,
      parents,
      show,
      hide,
      slideUp,
      slideDown,
      windowScrollPosition,
      storage: {
        // https://stackoverflow.com/questions/29222027/vanilla-alternative-to-jquery-data-function-any-native-javascript-alternati
        _storage: /* @__PURE__ */ new WeakMap(),
        put: function(element, key, obj) {
          this._storage.has(element) || this._storage.set(element, /* @__PURE__ */ new Map()), this._storage.get(element).set(key, obj);
        },
        get: function(element, key) {
          let el = this._storage.get(element);
          return el ? el.get(key) : null;
        },
        remove: function(element, key) {
          let ret = this._storage.get(element).delete(key);
          return this._storage.get(element).size !== 0 && this._storage.delete(element), ret;
        }
      }
    },
    /**
     * A global singleton editor lock.
     * @class GlobalEditorLock
     * @static
     * @constructor
     */
    GlobalEditorLock: SlickGlobalEditorLock,
    keyCode: {
      SPACE: 8,
      BACKSPACE: 8,
      DELETE: 46,
      DOWN: 40,
      END: 35,
      ENTER: 13,
      ESCAPE: 27,
      HOME: 36,
      INSERT: 45,
      LEFT: 37,
      PAGE_DOWN: 34,
      PAGE_UP: 33,
      RIGHT: 39,
      TAB: 9,
      UP: 38,
      A: 65
    },
    preClickClassName: "slick-edit-preclick",
    GridAutosizeColsMode: {
      None: "NOA",
      LegacyOff: "LOF",
      LegacyForceFit: "LFF",
      IgnoreViewport: "IGV",
      FitColsToViewport: "FCV",
      FitViewportToCols: "FVC"
    },
    ColAutosizeMode: {
      Locked: "LCK",
      Guide: "GUI",
      Content: "CON",
      ContentExpandOnly: "CXO",
      ContentIntelligent: "CTI"
    },
    RowSelectionMode: {
      FirstRow: "FS1",
      FirstNRows: "FSN",
      AllRows: "ALL",
      LastRow: "LS1"
    },
    ValueFilterMode: {
      None: "NONE",
      DeDuplicate: "DEDP",
      GetGreatestAndSub: "GR8T",
      GetLongestTextAndSub: "LNSB",
      GetLongestText: "LNSC"
    },
    WidthEvalMode: {
      Auto: "AUTO",
      TextOnly: "CANV",
      HTML: "HTML"
    }
  }, {
    Utils,
    EditorLock,
    Event,
    EventData,
    EventHandler,
    Group,
    GroupTotals,
    NonDataRow,
    Range,
    RegexSanitizer,
    GlobalEditorLock,
    keyCode,
    preClickClassName,
    GridAutosizeColsMode,
    ColAutosizeMode,
    RowSelectionMode,
    ValueFilterMode,
    WidthEvalMode
  } = SlickCore;
  typeof global != "undefined" && window.Slick && (global.Slick = window.Slick);
  return __toCommonJS(slick_core_exports);
})();
//# sourceMappingURL=slick.core.js.map
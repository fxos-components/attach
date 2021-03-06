;(function() {
'use strict';

/**
 * Namespace to store
 * references under on root
 */

var ns = '_attach';

/**
 * Normalize `matchesSelector`
 */

var proto = Element.prototype;
var matches = proto.matchesSelector
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

/**
 * Bind an event listener
 * to the given element.
 *
 * Example:
 *
 *   attach(myEl, 'click', '.my-class', function(event, el) {
 *     // Do stuff
 *   });
 *
 * @param  {Element}  root
 * @param  {String}   type
 * @param  {String}   selector (optional)
 * @param  {Function} fn
 * @param  {Object}   ctx (optional)
 */
function attach(root, type, selector, fn, ctx) {
  if (arguments.length === 2) {
    return attach.many.apply(null, arguments);
  }

  // `selector` is optional
  if (typeof selector === 'function') {
    ctx = fn;
    fn = selector;
    selector = null;
  }

  // We use the key 'null' to
  // indicate that we are binding
  // an event handler to the root.
  selector = selector || 'null';

  var store = getStore(root);
  var master = store.master[type];
  var delegates = store.delegates[type] = (store.delegates[type] || {});

  // Add the function to the delegates
  delegates[selector] = fn;

  // Only one master event listener
  // is needed per event type.
  if (master) { return; }

  // Add the master callback to the
  // root node and to the store.
  master = store.master[type] = callback;
  root.addEventListener(type, master);

  /**
   * The master callback passed
   * to `addEventListener`.
   *
   * @param  {Event}   event
   */
  function callback(e) {
    var el = e.target;
    var stopPropagation = e.stopPropagation;
    var selector;
    var matched;
    var fn;

    // Override default `stopPropagation` to
    // prevent issue in WebKit where it fails
    // to set `cancelBubble` property:
    //
    // https://code.google.com/p/chromium/issues/detail?id=162270
    e.stopPropagation = function() {
      e.cancelBubble = true;

      // Call original `stopPropagation`
      stopPropagation.call(e);
    };

    // Walk up the DOM tree
    // until we hit the root
    while (el) {

      // Loop over each selector
      // bound to this e type.
      for (selector in delegates) {
        fn = delegates[selector];

        // There are two types of match. A
        // 'null' selector at the root node,
        // or a selector match on the current el.
        matched = (el === root && selector === 'null') ||
          matches.call(el, selector);

        if (matched) {

          // If the callback returns `false`,
          // call `preventDefault` and
          // `stopPropagation` on the event
          // to preserve expected behavior.
          if (fn.call(ctx || el, e, el) === false) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          // If one of the delegates called
          // `stopPropagation` on the event,
          // stop calling remaining delegates.
          if (e.cancelBubble) { return; }
        }
      }

      // Don't go any higher
      // than the root element.
      if (el === root) break;

      // Move on up!
      el = el.parentNode;
    }
  }
}

attach.on = attach;

/**
 * Unbind an event attach
 * from the given root element.
 *
 * If no selector if given, all
 * callbacks for the given event
 * type are removed.
 *
 * Example:
 *
 *   // Remove one
 *   attach.off(myEl, 'click', '.my-class');
 *
 *   // Remove all
 *   attach.off(myEl, 'click');
 *
 * @param  {Element} root
 * @param  {String} type (optional)
 * @param  {String} selector (optional)
 */
attach.off = function(root, type, selector) {
  var store = getStore(root);
  var master = store.master[type];
  var delegates = store.delegates[type];

  // Remove just one
  if (type && selector) {
    delete delegates[selector];
  }

  // Remove all of type
  else if (type) {
    delete store.delegates[type];
  }

  // Remove all
  else {
    for (type in store.master) {
      attach.off(root, type);
    }
  }

  // If there aren't any callbacks
  // of this type left, remove the master.
  if (isEmpty(store.delegates[type])) {
    root.removeEventListener(type, master);
    delete store.master[type];
  }
};

/**
 * Handles Backbone style
 * shorthand event binding.
 *
 * Example:
 *
 *   attach(myElement, {
 *     'click .foo': onFooClick,
 *     'mouseup .bar > .baz': onBazMouseUp
 *   });
 *
 * @param  {element} root
 * @param  {Object} config
 * @param  {Object} ctx
 */
attach.many = function(root, config, ctx) {
  var key;
  var parts;
  var type;
  var selector;

  for (key in config) {
    parts = key.split(' ');
    type = parts.shift();
    selector = parts.join(' ');
    attach.on(
      root,
      type,
      selector,
      config[key],
      ctx);
  }
};

/**
 * Gets the reference store
 * attached to the given node.
 *
 * If one is not found, we
 * create a fresh one.
 *
 * @param  {Element} el
 * @return {Object}
 */
function getStore(el) {
  return el[ns] || createStore(el);
}

/**
 * Creates a fresh reference
 * store on the given element.
 *
 * @param  {Element} el
 * @return {Object}
 */
function createStore(el) {
  el[ns] = { master: {}, delegates: {} };
  return el[ns];
}

/**
 * Checks if the given
 * element has no keys.
 *
 * @param  {Object}  ob
 * @return {Boolean}
 */
function isEmpty(ob) {
  for (var key in ob) { return false; }
  return true;
}

/**
 * Expose 'attach' (UMD)
 */

if (typeof exports === "object") {
  module.exports = attach;
} else if (typeof define === "function" && define.amd) {
  define(function(){ return attach; });
} else {
  window.attach = attach;
}

})();
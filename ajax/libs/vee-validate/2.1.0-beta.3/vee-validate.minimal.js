/**
  * vee-validate v2.1.0-beta.3
  * (c) 2018 Abdelrahman Awad
  * @license MIT
  */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.VeeValidate = factory());
}(this, (function () { 'use strict';

  // 

  var supportsPassive = true;

  var detectPassiveSupport = function () {
    try {
      var opts = Object.defineProperty({}, 'passive', {
        get: function get () {
          supportsPassive = true;
        }
      });
      window.addEventListener('testPassive', null, opts);
      window.removeEventListener('testPassive', null, opts);
    } catch (e) {
      supportsPassive = false;
    }
    return supportsPassive;
  };

  var addEventListener = function (el, eventName, cb) {
    el.addEventListener(eventName, cb, supportsPassive ? { passive: true } : false);
  };

  var isTextInput = function (el) {
    return ['text', 'password', 'search', 'email', 'tel', 'url', 'textarea'].indexOf(el.type) !== -1;
  };

  var isCheckboxOrRadioInput = function (el) {
    return ['radio', 'checkbox'].indexOf(el.type) !== -1;
  };

  var isDateInput = function (el) {
    return ['date', 'week', 'month', 'datetime-local', 'time'].indexOf(el.type) !== -1;
  };

  /**
   * Gets the data attribute. the name must be kebab-case.
   */
  var getDataAttribute = function (el, name) { return el.getAttribute(("data-vv-" + name)); };

  /**
   * Checks if the values are either null or undefined.
   */
  var isNullOrUndefined = function () {
    var values = [], len = arguments.length;
    while ( len-- ) values[ len ] = arguments[ len ];

    return values.every(function (value) {
      return value === null || value === undefined;
    });
  };

  /**
   * Creates the default flags object.
   */
  var createFlags = function () { return ({
    untouched: true,
    touched: false,
    dirty: false,
    pristine: true,
    valid: null,
    invalid: null,
    validated: false,
    pending: false,
    required: false,
    changed: false
  }); };

  /**
   * Shallow object comparison.
   */
  var isEqual = function (lhs, rhs) {
    if (lhs instanceof RegExp && rhs instanceof RegExp) {
      return isEqual(lhs.source, rhs.source) && isEqual(lhs.flags, rhs.flags);
    }

    if (Array.isArray(lhs) && Array.isArray(rhs)) {
      if (lhs.length !== rhs.length) { return false; }

      for (var i = 0; i < lhs.length; i++) {
        if (!isEqual(lhs[i], rhs[i])) {
          return false;
        }
      }

      return true;
    }

    // if both are objects, compare each key recursively.
    if (isObject(lhs) && isObject(rhs)) {
      return Object.keys(lhs).every(function (key) {
        return isEqual(lhs[key], rhs[key]);
      }) && Object.keys(rhs).every(function (key) {
        return isEqual(lhs[key], rhs[key]);
      });
    }

    return lhs === rhs;
  };

  /**
   * Determines the input field scope.
   */
  var getScope = function (el) {
    var scope = getDataAttribute(el, 'scope');
    if (isNullOrUndefined(scope)) {
      var form = getForm(el);

      if (form) {
        scope = getDataAttribute(form, 'scope');
      }
    }

    return !isNullOrUndefined(scope) ? scope : null;
  };

  /**
   * Get the closest form element.
   */
  var getForm = function (el) {
    if (isNullOrUndefined(el)) { return null; }

    if (el.tagName === 'FORM') { return el; }

    if (!isNullOrUndefined(el.form)) { return el.form; }

    return !isNullOrUndefined(el.parentNode) ? getForm(el.parentNode) : null;
  };

  /**
   * Gets the value in an object safely.
   */
  var getPath = function (path, target, def) {
    if ( def === void 0 ) def = undefined;

    if (!path || !target) { return def; }

    var value = target;
    path.split('.').every(function (prop) {
      if (prop in value) {
        value = value[prop];

        return true;
      }

      value = def;

      return false;
    });

    return value;
  };

  /**
   * Checks if path exists within an object.
   */
  var hasPath = function (path, target) {
    var obj = target;
    return path.split('.').every(function (prop) {
      if (prop in obj) {
        obj = obj[prop];

        return true;
      }

      return false;
    });
  };

  /**
   * Parses a rule string expression.
   */
  var parseRule = function (rule) {
    var params = [];
    var name = rule.split(':')[0];

    if (~rule.indexOf(':')) {
      params = rule.split(':').slice(1).join(':').split(',');
    }

    return { name: name, params: params };
  };

  /**
   * Debounces a function.
   */
  var debounce = function (fn, wait, immediate, token) {
    if ( wait === void 0 ) wait = 0;
    if ( immediate === void 0 ) immediate = false;
    if ( token === void 0 ) token = { cancelled: false };

    if (wait === 0) {
      return fn;
    }

    var timeout;

    return function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      var later = function () {
        timeout = null;

        if (!immediate && !token.cancelled) { fn.apply(void 0, args); }
      };
      /* istanbul ignore next */
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      /* istanbul ignore next */
      if (callNow) { fn.apply(void 0, args); }
    };
  };

  /**
   * Appends a rule definition to a list of rules.
   */
  var appendRule = function (rule, rules) {
    if (!rules) {
      return rule;
    }

    if (!rule) {
      return rules;
    }

    if (typeof rules === 'string') {
      return (rules + "|" + rule);
    }

    return assign({}, rules, normalizeRules(rule));
  };

  /**
   * Normalizes the given rules expression.
   */
  var normalizeRules = function (rules) {
    // if falsy value return an empty object.
    if (!rules) {
      return {};
    }

    if (isObject(rules)) {
      // $FlowFixMe
      return Object.keys(rules).reduce(function (prev, curr) {
        var params = [];
        // $FlowFixMe
        if (rules[curr] === true) {
          params = [];
        } else if (Array.isArray(rules[curr])) {
          params = rules[curr];
        } else {
          params = [rules[curr]];
        }

        // $FlowFixMe
        if (rules[curr] !== false) {
          prev[curr] = params;
        }

        return prev;
      }, {});
    }

    if (typeof rules !== 'string') {
      warn('rules must be either a string or an object.');
      return {};
    }

    return rules.split('|').reduce(function (prev, rule) {
      var parsedRule = parseRule(rule);
      if (!parsedRule.name) {
        return prev;
      }

      prev[parsedRule.name] = parsedRule.params;
      return prev;
    }, {});
  };

  /**
   * Emits a warning to the console.
   */
  var warn = function (message) {
    console.warn(("[vee-validate] " + message)); // eslint-disable-line
  };

  /**
   * Creates a branded error object.
   */
  var createError = function (message) { return new Error(("[vee-validate] " + message)); };

  /**
   * Checks if the value is an object.
   */
  var isObject = function (obj) { return obj !== null && obj && typeof obj === 'object' && ! Array.isArray(obj); };

  /**
   * Checks if a function is callable.
   */
  var isCallable = function (func) { return typeof func === 'function'; };

  /**
   * Check if element has the css class on it.
   */
  var hasClass = function (el, className) {
    if (el.classList) {
      return el.classList.contains(className);
    }

    return !!el.className.match(new RegExp(("(\\s|^)" + className + "(\\s|$)")));
  };

  /**
   * Adds the provided css className to the element.
   */
  var addClass = function (el, className) {
    if (el.classList) {
      el.classList.add(className);
      return;
    }

    if (!hasClass(el, className)) {
      el.className += " " + className;
    }
  };

  /**
   * Remove the provided css className from the element.
   */
  var removeClass = function (el, className) {
    if (el.classList) {
      el.classList.remove(className);
      return;
    }

    if (hasClass(el, className)) {
      var reg = new RegExp(("(\\s|^)" + className + "(\\s|$)"));
      el.className = el.className.replace(reg, ' ');
    }
  };

  /**
   * Adds or removes a class name on the input depending on the status flag.
   */
  var toggleClass = function (el, className, status) {
    if (!el || !className) { return; }

    if (Array.isArray(className)) {
      className.forEach(function (item) { return toggleClass(el, item, status); });
      return;
    }

    if (status) {
      return addClass(el, className);
    }

    removeClass(el, className);
  };

  /**
   * Converts an array-like object to array, provides a simple polyfill for Array.from
   */
  var toArray = function (arrayLike) {
    if (isCallable(Array.from)) {
      return Array.from(arrayLike);
    }

    var array = [];
    var length = arrayLike.length;
    /* istanbul ignore next */
    for (var i = 0; i < length; i++) {
      array.push(arrayLike[i]);
    }

    /* istanbul ignore next */
    return array;
  };

  /**
   * Assign polyfill from the mdn.
   */
  var assign = function (target) {
    var others = [], len = arguments.length - 1;
    while ( len-- > 0 ) others[ len ] = arguments[ len + 1 ];

    /* istanbul ignore else */
    if (isCallable(Object.assign)) {
      return Object.assign.apply(Object, [ target ].concat( others ));
    }

    /* istanbul ignore next */
    if (target == null) {
      throw new TypeError('Cannot convert undefined or null to object');
    }

    /* istanbul ignore next */
    var to = Object(target);
    /* istanbul ignore next */
    others.forEach(function (arg) {
      // Skip over if undefined or null
      if (arg != null) {
        Object.keys(arg).forEach(function (key) {
          to[key] = arg[key];
        });
      }
    });
    /* istanbul ignore next */
    return to;
  };

  var id = 0;
  var idTemplate = '{id}';

  /**
   * Generates a unique id.
   */
  var uniqId = function () {
    // handle too many uses of uniqId, although unlikely.
    if (id >= 9999) {
      id = 0;
      // shift the template.
      idTemplate = idTemplate.replace('{id}', '_{id}');
    }

    id++;
    var newId = idTemplate.replace('{id}', String(id));

    return newId;
  };

  /**
   * finds the first element that satisfies the predicate callback, polyfills array.find
   */
  var find = function (arrayLike, predicate) {
    var array = Array.isArray(arrayLike) ? arrayLike : toArray(arrayLike);
    for (var i = 0; i < array.length; i++) {
      if (predicate(array[i])) {
        return array[i];
      }
    }

    return undefined;
  };

  var isBuiltInComponent = function (vnode) {
    if (!vnode) {
      return false;
    }

    var tag = vnode.componentOptions.tag;

    return /^(keep-alive|transition|transition-group)$/.test(tag);
  };

  var makeEventsArray = function (events) {
    return (typeof events === 'string' && events.length) ? events.split('|') : [];
  };

  var makeDelayObject = function (events, delay, delayConfig) {
    if (typeof delay === 'number') {
      return events.reduce(function (prev, e) {
        prev[e] = delay;
        return prev;
      }, {});
    }

    return events.reduce(function (prev, e) {
      if (typeof delay === 'object' && e in delay) {
        prev[e] = delay[e];
        return prev;
      }

      if (typeof delayConfig === 'number') {
        prev[e] = delayConfig;
        return prev;
      }

      prev[e] = (delayConfig && delayConfig[e]) || 0;

      return prev;
    }, {});
  };

  var deepParseInt = function (input) {
    if (typeof input === 'number') { return input; }

    if (typeof input === 'string') { return parseInt(input); }

    var map = {};
    for (var element in input) {
      map[element] = parseInt(input[element]);
    }

    return map;
  };

  var merge = function (target, source) {
    if (! (isObject(target) && isObject(source))) {
      return target;
    }

    Object.keys(source).forEach(function (key) {
      var obj, obj$1;

      if (isObject(source[key])) {
        if (! target[key]) {
          assign(target, ( obj = {}, obj[key] = {}, obj ));
        }

        merge(target[key], source[key]);
        return;
      }

      assign(target, ( obj$1 = {}, obj$1[key] = source[key], obj$1 ));
    });

    return target;
  };

  var fillRulesFromElement = function (el, rules) {
    if (el.required) {
      rules = appendRule('required', rules);
    }

    if (isTextInput(el)) {
      if (el.type === 'email') {
        rules = appendRule(("email" + (el.multiple ? ':multiple' : '')), rules);
      }

      if (el.pattern) {
        rules = appendRule(("regex:" + (el.pattern)), rules);
      }

      // 524288 is the max on some browsers and test environments.
      if (el.maxLength >= 0 && el.maxLength < 524288) {
        rules = appendRule(("max:" + (el.maxLength)), rules);
      }

      if (el.minLength > 0) {
        rules = appendRule(("min:" + (el.minLength)), rules);
      }

      return rules;
    }

    if (el.type === 'number') {
      rules = appendRule('decimal', rules);
      if (el.min !== '') {
        rules = appendRule(("min_value:" + (el.min)), rules);
      }

      if (el.max !== '') {
        rules = appendRule(("max_value:" + (el.max)), rules);
      }

      return rules;
    }

    if (isDateInput(el)) {
      var timeFormat = el.step && Number(el.step) < 60 ? 'HH:mm:ss' : 'HH:mm';

      if (el.type === 'date') {
        return appendRule('date_format:YYYY-MM-DD', rules);
      }

      if (el.type === 'datetime-local') {
        return appendRule(("date_format:YYYY-MM-DDT" + timeFormat), rules);
      }

      if (el.type === 'month') {
        return appendRule('date_format:YYYY-MM', rules);
      }

      if (el.type === 'week') {
        return appendRule('date_format:YYYY-[W]WW', rules);
      }

      if (el.type === 'time') {
        return appendRule(("date_format:" + timeFormat), rules);
      }
    }

    return rules;
  };

  var values = function (obj) {
    if (isCallable(Object.values)) {
      return Object.values(obj);
    }

    // fallback to keys()
    /* istanbul ignore next */
    return obj[Object.keys(obj)[0]];
  };

  var parseSelector = function (selector) {
    var rule = null;
    if (selector.indexOf(':') !== -1) {
      rule = selector.split(':').pop();
      selector = selector.replace((":" + rule), '');
    }

    if (selector[0] === '#') {
      return {
        id: selector.slice(1),
        rule: rule,
        name: null,
        scope: null
      };
    }

    var scope = null;
    var name = selector;
    if (selector.indexOf('.') !== -1) {
      var parts = selector.split('.');
      scope = parts[0];
      name = parts.slice(1).join('.');
    }

    return {
      id: null,
      scope: scope,
      name: name,
      rule: rule
    };
  };

  // 

  var LOCALE = 'en';

  var Dictionary = function Dictionary (dictionary) {
    if ( dictionary === void 0 ) dictionary = {};

    this.container = {};
    this.merge(dictionary);
  };

  var prototypeAccessors = { locale: { configurable: true } };

  prototypeAccessors.locale.get = function () {
    return LOCALE;
  };

  prototypeAccessors.locale.set = function (value) {
    LOCALE = value || 'en';
  };

  Dictionary.prototype.hasLocale = function hasLocale (locale) {
    return !!this.container[locale];
  };

  Dictionary.prototype.setDateFormat = function setDateFormat (locale, format) {
    if (!this.container[locale]) {
      this.container[locale] = {};
    }

    this.container[locale].dateFormat = format;
  };

  Dictionary.prototype.getDateFormat = function getDateFormat (locale) {
    if (!this.container[locale] || !this.container[locale].dateFormat) {
      return null;
    }

    return this.container[locale].dateFormat;
  };

  Dictionary.prototype.getMessage = function getMessage (locale, key, data) {
    var message = null;
    if (!this.hasMessage(locale, key)) {
      message = this._getDefaultMessage(locale);
    } else {
      message = this.container[locale].messages[key];
    }

    return isCallable(message) ? message.apply(void 0, data) : message;
  };

  /**
   * Gets a specific message for field. falls back to the rule message.
   */
  Dictionary.prototype.getFieldMessage = function getFieldMessage (locale, field, key, data) {
    if (!this.hasLocale(locale)) {
      return this.getMessage(locale, key, data);
    }

    var dict = this.container[locale].custom && this.container[locale].custom[field];
    if (!dict || !dict[key]) {
      return this.getMessage(locale, key, data);
    }

    var message = dict[key];
    return isCallable(message) ? message.apply(void 0, data) : message;
  };

  Dictionary.prototype._getDefaultMessage = function _getDefaultMessage (locale) {
    if (this.hasMessage(locale, '_default')) {
      return this.container[locale].messages._default;
    }

    return this.container.en.messages._default;
  };

  Dictionary.prototype.getAttribute = function getAttribute (locale, key, fallback) {
      if ( fallback === void 0 ) fallback = '';

    if (!this.hasAttribute(locale, key)) {
      return fallback;
    }

    return this.container[locale].attributes[key];
  };

  Dictionary.prototype.hasMessage = function hasMessage (locale, key) {
    return !! (
      this.hasLocale(locale) &&
            this.container[locale].messages &&
            this.container[locale].messages[key]
    );
  };

  Dictionary.prototype.hasAttribute = function hasAttribute (locale, key) {
    return !! (
      this.hasLocale(locale) &&
            this.container[locale].attributes &&
            this.container[locale].attributes[key]
    );
  };

  Dictionary.prototype.merge = function merge$1 (dictionary) {
    merge(this.container, dictionary);
  };

  Dictionary.prototype.setMessage = function setMessage (locale, key, message) {
    if (! this.hasLocale(locale)) {
      this.container[locale] = {
        messages: {},
        attributes: {}
      };
    }

    this.container[locale].messages[key] = message;
  };

  Dictionary.prototype.setAttribute = function setAttribute (locale, key, attribute) {
    if (! this.hasLocale(locale)) {
      this.container[locale] = {
        messages: {},
        attributes: {}
      };
    }

    this.container[locale].attributes[key] = attribute;
  };

  Object.defineProperties( Dictionary.prototype, prototypeAccessors );

  // 

  var normalizeValue = function (value) {
    if (isObject(value)) {
      return Object.keys(value).reduce(function (prev, key) {
        prev[key] = normalizeValue(value[key]);

        return prev;
      }, {});
    }

    if (isCallable(value)) {
      return value('{0}', ['{1}', '{2}', '{3}']);
    }

    return value;
  };

  var normalizeFormat = function (locale) {
    // normalize messages
    var dictionary = {};
    if (locale.messages) {
      dictionary.messages = normalizeValue(locale.messages);
    }

    if (locale.custom) {
      dictionary.custom = normalizeValue(locale.custom);
    }

    if (locale.attributes) {
      dictionary.attributes = locale.attributes;
    }

    if (!isNullOrUndefined(locale.dateFormat)) {
      dictionary.dateFormat = locale.dateFormat;
    }

    return dictionary;
  };

  var I18nDictionary = function I18nDictionary (i18n, rootKey) {
    this.i18n = i18n;
    this.rootKey = rootKey;
  };

  var prototypeAccessors$1 = { locale: { configurable: true } };

  prototypeAccessors$1.locale.get = function () {
    return this.i18n.locale;
  };

  prototypeAccessors$1.locale.set = function (value) {
    warn('Cannot set locale from the validator when using vue-i18n, use i18n.locale setter instead');
  };

  I18nDictionary.prototype.getDateFormat = function getDateFormat (locale) {
    return this.i18n.getDateTimeFormat(locale || this.locale);
  };

  I18nDictionary.prototype.setDateFormat = function setDateFormat (locale, value) {
    this.i18n.setDateTimeFormat(locale || this.locale, value);
  };

  I18nDictionary.prototype.getMessage = function getMessage (locale, key, data) {
    var path = (this.rootKey) + ".messages." + key;
    if (!this.i18n.te(path)) {
      return this.i18n.t(((this.rootKey) + ".messages._default"), locale, data);
    }

    return this.i18n.t(path, locale, data);
  };

  I18nDictionary.prototype.getAttribute = function getAttribute (locale, key, fallback) {
      if ( fallback === void 0 ) fallback = '';

    var path = (this.rootKey) + ".attributes." + key;
    if (!this.i18n.te(path)) {
      return fallback;
    }

    return this.i18n.t(path, locale);
  };

  I18nDictionary.prototype.getFieldMessage = function getFieldMessage (locale, field, key, data) {
    var path = (this.rootKey) + ".custom." + field + "." + key;
    if (this.i18n.te(path)) {
      return this.i18n.t(path);
    }

    return this.getMessage(locale, key, data);
  };

  I18nDictionary.prototype.merge = function merge$1 (dictionary) {
      var this$1 = this;

    Object.keys(dictionary).forEach(function (localeKey) {
        var obj;

      // i18n doesn't deep merge
      // first clone the existing locale (avoid mutations to locale)
      var clone = merge({}, getPath((localeKey + "." + (this$1.rootKey)), this$1.i18n.messages, {}));
      // Merge cloned locale with new one
      var locale = merge(clone, normalizeFormat(dictionary[localeKey]));
      this$1.i18n.mergeLocaleMessage(localeKey, ( obj = {}, obj[this$1.rootKey] = locale, obj ));
      if (locale.dateFormat) {
        this$1.i18n.setDateTimeFormat(localeKey, locale.dateFormat);
      }
    });
  };

  I18nDictionary.prototype.setMessage = function setMessage (locale, key, value) {
      var obj, obj$1;

    this.merge(( obj$1 = {}, obj$1[locale] = {
        messages: ( obj = {}, obj[key] = value, obj )
      }, obj$1 ));
  };

  I18nDictionary.prototype.setAttribute = function setAttribute (locale, key, value) {
      var obj, obj$1;

    this.merge(( obj$1 = {}, obj$1[locale] = {
        attributes: ( obj = {}, obj[key] = value, obj )
      }, obj$1 ));
  };

  Object.defineProperties( I18nDictionary.prototype, prototypeAccessors$1 );

  // 

  var defaultConfig = {
    locale: 'en',
    delay: 0,
    errorBagName: 'errors',
    dictionary: null,
    strict: true,
    fieldsBagName: 'fields',
    classes: false,
    classNames: null,
    events: 'input|blur',
    inject: true,
    fastExit: true,
    aria: true,
    validity: false,
    i18n: null,
    i18nRootKey: 'validation'
  };

  var currentConfig = assign({}, defaultConfig);
  var dependencies = {
    dictionary: new Dictionary({
      en: {
        messages: {},
        attributes: {},
        custom: {}
      }
    })
  };

  var Config = function Config () {};

  var staticAccessors = { default: { configurable: true },current: { configurable: true } };

  staticAccessors.default.get = function () {
    return defaultConfig;
  };

  staticAccessors.current.get = function () {
    return currentConfig;
  };

  Config.dependency = function dependency (key) {
    return dependencies[key];
  };

  /**
   * Merges the config with a new one.
   */
  Config.merge = function merge$$1 (config) {
    currentConfig = assign({}, currentConfig, config);
    if (currentConfig.i18n) {
      Config.register('dictionary', new I18nDictionary(currentConfig.i18n, currentConfig.i18nRootKey));
    }
  };

  /**
   * Registers a dependency.
   */
  Config.register = function register (key, value) {
    dependencies[key] = value;
  };

  /**
   * Resolves the working config from a Vue instance.
   */
  Config.resolve = function resolve (context) {
    var selfConfig = getPath('$options.$_veeValidate', context, {});

    return assign({}, Config.current, selfConfig);
  };

  Object.defineProperties( Config, staticAccessors );

  // 

  var ErrorBag = function ErrorBag (errorBag, id) {
    if ( errorBag === void 0 ) errorBag = null;
    if ( id === void 0 ) id = null;

    this.vmId = id || null;
    // make this bag a mirror of the provided one, sharing the same items reference.
    if (errorBag && errorBag instanceof ErrorBag) {
      this.items = errorBag.items;
    } else {
      this.items = [];
    }
  };

  ErrorBag.prototype[typeof Symbol === 'function' ? Symbol.iterator : '@@iterator'] = function () {
      var this$1 = this;

    var index = 0;
    return {
      next: function () {
        return { value: this$1.items[index++], done: index > this$1.items.length };
      }
    };
  };

  /**
   * Adds an error to the internal array.
   */
  ErrorBag.prototype.add = function add (error) {
      var ref;

    (ref = this.items).push.apply(
      ref, this._normalizeError(error)
    );
  };

  /**
   * Normalizes passed errors to an error array.
   */
  ErrorBag.prototype._normalizeError = function _normalizeError (error) {
      var this$1 = this;

    if (Array.isArray(error)) {
      return error.map(function (e) {
        e.scope = !isNullOrUndefined(e.scope) ? e.scope : null;
        e.vmId = !isNullOrUndefined(e.vmId) ? e.vmId : (this$1.vmId || null);

        return e;
      });
    }

    error.scope = !isNullOrUndefined(error.scope) ? error.scope : null;

    return [error];
  };

  /**
   * Regenrates error messages if they have a generator function.
   */
  ErrorBag.prototype.regenerate = function regenerate () {
    this.items.forEach(function (i) {
      i.msg = isCallable(i.regenerate) ? i.regenerate() : i.msg;
    });
  };

  /**
   * Updates a field error with the new field scope.
   */
  ErrorBag.prototype.update = function update (id, error) {
    var item = find(this.items, function (i) { return i.id === id; });
    if (!item) {
      return;
    }

    var idx = this.items.indexOf(item);
    this.items.splice(idx, 1);
    item.scope = error.scope;
    this.items.push(item);
  };

  /**
   * Gets all error messages from the internal array.
   */
  ErrorBag.prototype.all = function all (scope) {
      var this$1 = this;

    var filterFn = function (item) {
      var matchesScope = true;
      if (!isNullOrUndefined(scope)) {
        matchesScope = item.scope === scope;
      }

      if (!isNullOrUndefined(this$1.vmId)) {
        matchesScope = item.vmId === this$1.vmId;
      }

      return matchesScope;
    };

    return this.items.filter(filterFn).map(function (e) { return e.msg; });
  };

  /**
   * Checks if there are any errors in the internal array.
   */
  ErrorBag.prototype.any = function any (scope) {
      var this$1 = this;

    var filterFn = function (item) {
      var matchesScope = true;
      if (!isNullOrUndefined(scope)) {
        matchesScope = item.scope === scope;
      }

      if (!isNullOrUndefined(this$1.vmId)) {
        matchesScope = item.vmId === this$1.vmId;
      }

      return matchesScope;
    };

    return !!this.items.filter(filterFn).length;
  };

  /**
   * Removes all items from the internal array.
   */
  ErrorBag.prototype.clear = function clear (scope) {
      var this$1 = this;

    var matchesVM = isNullOrUndefined(this.id) ? function () { return true; } : function (i) { return i.vmId === this$1.vmId; };
    if (isNullOrUndefined(scope)) {
      scope = null;
    }

    for (var i = 0; i < this.items.length; ++i) {
      if (matchesVM(this$1.items[i]) && this$1.items[i].scope === scope) {
        this$1.items.splice(i, 1);
        --i;
      }
    }
  };

  /**
   * Collects errors into groups or for a specific field.
   */
  ErrorBag.prototype.collect = function collect (field, scope, map) {
      if ( map === void 0 ) map = true;

    var groupErrors = function (items) {
      var fieldsCount = 0;
      var errors = items.reduce(function (collection, error) {
        if (!collection[error.field]) {
          collection[error.field] = [];
          fieldsCount++;
        }

        collection[error.field].push(map ? error.msg : error);

        return collection;
      }, {});

      // reduce the collection to be a single array.
      if (fieldsCount <= 1) {
        return values(errors)[0] || [];
      }

      return errors;
    };

    if (isNullOrUndefined(field)) {
      return groupErrors(this.items);
    }

    var selector = isNullOrUndefined(scope) ? String(field) : (scope + "." + field);
    var ref = this._makeCandidateFilters(selector);
      var isPrimary = ref.isPrimary;
      var isAlt = ref.isAlt;

    var collected = this.items.reduce(function (prev, curr) {
      if (isPrimary(curr)) {
        prev.primary.push(curr);
      }

      if (isAlt(curr)) {
        prev.alt.push(curr);
      }

      return prev;
    }, { primary: [], alt: [] });

    collected = collected.primary.length ? collected.primary : collected.alt;

    return groupErrors(collected);
  };

  /**
   * Gets the internal array length.
   */
  ErrorBag.prototype.count = function count () {
      var this$1 = this;

    if (this.vmId) {
      return this.items.filter(function (e) { return e.vmId === this$1.vmId; }).length;
    }

    return this.items.length;
  };

  /**
   * Finds and fetches the first error message for the specified field id.
   */
  ErrorBag.prototype.firstById = function firstById (id) {
    var error = find(this.items, function (i) { return i.id === id; });

    return error ? error.msg : undefined;
  };

  /**
   * Gets the first error message for a specific field.
   */
  ErrorBag.prototype.first = function first (field, scope) {
      if ( scope === void 0 ) scope = null;

    var selector = isNullOrUndefined(scope) ? field : (scope + "." + field);
    var match = this._match(selector);

    return match && match.msg;
  };

  /**
   * Returns the first error rule for the specified field
   */
  ErrorBag.prototype.firstRule = function firstRule (field, scope) {
    var errors = this.collect(field, scope, false);

    return (errors.length && errors[0].rule) || undefined;
  };

  /**
   * Checks if the internal array has at least one error for the specified field.
   */
  ErrorBag.prototype.has = function has (field, scope) {
      if ( scope === void 0 ) scope = null;

    return !!this.first(field, scope);
  };

  /**
   * Gets the first error message for a specific field and a rule.
   */
  ErrorBag.prototype.firstByRule = function firstByRule (name, rule, scope) {
      if ( scope === void 0 ) scope = null;

    var error = this.collect(name, scope, false).filter(function (e) { return e.rule === rule; })[0];

    return (error && error.msg) || undefined;
  };

  /**
   * Gets the first error message for a specific field that not match the rule.
   */
  ErrorBag.prototype.firstNot = function firstNot (name, rule, scope) {
      if ( rule === void 0 ) rule = 'required';
      if ( scope === void 0 ) scope = null;

    var error = this.collect(name, scope, false).filter(function (e) { return e.rule !== rule; })[0];

    return (error && error.msg) || undefined;
  };

  /**
   * Removes errors by matching against the id or ids.
   */
  ErrorBag.prototype.removeById = function removeById (id) {
      var this$1 = this;

    var condition = function (item) { return item.id === id; };
    if (Array.isArray(id)) {
      condition = function (item) { return id.indexOf(item.id) !== -1; };
    }

    for (var i = 0; i < this.items.length; ++i) {
      if (condition(this$1.items[i])) {
        this$1.items.splice(i, 1);
        --i;
      }
    }
  };

  /**
   * Removes all error messages associated with a specific field.
   */
  ErrorBag.prototype.remove = function remove (field, scope) {
      var this$1 = this;

    if (isNullOrUndefined(field)) {
      return;
    }

    var selector = isNullOrUndefined(scope) ? String(field) : (scope + "." + field);
    var ref = this._makeCandidateFilters(selector);
      var isPrimary = ref.isPrimary;

    for (var i = 0; i < this.items.length; ++i) {
      if (isPrimary(this$1.items[i])) {
        this$1.items.splice(i, 1);
        --i;
      }
    }
  };

  ErrorBag.prototype._makeCandidateFilters = function _makeCandidateFilters (selector) {
      var this$1 = this;

    var matchesRule = function () { return true; };
    var matchesScope = function () { return true; };
    var matchesName = function () { return true; };
    var matchesVM = function () { return true; };

    var ref = parseSelector(selector);
      var id = ref.id;
      var rule = ref.rule;
      var scope = ref.scope;
      var name = ref.name;

    if (rule) {
      matchesRule = function (item) { return item.rule === rule; };
    }

    // match by id, can be combined with rule selection.
    if (id) {
      return {
        isPrimary: function (item) { return matchesRule(item) && (function (item) { return id === item.id; }); },
        isAlt: function () { return false; }
      };
    }

    if (isNullOrUndefined(scope)) {
      // if no scope specified, make sure the found error has no scope.
      matchesScope = function (item) { return isNullOrUndefined(item.scope); };
    } else {
      matchesScope = function (item) { return item.scope === scope; };
    }

    if (!isNullOrUndefined(name) && name !== '*') {
      matchesName = function (item) { return item.field === name; };
    }

    if (!isNullOrUndefined(this.vmId)) {
      matchesVM = function (item) { return item.vmId === this$1.vmId; };
    }

    // matches the first candidate.
    var isPrimary = function (item) {
      return matchesVM(item) && matchesName(item) && matchesRule(item) && matchesScope(item);
    };

    // matches a second candidate, which is a field with a name containing the '.' character.
    var isAlt = function (item) {
      return matchesVM(item) && matchesRule(item) && item.field === (scope + "." + name);
    };

    return {
      isPrimary: isPrimary,
      isAlt: isAlt
    };
  };

  ErrorBag.prototype._match = function _match (selector) {
    if (isNullOrUndefined(selector)) {
      return undefined;
    }

    var ref = this._makeCandidateFilters(selector);
      var isPrimary = ref.isPrimary;
      var isAlt = ref.isAlt;

    return this.items.reduce(function (prev, item, idx, arr) {
      var isLast = idx === arr.length - 1;
      if (prev.primary) {
        return isLast ? prev.primary : prev;
      }

      if (isPrimary(item)) {
        prev.primary = item;
      }

      if (isAlt(item)) {
        prev.alt = item;
      }

      // keep going.
      if (!isLast) {
        return prev;
      }

      return prev.primary || prev.alt;
    }, {});
  };

  /**
   * Generates the options required to construct a field.
   */
  var Resolver = function Resolver () {};

  Resolver.generate = function generate (el, binding, vnode) {
    var model = Resolver.resolveModel(binding, vnode);
    var options = Config.resolve(vnode.context);

    return {
      name: Resolver.resolveName(el, vnode),
      el: el,
      listen: !binding.modifiers.disable,
      scope: Resolver.resolveScope(el, binding, vnode),
      vm: Resolver.makeVM(vnode.context),
      expression: binding.value,
      component: vnode.componentInstance,
      classes: options.classes,
      classNames: options.classNames,
      getter: Resolver.resolveGetter(el, vnode, model),
      events: Resolver.resolveEvents(el, vnode) || options.events,
      model: model,
      delay: Resolver.resolveDelay(el, vnode, options),
      rules: Resolver.resolveRules(el, binding, vnode),
      immediate: !!binding.modifiers.initial || !!binding.modifiers.immediate,
      validity: options.validity,
      aria: options.aria,
      initialValue: Resolver.resolveInitialValue(vnode)
    };
  };

  Resolver.getCtorConfig = function getCtorConfig (vnode) {
    if (!vnode.componentInstance) { return null; }

    var config = getPath('componentInstance.$options.$_veeValidate', vnode);

    return config;
  };

  /**
   * Resolves the rules defined on an element.
   */
  Resolver.resolveRules = function resolveRules (el, binding, vnode) {
    var rules = '';
    if (!binding.value && (!binding || !binding.expression)) {
      rules = getDataAttribute(el, 'rules');
    }

    if (binding.value && ~['string', 'object'].indexOf(typeof binding.value.rules)) {
      rules = binding.value.rules;
    } else if (binding.value) {
      rules = binding.value;
    }

    if (vnode.componentInstance) {
      return rules;
    }

    return fillRulesFromElement(el, rules);
  };

  /**
   * @param {*} vnode
   */
  Resolver.resolveInitialValue = function resolveInitialValue (vnode) {
    var model = vnode.data.model || find(vnode.data.directives, function (d) { return d.name === 'model'; });

    return model && model.value;
  };

  /**
   * Creates a non-circular partial VM instance from a Vue instance.
   * @param {*} vm
   */
  Resolver.makeVM = function makeVM (vm) {
    return {
      get $el () {
        return vm.$el;
      },
      get $refs () {
        return vm.$refs;
      },
      $watch: vm.$watch ? vm.$watch.bind(vm) : function () {},
      $validator: vm.$validator ? {
        errors: vm.$validator.errors,
        validate: vm.$validator.validate.bind(vm.$validator),
        update: vm.$validator.update.bind(vm.$validator)
      } : null
    };
  };

  /**
   * Resolves the delay value.
   * @param {*} el
   * @param {*} vnode
   * @param {Object} options
   */
  Resolver.resolveDelay = function resolveDelay (el, vnode, options) {
    var delay = getDataAttribute(el, 'delay');
    var globalDelay = (options && 'delay' in options) ? options.delay : 0;

    if (!delay && vnode.componentInstance && vnode.componentInstance.$attrs) {
      delay = vnode.componentInstance.$attrs['data-vv-delay'];
    }

    if (!isObject(globalDelay)) {
      return deepParseInt(delay || globalDelay);
    }

    if (!isNullOrUndefined(delay)) {
      globalDelay.input = delay;
    }

    return deepParseInt(globalDelay);
  };

  /**
   * Resolves the events to validate in response to.
   * @param {*} el
   * @param {*} vnode
   */
  Resolver.resolveEvents = function resolveEvents (el, vnode) {
    // resolve it from the root element.
    var events = getDataAttribute(el, 'validate-on');

    // resolve from data-vv-validate-on if its a vue component.
    if (!events && vnode.componentInstance && vnode.componentInstance.$attrs) {
      events = vnode.componentInstance.$attrs['data-vv-validate-on'];
    }

    // resolve it from $_veeValidate options.
    if (!events && vnode.componentInstance) {
      var config = Resolver.getCtorConfig(vnode);
      events = config && config.events;
    }

    // resolve the model event if its configured for custom components.
    if (!events && vnode.componentInstance) {
      var ref = vnode.componentInstance.$options.model || { event: 'input' };
        var event = ref.event;
      events = event;
    }

    return events;
  };

  /**
   * Resolves the scope for the field.
   * @param {*} el
   * @param {*} binding
   */
  Resolver.resolveScope = function resolveScope (el, binding, vnode) {
      if ( vnode === void 0 ) vnode = {};

    var scope = null;
    if (vnode.componentInstance && isNullOrUndefined(scope)) {
      scope = vnode.componentInstance.$attrs && vnode.componentInstance.$attrs['data-vv-scope'];
    }

    return !isNullOrUndefined(scope) ? scope : getScope(el);
  };

  /**
   * Checks if the node directives contains a v-model or a specified arg.
   * Args take priority over models.
   *
   * @return {Object}
   */
  Resolver.resolveModel = function resolveModel (binding, vnode) {
    if (binding.arg) {
      return { expression: binding.arg };
    }

    var model = vnode.data.model || find(vnode.data.directives, function (d) { return d.name === 'model'; });
    if (!model) {
      return null;
    }

    // https://github.com/vuejs/vue/blob/dev/src/core/util/lang.js#L26
    var watchable = !/[^\w.$]/.test(model.expression) && hasPath(model.expression, vnode.context);
    var lazy = !!(model.modifiers && model.modifiers.lazy);

    if (!watchable) {
      return { expression: null, lazy: lazy };
    }

    return { expression: model.expression, lazy: lazy };
  };

  /**
   * Resolves the field name to trigger validations.
   * @return {String} The field name.
   */
  Resolver.resolveName = function resolveName (el, vnode) {
    var name = getDataAttribute(el, 'name');

    if (!name && !vnode.componentInstance) {
      return el.name;
    }

    if (!name && vnode.componentInstance && vnode.componentInstance.$attrs) {
      name = vnode.componentInstance.$attrs['data-vv-name'] || vnode.componentInstance.$attrs['name'];
    }

    if (!name && vnode.componentInstance) {
      var config = Resolver.getCtorConfig(vnode);
      if (config && isCallable(config.name)) {
        var boundGetter = config.name.bind(vnode.componentInstance);

        return boundGetter();
      }

      return vnode.componentInstance.name;
    }

    return name;
  };

  /**
   * Returns a value getter input type.
   */
  Resolver.resolveGetter = function resolveGetter (el, vnode, model) {
    if (model && model.expression) {
      return function () {
        return getPath(model.expression, vnode.context);
      };
    }

    if (vnode.componentInstance) {
      var path = getDataAttribute(el, 'value-path') || (vnode.componentInstance.$attrs && vnode.componentInstance.$attrs['data-vv-value-path']);
      if (path) {
        return function () {
          return getPath(path, vnode.componentInstance);
        };
      }

      var config = Resolver.getCtorConfig(vnode);
      if (config && isCallable(config.value)) {
        var boundGetter = config.value.bind(vnode.componentInstance);

        return function () {
          return boundGetter();
        };
      }

      var ref = vnode.componentInstance.$options.model || { prop: 'value' };
        var prop = ref.prop;

      return function () {
        return vnode.componentInstance[prop];
      };
    }

    switch (el.type) {
    case 'checkbox': return function () {
      var els = document.querySelectorAll(("input[name=\"" + (el.name) + "\"]"));

      els = toArray(els).filter(function (el) { return el.checked; });
      if (!els.length) { return undefined; }

      return els.map(function (checkbox) { return checkbox.value; });
    };
    case 'radio': return function () {
      var els = document.querySelectorAll(("input[name=\"" + (el.name) + "\"]"));
      var elm = find(els, function (el) { return el.checked; });

      return elm && elm.value;
    };
    case 'file': return function (context) {
      return toArray(el.files);
    };
    case 'select-multiple': return function () {
      return toArray(el.options).filter(function (opt) { return opt.selected; }).map(function (opt) { return opt.value; });
    };
    default: return function () {
      return el && el.value;
    };
    }
  };

  // 

  var RULES = {};
  var STRICT_MODE = true;

  var Validator = function Validator (validations, options) {
    if ( options === void 0 ) options = { fastExit: true };

    this.strict = STRICT_MODE;
    this.errors = new ErrorBag();
    this.fields = new FieldBag();
    this._createFields(validations);
    this.paused = false;
    this.fastExit = options.fastExit || false;
  };

  var prototypeAccessors$2 = { rules: { configurable: true },flags: { configurable: true },dictionary: { configurable: true },_vm: { configurable: true },locale: { configurable: true } };
  var staticAccessors$1 = { rules: { configurable: true },dictionary: { configurable: true },locale: { configurable: true } };

  staticAccessors$1.rules.get = function () {
    return RULES;
  };

  prototypeAccessors$2.rules.get = function () {
    return RULES;
  };

  prototypeAccessors$2.flags.get = function () {
    return this.fields.items.reduce(function (acc, field) {
        var obj;

      if (field.scope) {
        acc[("$" + (field.scope))] = ( obj = {}, obj[field.name] = field.flags, obj );

        return acc;
      }

      acc[field.name] = field.flags;

      return acc;
    }, {});
  };

  /**
   * Getter for the dictionary.
   */
  prototypeAccessors$2.dictionary.get = function () {
    return Config.dependency('dictionary');
  };

  staticAccessors$1.dictionary.get = function () {
    return Config.dependency('dictionary');
  };

  prototypeAccessors$2._vm.get = function () {
    return Config.dependency('vm');
  };

  /**
   * Getter for the current locale.
   */
  prototypeAccessors$2.locale.get = function () {
    return Validator.locale;
  };

  /**
   * Setter for the validator locale.
   */
  prototypeAccessors$2.locale.set = function (value) {
    Validator.locale = value;
  };

  staticAccessors$1.locale.get = function () {
    return this.dictionary.locale;
  };

  /**
   * Setter for the validator locale.
   */
  staticAccessors$1.locale.set = function (value) {
    var hasChanged = value !== Validator.dictionary.locale;
    Validator.dictionary.locale = value;
    if (hasChanged && Config.dependency('vm')) {
      Config.dependency('vm').$emit('localeChanged');
    }
  };

  /**
   * Static constructor.
   */
  Validator.create = function create (validations, options) {
    return new Validator(validations, options);
  };

  /**
   * Adds a custom validator to the list of validation rules.
   */
  Validator.extend = function extend (name, validator, options) {
      if ( options === void 0 ) options = {};

    Validator._guardExtend(name, validator);
    Validator._merge(name, {
      validator: validator,
      options: assign({}, { hasTarget: false, immediate: true }, options || {})
    });
  };

  /**
   * Removes a rule from the list of validators.
   */
  Validator.remove = function remove (name) {
    delete RULES[name];
  };

  /**
   * Checks if the given rule name is a rule that targets other fields.
   */
  Validator.isTargetRule = function isTargetRule (name) {
    return !!RULES[name] && RULES[name].options.hasTarget;
  };

  /**
   * Sets the operating mode for all newly created validators.
   * strictMode = true: Values without a rule are invalid and cause failure.
   * strictMode = false: Values without a rule are valid and are skipped.
   */
  Validator.setStrictMode = function setStrictMode (strictMode) {
      if ( strictMode === void 0 ) strictMode = true;

    STRICT_MODE = strictMode;
  };

  /**
   * Adds and sets the current locale for the validator.
   */
  Validator.prototype.localize = function localize (lang, dictionary) {
    Validator.localize(lang, dictionary);
  };

  /**
   * Adds and sets the current locale for the validator.
   */
  Validator.localize = function localize (lang, dictionary) {
      var obj;

    if (isObject(lang)) {
      Validator.dictionary.merge(lang);
      return;
    }

    // merge the dictionary.
    if (dictionary) {
      var locale = lang || dictionary.name;
      dictionary = assign({}, dictionary);
      Validator.dictionary.merge(( obj = {}, obj[locale] = dictionary, obj ));
    }

    if (lang) {
      // set the locale.
      Validator.locale = lang;
    }
  };

  /**
   * Registers a field to be validated.
   */
  Validator.prototype.attach = function attach (fieldOpts) {
    // fixes initial value detection with v-model and select elements.
    var value = fieldOpts.initialValue;
    var field = new Field(fieldOpts);
    this.fields.push(field);

    // validate the field initially
    if (field.immediate) {
      this.validate(("#" + (field.id)), value || field.value);
    } else {
      this._validate(field, value || field.value, { initial: true }).then(function (result) {
        field.flags.valid = result.valid;
        field.flags.invalid = !result.valid;
      });
    }

    return field;
  };

  /**
   * Sets the flags on a field.
   */
  Validator.prototype.flag = function flag (name, flags, uid) {
      if ( uid === void 0 ) uid = null;

    var field = this._resolveField(name, undefined, uid);
    if (!field || !flags) {
      return;
    }

    field.setFlags(flags);
  };

  /**
   * Removes a field from the validator.
   */
  Validator.prototype.detach = function detach (name, scope, uid) {
    var field = isCallable(name.destroy) ? name : this._resolveField(name, scope, uid);
    if (!field) { return; }

    field.destroy();
    this.errors.remove(field.name, field.scope, field.id);
    this.fields.remove(field);
  };

  /**
   * Adds a custom validator to the list of validation rules.
   */
  Validator.prototype.extend = function extend (name, validator, options) {
      if ( options === void 0 ) options = {};

    Validator.extend(name, validator, options);
  };

  Validator.prototype.reset = function reset (matcher) {
      var this$1 = this;

    // two ticks
    return this._vm.$nextTick().then(function () {
      return this$1._vm.$nextTick();
    }).then(function () {
      this$1.fields.filter(matcher).forEach(function (field) {
        field.reset(); // reset field flags.
        this$1.errors.remove(field.name, field.scope, field.id);
      });
    });
  };

  /**
   * Updates a field, updating both errors and flags.
   */
  Validator.prototype.update = function update (id, ref) {
      var scope = ref.scope;

    var field = this._resolveField(("#" + id));
    if (!field) { return; }

    // remove old scope.
    this.errors.update(id, { scope: scope });
  };

  /**
   * Removes a rule from the list of validators.
   */
  Validator.prototype.remove = function remove (name) {
    Validator.remove(name);
  };

  /**
   * Validates a value against a registered field validations.
   */
  Validator.prototype.validate = function validate (fieldDescriptor, value, ref) {
      var this$1 = this;
      if ( ref === void 0 ) ref = {};
      var silent = ref.silent;
      var vmId = ref.vmId;

    if (this.paused) { return Promise.resolve(true); }

    // overload to validate all.
    if (isNullOrUndefined(fieldDescriptor)) {
      return this.validateScopes({ silent: silent, vmId: vmId });
    }

    // overload to validate scope-less fields.
    if (fieldDescriptor === '*') {
      return this.validateAll(undefined, { silent: silent, vmId: vmId });
    }

    // if scope validation was requested.
    if (/^(.+)\.\*$/.test(fieldDescriptor)) {
      var matched = fieldDescriptor.match(/^(.+)\.\*$/)[1];
      return this.validateAll(matched);
    }

    var field = this._resolveField(fieldDescriptor);
    if (!field) {
      return this._handleFieldNotFound(name);
    }

    if (!silent) { field.flags.pending = true; }
    if (value === undefined) {
      value = field.value;
    }

    return this._validate(field, value).then(function (result) {
      if (!silent) {
        this$1._handleValidationResults([result]);
      }

      return result.valid;
    });
  };

  /**
   * Pauses the validator.
   */
  Validator.prototype.pause = function pause () {
    this.paused = true;

    return this;
  };

  /**
   * Resumes the validator.
   */
  Validator.prototype.resume = function resume () {
    this.paused = false;

    return this;
  };

  /**
   * Validates each value against the corresponding field validations.
   */
  Validator.prototype.validateAll = function validateAll (values$$1, ref) {
      var this$1 = this;
      if ( ref === void 0 ) ref = {};
      var silent = ref.silent;
      var vmId = ref.vmId;

    if (this.paused) { return Promise.resolve(true); }

    var matcher = null;
    var providedValues = false;

    if (typeof values$$1 === 'string') {
      matcher = { scope: values$$1, vmId: vmId };
    } else if (isObject(values$$1)) {
      matcher = Object.keys(values$$1).map(function (key) {
        return { name: key, vmId: vmId, scope: null };
      });
      providedValues = true;
    } else if (Array.isArray(values$$1)) {
      matcher = values$$1.map(function (key) {
        return { name: key, vmId: vmId };
      });
    } else {
      matcher = { scope: null, vmId: vmId };
    }

    return Promise.all(
      this.fields.filter(matcher).map(function (field) { return this$1._validate(field, providedValues ? values$$1[field.name] : field.value); })
    ).then(function (results) {
      if (!silent) {
        this$1._handleValidationResults(results);
      }

      return results.every(function (t) { return t.valid; });
    });
  };

  /**
   * Validates all scopes.
   */
  Validator.prototype.validateScopes = function validateScopes (ref) {
      var this$1 = this;
      if ( ref === void 0 ) ref = {};
      var silent = ref.silent;
      var vmId = ref.vmId;

    if (this.paused) { return Promise.resolve(true); }

    return Promise.all(
      this.fields.filter({ vmId: vmId }).map(function (field) { return this$1._validate(field, field.value); })
    ).then(function (results) {
      if (!silent) {
        this$1._handleValidationResults(results);
      }

      return results.every(function (t) { return t.valid; });
    });
  };

  /**
   * Perform cleanup.
   */
  Validator.prototype.destroy = function destroy () {
    this._vm.$off('localeChanged');
  };

  /**
   * Creates the fields to be validated.
   */
  Validator.prototype._createFields = function _createFields (validations) {
      var this$1 = this;

    if (!validations) { return; }

    Object.keys(validations).forEach(function (field) {
      var options = assign({}, { name: field, rules: validations[field] });
      this$1.attach(options);
    });
  };

  /**
   * Date rules need the existence of a format, so date_format must be supplied.
   */
  Validator.prototype._getDateFormat = function _getDateFormat (validations) {
    var format = null;
    if (validations.date_format && Array.isArray(validations.date_format)) {
      format = validations.date_format[0];
    }

    return format || this.dictionary.getDateFormat(this.locale);
  };

  /**
   * Formats an error message for field and a rule.
   */
  Validator.prototype._formatErrorMessage = function _formatErrorMessage (field, rule, data, targetName) {
      if ( data === void 0 ) data = {};
      if ( targetName === void 0 ) targetName = null;

    var name = this._getFieldDisplayName(field);
    var params = this._getLocalizedParams(rule, targetName);

    return this.dictionary.getFieldMessage(this.locale, field.name, rule.name, [name, params, data]);
  };

  /**
   * Translates the parameters passed to the rule (mainly for target fields).
   */
  Validator.prototype._getLocalizedParams = function _getLocalizedParams (rule, targetName) {
      if ( targetName === void 0 ) targetName = null;

    if (rule.options.hasTarget && rule.params && rule.params[0]) {
      var localizedName = targetName || this.dictionary.getAttribute(this.locale, rule.params[0], rule.params[0]);
      return [localizedName].concat(rule.params.slice(1));
    }

    return rule.params;
  };

  /**
   * Resolves an appropriate display name, first checking 'data-as' or the registered 'prettyName'
   */
  Validator.prototype._getFieldDisplayName = function _getFieldDisplayName (field) {
    return field.alias || this.dictionary.getAttribute(this.locale, field.name, field.name);
  };

  /**
   * Tests a single input value against a rule.
   */
  Validator.prototype._test = function _test (field, value, rule) {
      var this$1 = this;

    var validator = RULES[rule.name] ? RULES[rule.name].validate : null;
    var params = Array.isArray(rule.params) ? toArray(rule.params) : [];
    var targetName = null;
    if (!validator || typeof validator !== 'function') {
      return Promise.reject(createError(("No such validator '" + (rule.name) + "' exists.")));
    }

    // has field dependencies.
    if (rule.options.hasTarget) {
      var target = find(field.dependencies, function (d) { return d.name === rule.name; });
      if (target) {
        targetName = target.field.alias;
        params = [target.field.value].concat(params.slice(1));
      }
    } else if (rule.name === 'required' && field.rejectsFalse) {
      // invalidate false if no args were specified and the field rejects false by default.
      params = params.length ? params : [true];
    }

    if (rule.options.isDate) {
      var dateFormat = this._getDateFormat(field.rules);
      if (rule.name !== 'date_format') {
        params.push(dateFormat);
      }
    }

    var result = validator(value, params);

    // If it is a promise.
    if (isCallable(result.then)) {
      return result.then(function (values$$1) {
        var allValid = true;
        var data = {};
        if (Array.isArray(values$$1)) {
          allValid = values$$1.every(function (t) { return (isObject(t) ? t.valid : t); });
        } else { // Is a single object/boolean.
          allValid = isObject(values$$1) ? values$$1.valid : values$$1;
          data = values$$1.data;
        }

        return {
          valid: allValid,
          errors: allValid ? [] : [this$1._createFieldError(field, rule, data, targetName)]
        };
      });
    }

    if (!isObject(result)) {
      result = { valid: result, data: {} };
    }

    return {
      valid: result.valid,
      errors: result.valid ? [] : [this._createFieldError(field, rule, result.data, targetName)]
    };
  };

  /**
   * Merges a validator object into the RULES and Messages.
   */
  Validator._merge = function _merge (name, ref) {
      var validator = ref.validator;
      var options = ref.options;

    var validate = isCallable(validator) ? validator : validator.validate;
    if (validator.getMessage) {
      Validator.dictionary.setMessage(Validator.locale, name, validator.getMessage);
    }

    RULES[name] = {
      validate: validate,
      options: options
    };
  };

  /**
   * Guards from extension violations.
   */
  Validator._guardExtend = function _guardExtend (name, validator) {
    if (isCallable(validator)) {
      return;
    }

    if (!isCallable(validator.validate)) {
      throw createError(
        ("Extension Error: The validator '" + name + "' must be a function or have a 'validate' method.")
      );
    }
  };

  /**
   * Creates a Field Error Object.
   */
  Validator.prototype._createFieldError = function _createFieldError (field, rule, data, targetName) {
      var this$1 = this;

    return {
      id: field.id,
      vmId: field.vmId,
      field: field.name,
      msg: this._formatErrorMessage(field, rule, data, targetName),
      rule: rule.name,
      scope: field.scope,
      regenerate: function () {
        return this$1._formatErrorMessage(field, rule, data, targetName);
      }
    };
  };

  /**
   * Tries different strategies to find a field.
   */
  Validator.prototype._resolveField = function _resolveField (name, scope, uid) {
    if (name[0] === '#') {
      return this.fields.find({ id: name.slice(1) });
    }

    if (!isNullOrUndefined(scope)) {
      return this.fields.find({ name: name, scope: scope, vmId: uid });
    }

    if (name.indexOf('.') > -1) {
      var ref = name.split('.');
        var fieldScope = ref[0];
        var fieldName = ref.slice(1);
      var field = this.fields.find({ name: fieldName.join('.'), scope: fieldScope, vmId: uid });
      if (field) {
        return field;
      }
    }

    return this.fields.find({ name: name, scope: null, vmId: uid });
  };

  /**
   * Handles when a field is not found depending on the strict flag.
   */
  Validator.prototype._handleFieldNotFound = function _handleFieldNotFound (name, scope) {
    if (!this.strict) { return Promise.resolve(true); }

    var fullName = isNullOrUndefined(scope) ? name : ("" + (!isNullOrUndefined(scope) ? scope + '.' : '') + name);

    return Promise.reject(createError(
      ("Validating a non-existent field: \"" + fullName + "\". Use \"attach()\" first.")
    ));
  };

  /**
   * Handles validation results.
   */
  Validator.prototype._handleValidationResults = function _handleValidationResults (results) {
      var this$1 = this;

    var matchers = results.map(function (result) { return ({ id: result.id }); });
    this.errors.removeById(matchers.map(function (m) { return m.id; }));
    // remove by name and scope to remove any custom errors added.
    results.forEach(function (result) {
      this$1.errors.remove(result.field, result.scope);
    });
    var allErrors = results.reduce(function (prev, curr) {
      prev.push.apply(prev, curr.errors);

      return prev;
    }, []);

    this.errors.add(allErrors);

    // handle flags.
    this.fields.filter(matchers).forEach(function (field) {
      var result = find(results, function (r) { return r.id === field.id; });
      field.setFlags({
        pending: false,
        valid: result.valid,
        validated: true
      });
    });
  };

  /**
   * Starts the validation process.
   */
  Validator.prototype._validate = function _validate (field, value, ref) {
      var this$1 = this;
      if ( ref === void 0 ) ref = {};
      var initial = ref.initial;

    // if field is disabled and is not required.
    if (field.isDisabled || (!field.isRequired && (isNullOrUndefined(value) || value === ''))) {
      return Promise.resolve({ valid: true, id: field.id, field: field.name, scope: field.scope, errors: [] });
    }

    var promises = [];
    var errors = [];
    var isExitEarly = false;
    // use of '.some()' is to break iteration in middle by returning true
    Object.keys(field.rules).filter(function (rule) {
      if (!initial) { return true; }

      return RULES[rule].options.immediate;
    }).some(function (rule) {
      var ruleOptions = RULES[rule] ? RULES[rule].options : {};
      var result = this$1._test(field, value, { name: rule, params: field.rules[rule], options: ruleOptions });
      if (isCallable(result.then)) {
        promises.push(result);
      } else if (this$1.fastExit && !result.valid) {
        errors.push.apply(errors, result.errors);
        isExitEarly = true;
      } else {
        // promisify the result.
        promises.push(new Promise(function (resolve) { return resolve(result); }));
      }

      return isExitEarly;
    });

    if (isExitEarly) {
      return Promise.resolve({ valid: false, errors: errors, id: field.id, field: field.name, scope: field.scope });
    }

    return Promise.all(promises).then(function (results) {
      return results.reduce(function (prev, v) {
          var ref;

        if (!v.valid) {
          (ref = prev.errors).push.apply(ref, v.errors);
        }

        prev.valid = prev.valid && v.valid;

        return prev;
      }, { valid: true, errors: errors, id: field.id, field: field.name, scope: field.scope });
    });
  };

  Object.defineProperties( Validator.prototype, prototypeAccessors$2 );
  Object.defineProperties( Validator, staticAccessors$1 );

  // 

  var DEFAULT_OPTIONS = {
    targetOf: null,
    immediate: false,
    scope: null,
    listen: true,
    name: null,
    rules: {},
    vm: null,
    classes: false,
    validity: true,
    aria: true,
    events: 'input|blur',
    delay: 0,
    classNames: {
      touched: 'touched', // the control has been blurred
      untouched: 'untouched', // the control hasn't been blurred
      valid: 'valid', // model is valid
      invalid: 'invalid', // model is invalid
      pristine: 'pristine', // control has not been interacted with
      dirty: 'dirty' // control has been interacted with
    }
  };

  var Field = function Field (options) {
    if ( options === void 0 ) options = {};

    this.id = uniqId();
    this.el = options.el;
    this.updated = false;
    this.dependencies = [];
    this.vmId = options.vmId;
    this.watchers = [];
    this.events = [];
    this.delay = 0;
    this.rules = {};
    this._cacheId(options);
    this.classNames = assign({}, DEFAULT_OPTIONS.classNames);
    options = assign({}, DEFAULT_OPTIONS, options);
    this._delay = !isNullOrUndefined(options.delay) ? options.delay : 0; // cache initial delay
    this.validity = options.validity;
    this.aria = options.aria;
    this.flags = createFlags();
    this.vm = options.vm;
    this.component = options.component;
    this.ctorConfig = this.component ? getPath('$options.$_veeValidate', this.component) : undefined;
    this.update(options);
    // set initial value.
    this.initialValue = this.value;
    this.updated = false;
  };

  var prototypeAccessors$3 = { validator: { configurable: true },isRequired: { configurable: true },isDisabled: { configurable: true },alias: { configurable: true },value: { configurable: true },rejectsFalse: { configurable: true } };

  prototypeAccessors$3.validator.get = function () {
    if (!this.vm || !this.vm.$validator) {
      return { validate: function () {} };
    }

    return this.vm.$validator;
  };

  prototypeAccessors$3.isRequired.get = function () {
    return !!this.rules.required;
  };

  prototypeAccessors$3.isDisabled.get = function () {
    return !!(this.component && this.component.disabled) || !!(this.el && this.el.disabled);
  };

  /**
   * Gets the display name (user-friendly name).
   */
  prototypeAccessors$3.alias.get = function () {
    if (this._alias) {
      return this._alias;
    }

    var alias = null;
    if (this.el) {
      alias = getDataAttribute(this.el, 'as');
    }

    if (!alias && this.component) {
      return this.component.$attrs && this.component.$attrs['data-vv-as'];
    }

    return alias;
  };

  /**
   * Gets the input value.
   */

  prototypeAccessors$3.value.get = function () {
    if (!isCallable(this.getter)) {
      return undefined;
    }

    return this.getter();
  };

  /**
   * If the field rejects false as a valid value for the required rule.
   */

  prototypeAccessors$3.rejectsFalse.get = function () {
    if (this.component && this.ctorConfig) {
      return !!this.ctorConfig.rejectsFalse;
    }

    if (!this.el) {
      return false;
    }

    return this.el.type === 'checkbox';
  };

  /**
   * Determines if the instance matches the options provided.
   */
  Field.prototype.matches = function matches (options) {
      var this$1 = this;

    if (!options) {
      return true;
    }

    if (options.id) {
      return this.id === options.id;
    }

    var matchesComponentId = isNullOrUndefined(options.vmId) ? function () { return true; } : function (id) { return id === this$1.vmId; };
    if (!matchesComponentId(options.vmId)) {
      return false;
    }

    if (options.name === undefined && options.scope === undefined) {
      return true;
    }

    if (options.scope === undefined) {
      return this.name === options.name;
    }

    if (options.name === undefined) {
      return this.scope === options.scope;
    }

    return options.name === this.name && options.scope === this.scope;
  };

  /**
   * Caches the field id.
   */
  Field.prototype._cacheId = function _cacheId (options) {
    if (this.el && !options.targetOf) {
      this.el._veeValidateId = this.id;
    }
  };

  /**
   * Updates the field with changed data.
   */
  Field.prototype.update = function update (options) {
    this.targetOf = options.targetOf || null;
    this.immediate = options.immediate || this.immediate || false;

    // update errors scope if the field scope was changed.
    if (!isNullOrUndefined(options.scope) && options.scope !== this.scope && isCallable(this.validator.update)) {
      this.validator.update(this.id, { scope: options.scope });
    }
    this.scope = !isNullOrUndefined(options.scope) ? options.scope
      : !isNullOrUndefined(this.scope) ? this.scope : null;
    this.name = (!isNullOrUndefined(options.name) ? String(options.name) : options.name) || this.name || null;
    this.rules = options.rules !== undefined ? normalizeRules(options.rules) : this.rules;
    this.model = options.model || this.model;
    this.listen = options.listen !== undefined ? options.listen : this.listen;
    this.classes = (options.classes || this.classes || false) && !this.component;
    this.classNames = isObject(options.classNames) ? merge(this.classNames, options.classNames) : this.classNames;
    this.getter = isCallable(options.getter) ? options.getter : this.getter;
    this._alias = options.alias || this._alias;
    this.events = (options.events) ? makeEventsArray(options.events) : this.events;
    this.delay = makeDelayObject(this.events, options.delay || this.delay, this._delay);
    this.updateDependencies();
    this.addActionListeners();

    if (!this.name && !this.targetOf) {
      warn('A field is missing a "name" or "data-vv-name" attribute');
    }

    // update required flag flags
    if (options.rules !== undefined) {
      this.flags.required = this.isRequired;
    }

    // validate if it was validated before and field was updated and there was a rules mutation.
    if (this.flags.validated && options.rules !== undefined && this.updated) {
      this.validator.validate(("#" + (this.id)));
    }

    this.updated = true;
    this.addValueListeners();

    // no need to continue.
    if (!this.el) {
      return;
    }
    this.updateClasses();
    this.updateAriaAttrs();
  };

  /**
   * Resets field flags and errors.
   */
  Field.prototype.reset = function reset () {
      var this$1 = this;

    if (this._cancellationToken) {
      this._cancellationToken.cancelled = true;
      delete this._cancellationToken;
    }

    var defaults = createFlags();
    Object.keys(this.flags).filter(function (flag) { return flag !== 'required'; }).forEach(function (flag) {
      this$1.flags[flag] = defaults[flag];
    });

    this.addActionListeners();
    this.updateClasses();
    this.updateAriaAttrs();
    this.updateCustomValidity();
  };

  /**
   * Sets the flags and their negated counterparts, and updates the classes and re-adds action listeners.
   */
  Field.prototype.setFlags = function setFlags (flags) {
      var this$1 = this;

    var negated = {
      pristine: 'dirty',
      dirty: 'pristine',
      valid: 'invalid',
      invalid: 'valid',
      touched: 'untouched',
      untouched: 'touched'
    };

    Object.keys(flags).forEach(function (flag) {
      this$1.flags[flag] = flags[flag];
      // if it has a negation and was not specified, set it as well.
      if (negated[flag] && flags[negated[flag]] === undefined) {
        this$1.flags[negated[flag]] = !flags[flag];
      }
    });

    if (
      flags.untouched !== undefined ||
      flags.touched !== undefined ||
      flags.dirty !== undefined ||
      flags.pristine !== undefined
    ) {
      this.addActionListeners();
    }
    this.updateClasses();
    this.updateAriaAttrs();
    this.updateCustomValidity();
  };

  /**
   * Determines if the field requires references to target fields.
  */
  Field.prototype.updateDependencies = function updateDependencies () {
      var this$1 = this;

    // reset dependencies.
    this.dependencies.forEach(function (d) { return d.field.destroy(); });
    this.dependencies = [];

    // we get the selectors for each field.
    var fields = Object.keys(this.rules).reduce(function (prev, r) {
      if (Validator.isTargetRule(r)) {
        prev.push({ selector: this$1.rules[r][0], name: r });
      }

      return prev;
    }, []);

    if (!fields.length || !this.vm || !this.vm.$el) { return; }

    // must be contained within the same component, so we use the vm root element constrain our dom search.
    fields.forEach(function (ref$1) {
        var selector = ref$1.selector;
        var name = ref$1.name;

      var ref = this$1.vm.$refs[selector];
      var el = Array.isArray(ref) ? ref[0] : ref;
      if (!el) {
        return;
      }

      var options = {
        vm: this$1.vm,
        classes: this$1.classes,
        classNames: this$1.classNames,
        delay: this$1.delay,
        scope: this$1.scope,
        events: this$1.events.join('|'),
        immediate: this$1.immediate,
        targetOf: this$1.id
      };

      // probably a component.
      if (isCallable(el.$watch)) {
        options.component = el;
        options.el = el.$el;
        options.getter = Resolver.resolveGetter(el.$el, el.$vnode);
      } else {
        options.el = el;
        options.getter = Resolver.resolveGetter(el, {});
      }

      this$1.dependencies.push({ name: name, field: new Field(options) });
    });
  };

  /**
   * Removes listeners.
   */
  Field.prototype.unwatch = function unwatch (tag) {
      if ( tag === void 0 ) tag = null;

    if (!tag) {
      this.watchers.forEach(function (w) { return w.unwatch(); });
      this.watchers = [];
      return;
    }

    this.watchers.filter(function (w) { return tag.test(w.tag); }).forEach(function (w) { return w.unwatch(); });
    this.watchers = this.watchers.filter(function (w) { return !tag.test(w.tag); });
  };

  /**
   * Updates the element classes depending on each field flag status.
   */
  Field.prototype.updateClasses = function updateClasses () {
      var this$1 = this;

    if (!this.classes || this.isDisabled) { return; }
    var applyClasses = function (el) {
      toggleClass(el, this$1.classNames.dirty, this$1.flags.dirty);
      toggleClass(el, this$1.classNames.pristine, this$1.flags.pristine);
      toggleClass(el, this$1.classNames.touched, this$1.flags.touched);
      toggleClass(el, this$1.classNames.untouched, this$1.flags.untouched);
      // make sure we don't set any classes if the state is undetermined.
      if (!isNullOrUndefined(this$1.flags.valid) && this$1.flags.validated) {
        toggleClass(el, this$1.classNames.valid, this$1.flags.valid);
      }

      if (!isNullOrUndefined(this$1.flags.invalid) && this$1.flags.validated) {
        toggleClass(el, this$1.classNames.invalid, this$1.flags.invalid);
      }
    };

    if (!isCheckboxOrRadioInput(this.el)) {
      applyClasses(this.el);
      return;
    }

    var els = document.querySelectorAll(("input[name=\"" + (this.el.name) + "\"]"));
    toArray(els).forEach(applyClasses);
  };

  /**
   * Adds the listeners required for automatic classes and some flags.
   */
  Field.prototype.addActionListeners = function addActionListeners () {
      var this$1 = this;

    // remove previous listeners.
    this.unwatch(/class/);

    if (!this.el) { return; }

    var onBlur = function () {
      this$1.flags.touched = true;
      this$1.flags.untouched = false;
      if (this$1.classes) {
        toggleClass(this$1.el, this$1.classNames.touched, true);
        toggleClass(this$1.el, this$1.classNames.untouched, false);
      }

      // only needed once.
      this$1.unwatch(/^class_blur$/);
    };

    var inputEvent = isTextInput(this.el) ? 'input' : 'change';
    var onInput = function () {
      this$1.flags.dirty = true;
      this$1.flags.pristine = false;
      if (this$1.classes) {
        toggleClass(this$1.el, this$1.classNames.pristine, false);
        toggleClass(this$1.el, this$1.classNames.dirty, true);
      }

      // only needed once.
      this$1.unwatch(/^class_input$/);
    };

    if (this.component && isCallable(this.component.$once)) {
      this.component.$once('input', onInput);
      this.component.$once('blur', onBlur);
      this.watchers.push({
        tag: 'class_input',
        unwatch: function () {
          this$1.component.$off('input', onInput);
        }
      });
      this.watchers.push({
        tag: 'class_blur',
        unwatch: function () {
          this$1.component.$off('blur', onBlur);
        }
      });
      return;
    }

    if (!this.el) { return; }

    addEventListener(this.el, inputEvent, onInput);
    // Checkboxes and radio buttons on Mac don't emit blur naturally, so we listen on click instead.
    var blurEvent = isCheckboxOrRadioInput(this.el) ? 'change' : 'blur';
    addEventListener(this.el, blurEvent, onBlur);
    this.watchers.push({
      tag: 'class_input',
      unwatch: function () {
        this$1.el.removeEventListener(inputEvent, onInput);
      }
    });

    this.watchers.push({
      tag: 'class_blur',
      unwatch: function () {
        this$1.el.removeEventListener(blurEvent, onBlur);
      }
    });
  };

  Field.prototype.checkValueChanged = function checkValueChanged () {
    // handle some people initialize the value to null, since text inputs have empty string value.
    if (this.initialValue === null && this.value === '' && isTextInput(this.el)) {
      return false;
    }

    return this.value !== this.initialValue;
  };

  /**
   * Determines the suitable primary event to listen for.
   */
  Field.prototype._determineInputEvent = function _determineInputEvent () {
    // if its a custom component, use the customized model event or the input event.
    if (this.component) {
      return (this.component.$options.model && this.component.$options.model.event) || 'input';
    }

    if (this.model) {
      return this.model.lazy ? 'change' : 'input';
    }

    if (isTextInput(this.el)) {
      return 'input';
    }

    return 'change';
  };

  /**
   * Determines the list of events to listen to.
   */
  Field.prototype._determineEventList = function _determineEventList (defaultInputEvent) {
    // if no event is configured, or it is a component or a text input then respect the user choice.
    if (!this.events.length || this.component || isTextInput(this.el)) {
      return [].concat( this.events );
    }

    // force suitable event for non-text type fields.
    return this.events.map(function (e) {
      if (e === 'input') {
        return defaultInputEvent;
      }

      return e;
    });
  };

  /**
   * Adds the listeners required for validation.
   */
  Field.prototype.addValueListeners = function addValueListeners () {
      var this$1 = this;

    this.unwatch(/^input_.+/);
    if (!this.listen || !this.el) { return; }

    var token = { cancelled: false };
    var fn = this.targetOf ? function () {
      this$1.flags.changed = this$1.checkValueChanged();    this$1.validator.validate(("#" + (this$1.targetOf)));
    } : function () {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

      // if its a DOM event, resolve the value, otherwise use the first parameter as the value.
      if (args.length === 0 || (isCallable(Event) && args[0] instanceof Event) || (args[0] && args[0].srcElement)) {
        args[0] = this$1.value;
      }

      this$1.flags.changed = this$1.checkValueChanged();
      this$1.validator.validate(("#" + (this$1.id)), args[0]);
    };

    var inputEvent = this._determineInputEvent();
    var events = this._determineEventList(inputEvent);

    // if there is a model and an on input validation is requested.
    if (this.model && events.indexOf(inputEvent) !== -1) {
      var ctx = null;
      var expression = this.model.expression;
      // if its watchable from the context vm.
      if (this.model.expression) {
        ctx = this.vm;
        expression = this.model.expression;
      }

      // watch it from the custom component vm instead.
      if (!expression && this.component && this.component.$options.model) {
        ctx = this.component;
        expression = this.component.$options.model.prop || 'value';
      }

      if (ctx && expression) {
        var debouncedFn = debounce(fn, this.delay[inputEvent], false, token);
        var unwatch = ctx.$watch(expression, function () {
            var args = [], len = arguments.length;
            while ( len-- ) args[ len ] = arguments[ len ];

          this$1.flags.pending = true;
          this$1._cancellationToken = token;
          debouncedFn.apply(void 0, args);
        });
        this.watchers.push({
          tag: 'input_model',
          unwatch: unwatch
        });

        // filter out input event as it is already handled by the watcher API.
        events = events.filter(function (e) { return e !== inputEvent; });
      }
    }

    // Add events.
    events.forEach(function (e) {
      var debouncedFn = debounce(fn, this$1.delay[e], false, token);
      var validate = function () {
          var args = [], len = arguments.length;
          while ( len-- ) args[ len ] = arguments[ len ];

        this$1.flags.pending = true;
        this$1._cancellationToken = token;
        debouncedFn.apply(void 0, args);
      };

      this$1._addComponentEventListener(e, validate);
      this$1._addHTMLEventListener(e, validate);
    });
  };

  Field.prototype._addComponentEventListener = function _addComponentEventListener (evt, validate) {
      var this$1 = this;

    if (!this.component) { return; }

    this.component.$on(evt, validate);
    this.watchers.push({
      tag: 'input_vue',
      unwatch: function () {
        this$1.component.$off(evt, validate);
      }
    });
  };

  Field.prototype._addHTMLEventListener = function _addHTMLEventListener (evt, validate) {
      var this$1 = this;

    if (!this.el || this.component) { return; }

    // listen for the current element.
    var addListener = function (el) {
      addEventListener(el, evt, validate);
      this$1.watchers.push({
        tag: 'input_native',
        unwatch: function () {
          el.removeEventListener(evt, validate);
        }
      });
    };

    addListener(this.el);
    if (!isCheckboxOrRadioInput(this.el)) {
      return;
    }

    var els = document.querySelectorAll(("input[name=\"" + (this.el.name) + "\"]"));
    toArray(els).forEach(function (el) {
      // skip if it is added by v-validate and is not the current element.
      if (el._veeValidateId && el !== this$1.el) {
        return;
      }

      addListener(el);
    });
  };

  /**
   * Updates aria attributes on the element.
   */
  Field.prototype.updateAriaAttrs = function updateAriaAttrs () {
      var this$1 = this;

    if (!this.aria || !this.el || !isCallable(this.el.setAttribute)) { return; }

    var applyAriaAttrs = function (el) {
      el.setAttribute('aria-required', this$1.isRequired ? 'true' : 'false');
      el.setAttribute('aria-invalid', this$1.flags.invalid ? 'true' : 'false');
    };

    if (!isCheckboxOrRadioInput(this.el)) {
      applyAriaAttrs(this.el);
      return;
    }

    var els = document.querySelectorAll(("input[name=\"" + (this.el.name) + "\"]"));
    toArray(els).forEach(applyAriaAttrs);
  };

  /**
   * Updates the custom validity for the field.
   */
  Field.prototype.updateCustomValidity = function updateCustomValidity () {
    if (!this.validity || !this.el || !isCallable(this.el.setCustomValidity) || !this.validator.errors) { return; }

    this.el.setCustomValidity(this.flags.valid ? '' : (this.validator.errors.firstById(this.id) || ''));
  };

  /**
   * Removes all listeners.
   */
  Field.prototype.destroy = function destroy () {
    this.unwatch();
    this.dependencies.forEach(function (d) { return d.field.destroy(); });
    this.dependencies = [];
  };

  Object.defineProperties( Field.prototype, prototypeAccessors$3 );

  // 

  var FieldBag = function FieldBag (items) {
    if ( items === void 0 ) items = [];

    this.items = items || [];
  };

  var prototypeAccessors$4 = { length: { configurable: true } };

  FieldBag.prototype[typeof Symbol === 'function' ? Symbol.iterator : '@@iterator'] = function () {
      var this$1 = this;

    var index = 0;
    return {
      next: function () {
        return { value: this$1.items[index++], done: index > this$1.items.length };
      }
    };
  };

  /**
   * Gets the current items length.
   */

  prototypeAccessors$4.length.get = function () {
    return this.items.length;
  };

  /**
   * Finds the first field that matches the provided matcher object.
   */
  FieldBag.prototype.find = function find$1 (matcher) {
    return find(this.items, function (item) { return item.matches(matcher); });
  };

  /**
   * Filters the items down to the matched fields.
   */
  FieldBag.prototype.filter = function filter (matcher) {
    // multiple matchers to be tried.
    if (Array.isArray(matcher)) {
      return this.items.filter(function (item) { return matcher.some(function (m) { return item.matches(m); }); });
    }

    return this.items.filter(function (item) { return item.matches(matcher); });
  };

  /**
   * Maps the field items using the mapping function.
   */
  FieldBag.prototype.map = function map (mapper) {
    return this.items.map(mapper);
  };

  /**
   * Finds and removes the first field that matches the provided matcher object, returns the removed item.
   */
  FieldBag.prototype.remove = function remove (matcher) {
    var item = null;
    if (matcher instanceof Field) {
      item = matcher;
    } else {
      item = this.find(matcher);
    }

    if (!item) { return null; }

    var index = this.items.indexOf(item);
    this.items.splice(index, 1);

    return item;
  };

  /**
   * Adds a field item to the list.
   */
  FieldBag.prototype.push = function push (item) {
    if (! (item instanceof Field)) {
      throw createError('FieldBag only accepts instances of Field that has an id defined.');
    }

    if (!item.id) {
      throw createError('Field id must be defined.');
    }

    if (this.find({ id: item.id })) {
      throw createError(("Field with id " + (item.id) + " is already added."));
    }

    this.items.push(item);
  };

  Object.defineProperties( FieldBag.prototype, prototypeAccessors$4 );

  var ScopedValidator = function ScopedValidator (base, vm) {
    this.id = vm._uid;
    this._base = base;

    // create a mirror bag with limited component scope.
    this.errors = new ErrorBag(base.errors, this.id);
  };

  var prototypeAccessors$5 = { flags: { configurable: true },rules: { configurable: true },fields: { configurable: true },dictionary: { configurable: true },locale: { configurable: true } };

  prototypeAccessors$5.flags.get = function () {
      var this$1 = this;

    return this._base.fields.items.filter(function (f) { return f.vmId === this$1.id; }).reduce(function (acc, field) {
        var obj;

      if (field.scope) {
        acc[("$" + (field.scope))] = ( obj = {}, obj[field.name] = field.flags, obj );

        return acc;
      }

      acc[field.name] = field.flags;

      return acc;
    }, {});
  };

  prototypeAccessors$5.rules.get = function () {
    return this._base.rules;
  };

  prototypeAccessors$5.fields.get = function () {
    return new FieldBag(this._base.fields.filter({ vmId: this.id }));
  };

  prototypeAccessors$5.dictionary.get = function () {
    return this._base.dictionary;
  };

  prototypeAccessors$5.locale.get = function () {
    return this._base.locale;
  };

  prototypeAccessors$5.locale.set = function (val) {
    this._base.locale = val;
  };

  ScopedValidator.prototype.localize = function localize () {
      var ref;

      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];
    return (ref = this._base).localize.apply(ref, args);
  };

  ScopedValidator.prototype.update = function update () {
      var ref;

      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];
    return (ref = this._base).update.apply(ref, args);
  };

  ScopedValidator.prototype.attach = function attach (opts) {
    var attachOpts = assign({}, opts, { vmId: this.id });

    return this._base.attach(attachOpts);
  };

  ScopedValidator.prototype.remove = function remove (ruleName) {
    return this._base.remove(ruleName);
  };

  ScopedValidator.prototype.detach = function detach () {
      var ref;

      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];
    return (ref = this._base).detach.apply(ref, args.concat( [this.id] ));
  };

  ScopedValidator.prototype.extend = function extend () {
      var ref;

      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];
    return (ref = this._base).extend.apply(ref, args);
  };

  ScopedValidator.prototype.validate = function validate (descriptor, value, opts) {
      if ( opts === void 0 ) opts = {};

    return this._base.validate(descriptor, value, assign({}, { vmId: this.id }, opts || {}));
  };

  ScopedValidator.prototype.validateAll = function validateAll (values$$1, opts) {
      if ( opts === void 0 ) opts = {};

    return this._base.validateAll(values$$1, assign({}, { vmId: this.id }, opts || {}));
  };

  ScopedValidator.prototype.validateScopes = function validateScopes (opts) {
      if ( opts === void 0 ) opts = {};

    return this._base.validateScopes(assign({}, { vmId: this.id }, opts || {}));
  };

  ScopedValidator.prototype.destroy = function destroy () {
    delete this.id;
    delete this._base;
  };

  ScopedValidator.prototype.reset = function reset (matcher) {
    return this._base.reset(Object.assign({}, matcher || {}, { vmId: this.id }));
  };

  ScopedValidator.prototype.flag = function flag () {
      var ref;

      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];
    return (ref = this._base).flag.apply(ref, args.concat( [this.id] ));
  };

  Object.defineProperties( ScopedValidator.prototype, prototypeAccessors$5 );

  // 

  /**
   * Checks if a parent validator instance was requested.
   */
  var requestsValidator = function (injections) {
    if (isObject(injections) && injections.$validator) {
      return true;
    }

    return false;
  };

  var mixin = {
    provide: function provide () {
      if (this.$validator && !isBuiltInComponent(this.$vnode)) {
        return {
          $validator: this.$validator
        };
      }

      return {};
    },
    beforeCreate: function beforeCreate () {
      // if built in do nothing.
      if (isBuiltInComponent(this.$vnode)) {
        return;
      }

      // if its a root instance set the config if it exists.
      if (!this.$parent) {
        Config.merge(this.$options.$_veeValidate || {});
      }

      var options = Config.resolve(this);

      // if its a root instance, inject anyways, or if it requested a new instance.
      if (!this.$parent || (this.$options.$_veeValidate && /new/.test(this.$options.$_veeValidate.validator))) {
        this.$validator = new ScopedValidator(Config.dependency('validator'), this);
      }

      var requested = requestsValidator(this.$options.inject);

      // if automatic injection is enabled and no instance was requested.
      if (! this.$validator && options.inject && !requested) {
        this.$validator = new ScopedValidator(Config.dependency('validator'), this);
      }

      // don't inject errors or fieldBag as no validator was resolved.
      if (! requested && ! this.$validator) {
        return;
      }

      if (! this.$options.computed) {
        this.$options.computed = {};
      }

      this.$options.computed[options.errorBagName || 'errors'] = function errorBagGetter () {
        return this.$validator.errors;
      };
      this.$options.computed[options.fieldsBagName || 'fields'] = function fieldBagGetter () {
        var this$1 = this;

        return this.$validator.fields.items.filter(function (f) { return f.vmId === this$1._uid; }).reduce(function (acc, field) {
          var obj;

          if (field.scope) {
            acc[("$" + (field.scope))] = ( obj = {}, obj[field.name] = field.flags, obj );

            return acc;
          }

          acc[field.name] = field.flags;

          return acc;
        }, {});
      };
    },
    beforeDestroy: function beforeDestroy () {
      if (this._uid === this.$validator.id) {
        this.$validator.errors.clear(); // remove errors generated by this component.
      }
    }
  };

  // 

  /**
   * Finds the requested field by id from the context object.
   */
  function findField (el, context) {
    if (!context || !context.$validator) {
      return null;
    }

    return context.$validator.fields.find({ id: el._veeValidateId });
  }
  var directive = {
    bind: function bind (el, binding, vnode) {
      var validator = vnode.context.$validator;
      if (!validator) {
        {
          warn("No validator instance is present on vm, did you forget to inject '$validator'?");
        }

        return;
      }

      var fieldOptions = Resolver.generate(el, binding, vnode);
      validator.attach(fieldOptions);
    },
    inserted: function inserted (el, binding, vnode) {
      var field = findField(el, vnode.context);
      var scope = Resolver.resolveScope(el, binding, vnode);

      // skip if scope hasn't changed.
      if (!field || scope === field.scope) { return; }

      // only update scope.
      field.update({ scope: scope });

      // allows the field to re-evaluated once more in the update hook.
      field.updated = false;
    },
    update: function update (el, binding, vnode) {
      var field = findField(el, vnode.context);

      // make sure we don't do unneccasary work if no important change was done.
      if (!field || (field.updated && isEqual(binding.value, binding.oldValue))) { return; }
      var scope = Resolver.resolveScope(el, binding, vnode);
      var rules = Resolver.resolveRules(el, binding, vnode);

      field.update({
        scope: scope,
        rules: rules
      });
    },
    unbind: function unbind (el, binding, ref) {
      var context = ref.context;

      var field = findField(el, context);
      if (!field) { return; }

      context.$validator.detach(field);
    }
  };

  var Vue;

  function install (_Vue, options) {
    if ( options === void 0 ) options = {};

    if (Vue && _Vue === Vue) {
      {
        warn('already installed, Vue.use(VeeValidate) should only be called once.');
      }
      return;
    }

    detectPassiveSupport();
    Vue = _Vue;
    var validator = new Validator(options);
    var localVue = new Vue({
      data: function () { return ({
        errors: validator.errors,
        fields: validator.fields
      }); }
    });
    Config.register('vm', localVue);
    Config.register('validator', validator);
    Config.merge(options);

    var ref = Config.current;
    var dictionary = ref.dictionary;
    var i18n = ref.i18n;

    if (dictionary) {
      validator.localize(dictionary); // merge the dictionary.
    }

    var onLocaleChanged = function () {
      validator.errors.regenerate();
    };

    // watch locale changes using localVue instance or i18n.
    if (!i18n) {
      if (typeof window !== 'undefined') {
        localVue.$on('localeChanged', onLocaleChanged);
      }
    } else {
      i18n._vm.$watch('locale', onLocaleChanged);
    }

    if (!i18n && options.locale) {
      validator.localize(options.locale); // set the locale
    }

    Validator.setStrictMode(Config.current.strict);

    Vue.mixin(mixin);
    Vue.directive('validate', directive);
  }

  // 

  function use (plugin, options) {
    if ( options === void 0 ) options = {};

    if (!isCallable(plugin)) {
      return warn('The plugin must be a callable function');
    }

    plugin({ Validator: Validator, ErrorBag: ErrorBag, Rules: Validator.rules }, options);
  }

  // 

  var normalize = function (fields) {
    if (Array.isArray(fields)) {
      return fields.reduce(function (prev, curr) {
        if (~curr.indexOf('.')) {
          prev[curr.split('.')[1]] = curr;
        } else {
          prev[curr] = curr;
        }

        return prev;
      }, {});
    }

    return fields;
  };

  // Combines two flags using either AND or OR depending on the flag type.
  var combine = function (lhs, rhs) {
    var mapper = {
      pristine: function (lhs, rhs) { return lhs && rhs; },
      dirty: function (lhs, rhs) { return lhs || rhs; },
      touched: function (lhs, rhs) { return lhs || rhs; },
      untouched: function (lhs, rhs) { return lhs && rhs; },
      valid: function (lhs, rhs) { return lhs && rhs; },
      invalid: function (lhs, rhs) { return lhs || rhs; },
      pending: function (lhs, rhs) { return lhs || rhs; },
      required: function (lhs, rhs) { return lhs || rhs; },
      validated: function (lhs, rhs) { return lhs && rhs; }
    };

    return Object.keys(mapper).reduce(function (flags, flag) {
      flags[flag] = mapper[flag](lhs[flag], rhs[flag]);

      return flags;
    }, {});
  };

  var mapScope = function (scope, deep) {
    if ( deep === void 0 ) deep = true;

    return Object.keys(scope).reduce(function (flags, field) {
      if (!flags) {
        flags = assign({}, scope[field]);
        return flags;
      }

      // scope.
      var isScope = field.indexOf('$') === 0;
      if (deep && isScope) {
        return combine(mapScope(scope[field]), flags);
      } else if (!deep && isScope) {
        return flags;
      }

      flags = combine(flags, scope[field]);

      return flags;
    }, null);
  };

  /**
   * Maps fields to computed functions.
   */
  var mapFields = function (fields) {
    if (!fields) {
      return function () {
        return mapScope(this.$validator.flags);
      };
    }

    var normalized = normalize(fields);
    return Object.keys(normalized).reduce(function (prev, curr) {
      var field = normalized[curr];
      prev[curr] = function mappedField () {
        // if field exists
        if (this.$validator.flags[field]) {
          return this.$validator.flags[field];
        }

        // scopeless fields were selected.
        if (normalized[curr] === '*') {
          return mapScope(this.$validator.flags, false);
        }

        // if it has a scope defined
        var index = field.indexOf('.');
        if (index <= 0) {
          return {};
        }

        var ref = field.split('.');
        var scope = ref[0];
        var name = ref.slice(1);

        scope = this.$validator.flags[("$" + scope)];
        name = name.join('.');

        // an entire scope was selected: scope.*
        if (name === '*' && scope) {
          return mapScope(scope);
        }

        if (scope && scope[name]) {
          return scope[name];
        }

        return {};
      };

      return prev;
    }, {});
  };

  var ErrorComponent = {
    name: 'vv-error',
    inject: ['$validator'],
    functional: true,
    props: {
      for: {
        type: String,
        required: true
      },
      tag: {
        type: String,
        default: 'span'
      }
    },
    render: function render (createElement, ref) {
      var props = ref.props;
      var injections = ref.injections;

      return createElement(props.tag, injections.$validator.errors.first(props.for));
    }
  };

  var index_minimal = {
    install: install,
    use: use,
    directive: directive,
    mixin: mixin,
    mapFields: mapFields,
    Validator: Validator,
    ErrorBag: ErrorBag,
    ErrorComponent: ErrorComponent,
    version: '2.1.0-beta.3'
  };

  return index_minimal;

})));

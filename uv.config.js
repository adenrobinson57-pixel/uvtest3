// uv.config.js — dynamic config that works on localhost and GitHub Pages
var __uv$config = (function () {
  // Compute base path where the current script/page is served.
  // Works both in window (page) and service worker (self) contexts.
  var loc = (typeof location !== 'undefined') ? location : (typeof self !== 'undefined' ? self.location : null);
  var base = '/';
  try {
    if (loc && loc.pathname) {
      // Remove the last path segment (filename) to get folder, e.g. "/repo/index.html" -> "/repo/"
      base = loc.pathname.replace(/\/[^\/]*$/, '/');
    }
  } catch (e) {
    base = '/';
  }

  // Ensure base ends with a slash
  if (!base.endsWith('/')) base += '/';

  return {
    // Prefix placed under the current base (e.g. "/uvproxytest1/uv/" on Pages,
    // or "/uv/" on localhost if site root is served from project folder).
    prefix: base + 'uv/',

    // Encoding helpers
    encodeUrl: function (url) {
      try { return btoa(encodeURIComponent(url)); }
      catch (e) { return btoa(url); }
    },
    decodeUrl: function (encoded) {
      try { return decodeURIComponent(atob(encoded)); }
      catch (e) { return atob(encoded); }
    },

    // runtime options
    followRedirects: true,
    relaySetCookie: false,

    // optional: custom service worker filename (null uses 'uv.sw.js')
    sw: null
  };
})();
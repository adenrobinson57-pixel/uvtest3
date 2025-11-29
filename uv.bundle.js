/* uv.bundle.js — full UV-like service worker library
   Features:
   - route(request): true if request should be handled by proxy
   - fetch(event): returns a Response proxied from the remote origin
   - Supports path style: /prefix/{ENCODED} and query style /prefix?u={ENCODED}
   - Supports GET/POST/PUT/DELETE via a small wrapper (POST with X-UV-Proxy-Method header)
   - Streams responses where possible
   - Follows or returns redirects based on config
   Notes:
   - This is a single-file, self-contained implementation intended to run inside the service worker (importScripts).
   - It intentionally avoids forwarding client cookies to the remote origin (unsafe).
*/

(function (global) {
  'use strict';

  function makeDefaultConfig() {
    return {
      prefix: '/uv/',
      encodeUrl: function (u) { return btoa(encodeURIComponent(u)); },
      decodeUrl: function (s) { return decodeURIComponent(atob(s)); },
      followRedirects: true,
      relaySetCookie: false
    };
  }

  function normalizePrefix(p) {
    if (!p) return '/uv/';
    if (!p.startsWith('/')) p = '/' + p;
    if (!p.endsWith('/')) p = p + '/';
    return p;
  }

  function UVServiceWorker(config) {
    this.config = Object.assign(makeDefaultConfig(), config || (typeof __uv$config !== 'undefined' ? __uv$config : {}));
    this.config.prefix = normalizePrefix(this.config.prefix);
  }

  UVServiceWorker.prototype.route = function (request) {
    try {
      var u = new URL(request.url);
      return u.pathname.indexOf(this.config.prefix) === 0 || (u.pathname === this.config.prefix.replace(/\/$/, '') && u.searchParams.has('u'));
    } catch (e) {
      return false;
    }
  };

  // Parse target from path or query param
  UVServiceWorker.prototype._extractTarget = function (request) {
    var url = new URL(request.url);
    // path-style: /prefix/{encoded...}
    if (url.pathname.indexOf(this.config.prefix) === 0) {
      var encoded = url.pathname.slice(this.config.prefix.length);
      if (!encoded && url.searchParams.has('u')) encoded = url.searchParams.get('u');
      return this._safeDecode(encoded);
    }
    // query-style: /prefix?u=encoded
    if (url.searchParams.has('u')) return this._safeDecode(url.searchParams.get('u'));
    return null;
  };

  UVServiceWorker.prototype._safeDecode = function (encoded) {
    if (!encoded) return null;
    try { return this.config.decodeUrl(encoded); }
    catch (e) {
      try { return atob(encoded); } catch (e2) { return null; }
    }
  };

  // Filter headers to avoid leaking sensitive client-origin headers to remote
  UVServiceWorker.prototype._buildForwardHeaders = function (clientRequest) {
    var headers = new Headers();
    // Allow-list a limited set of headers to forward from the incoming client request
    var allowed = ['accept', 'accept-language', 'user-agent', 'content-type', 'referer', 'origin'];
    clientRequest.headers.forEach(function (v, k) {
      if (allowed.indexOf(k.toLowerCase()) >= 0) headers.set(k, v);
    });
    // We intentionally DO NOT forward cookies or authorization headers.
    return headers;
  };

  // Build a Request object to the remote origin. For non-GET, the page will send a POST
  // to the proxy with X-UV-Proxy-Method specifying the intended method and a body.
  UVServiceWorker.prototype._buildRemoteRequest = async function (event, targetUrl) {
    var req = event.request;
    var init = { method: 'GET', headers: {} };

    if (req.method === 'POST' && req.headers.get('X-UV-Proxy-Method')) {
      // client encoded non-GET operation into a POST wrapper
      init.method = req.headers.get('X-UV-Proxy-Method').toUpperCase();
      // grab body (raw)
      var ab = await req.arrayBuffer();
      init.body = ab.byteLength ? ab : undefined;
      init.headers = { 'content-type': req.headers.get('content-type') || 'application/octet-stream' };
    } else if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE' || req.method === 'PUT') {
      init.method = req.method;
      if (req.method === 'PUT' || req.method === 'DELETE') {
        var b = await req.clone().arrayBuffer().catch(()=>null);
        if (b && b.byteLength) init.body = b;
      }
      init.headers = {};
      // copy some safe headers from client
      var forward = this._buildForwardHeaders(req);
      forward.forEach((v,k)=>init.headers[k]=v);
    } else {
      // default fallback
      init.method = req.method;
      init.headers = {};
    }

    // support redirect policy via config
    init.redirect = this.config.followRedirects ? 'follow' : 'manual';

    // use credentials: 'omit' by default (do not forward cookies)
    init.credentials = 'omit';

    return new Request(targetUrl, init);
  };

  UVServiceWorker.prototype.fetch = async function (event) {
    var req = event.request;
    var target = this._extractTarget(req);
    if (!target) return new Response('Missing or invalid proxied URL', { status: 400 });

    // Validate target is an absolute URL
    try {
      new URL(target);
    } catch (e) {
      return new Response('Decoded target is not a valid URL: ' + String(target), { status: 400 });
    }

    var remoteReq;
    try {
      remoteReq = await this._buildRemoteRequest(event, target);
    } catch (e) {
      return new Response('Failed to build remote request: ' + String(e), { status: 500 });
    }

    try {
      // Perform the remote fetch. We allow streaming by passing the request directly to fetch.
      var remoteRes = await fetch(remoteReq);

      // Optionally, if followRedirects is true, fetch may have followed redirects; if manual, we can handle.
      // Build headers to return to client (filter problematic ones)
      var headers = new Headers(remoteRes.headers);

      // Remove or adjust headers that may conflict with serving the body from our origin
      headers.delete('content-security-policy');
      headers.delete('x-frame-options');
      headers.delete('x-content-type-options');

      // Optionally relay Set-Cookie (config.relaySetCookie). If false, remove set-cookie headers to avoid silently setting cookies on proxy's origin.
      if (!this.config.relaySetCookie) {
        headers.delete('set-cookie');
        headers.delete('set-cookie2');
      }

      // Add a header to identify the proxy
      headers.set('x-uvtest-proxied-by', 'uvtest1-full');

      // Return the remote response body as-is to preserve streaming (if available)
      var body = remoteRes.body; // readable stream or null
      return new Response(body, {
        status: remoteRes.status,
        statusText: remoteRes.statusText,
        headers: headers
      });
    } catch (err) {
      return new Response('Proxy fetch error: ' + String(err), { status: 502 });
    }
  };

  // Expose constructor in worker global scope
  global.UVServiceWorker = UVServiceWorker;

})(typeof self !== 'undefined' ? self : this);
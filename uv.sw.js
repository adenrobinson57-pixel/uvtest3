// uv.sw.js — service worker wrapper for uvtest1
// This file uses uv.bundle.js and uv.config.js (both in same folder).
// Register with navigator.serviceWorker.register('uv.sw.js') from index.html

importScripts('uv.bundle.js', 'uv.config.js');

var uvInstance;
try {
  uvInstance = new UVServiceWorker(typeof __uv$config !== 'undefined' ? __uv$config : null);
} catch (e) {
  console.error('Failed to initialize UVServiceWorker:', e);
}

self.addEventListener('install', function(evt) {
  evt.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(evt) {
  evt.waitUntil(self.clients.claim());
});

function shouldHandle(event) {
  try {
    if (!uvInstance || typeof uvInstance.route !== 'function') return false;
    return uvInstance.route(event.request);
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', function(event) {
  if (!shouldHandle(event)) {
    // Not a proxied request; do default network behavior
    return;
  }

  event.respondWith((async function() {
    try {
      if (uvInstance && typeof uvInstance.fetch === 'function') {
        return await uvInstance.fetch(event);
      } else {
        return new Response('UV proxy not available', { status: 500 });
      }
    } catch (e) {
      return new Response('UV fetch error: ' + String(e), { status: 502 });
    }
  })());
});

self.addEventListener('message', function(event) {
  // Accept runtime config updates via postMessage
  if (event.data && event.data.__uv_config_update) {
    try {
      Object.assign(__uv$config, event.data.__uv_config_update);
      uvInstance = new UVServiceWorker(__uv$config);
      event.ports[0] && event.ports[0].postMessage({ ok: true });
    } catch (e) {
      event.ports[0] && event.ports[0].postMessage({ ok: false, error: String(e) });
    }
  }
});
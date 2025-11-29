# uvtest1 — Full UV-style proxy (ready to run)

What this folder contains
- index.html       — demo UI and SW registration
- uv.config.js     — configuration (prefix, encode/decode, options)
- uv.bundle.js     — full UV-like proxy implementation (exposes UVServiceWorker)
- uv.sw.js         — service worker wrapper that uses UVServiceWorker

How to run (local)
1. Put the uvtest1 folder on your machine.
2. Serve it on localhost (service workers register on localhost without HTTPS) or deploy to an HTTPS origin:
   - Python 3: `python3 -m http.server 8000` (run from the parent folder)
   - Then open: `http://localhost:8000/uvtest1/index.html`
3. The page will attempt to register the service worker automatically. If registration fails, open DevTools → Application → Service Workers for errors.
4. Enter a target URL and use the UI to open in an iframe or fetch via the proxy.

Notes, capabilities, and limitations
- Supported HTTP methods: GET/HEAD/POST/PUT/DELETE. For non-GET, the UI wraps the intended method into a POST with header `X-UV-Proxy-Method`. You can update UI or implement a custom client that sends the desired method directly to the SW endpoint.
- Redirect handling: If `__uv$config.followRedirects` is true, the SW uses fetch with redirect:'follow' and returns the final target. If false, you get the remote redirect (status 3xx) and the Location header (returned as-is).
- Cookie handling: By default the implementation removes Set-Cookie headers to avoid silently setting cookies on your proxy origin. You can enable `relaySetCookie` in uv.config.js but BE CAREFUL: relaying cookies will set cookies on the PROXY origin (not the remote origin).
- WebSockets: Browsers do not allow service-worker-level proxying of raw WebSocket frames. For WebSocket proxying you must use a server-side component (Cloudflare Worker, Node server, or similar).
- Security: This proxy will fetch arbitrary remote pages and return them from your origin. Do not expose this publicly without access controls; consider adding an allowlist/blocklist and rate-limiting. Malicious pages fetched and displayed in an iframe may still pose clickjacking or other risks — use caution.
- CORS: Because the proxy serves remote content from your origin, CORS issues are avoided for client code that fetches the proxy path. However, remote pages may include CSP headers that conflict with being framed; the SW code attempts to strip some security headers (CSP/X-Frame-Options) so pages load in an iframe — this can reduce security and should be considered carefully.
- Performance & streaming: The proxy uses remoteRes.body to return streaming responses when available; large responses will stream through the SW rather than buffer fully in memory.

Extending or deploying
- To make this public and reliable, deploy the SW and assets to an HTTPS host (Vercel, Netlify, a VPS). For production-scale public proxying, prefer serverless (Cloudflare Workers) or dedicated servers and add authentication and rate-limiting.
- If you want me to adapt this to NautilusOS's helios.html (wire the UI into the Helios browser code and replace its existing proxy list), say so and I will produce a patch.

If you'd like, I can:
- Add an allowlist/blocklist to the worker,
- Add optional basic auth for the proxy,
- Add a small build script to produce minified versions,
- Or produce a Cloudflare Worker server-side variant that supports WebSockets.

Please tell me which next step you want.
# Hosting Mata Pattern Studio

This folder contains a static browser application. Serve its contents from the same directory and
open `index.html`; no server-side application code is needed.

## Required server settings

- Serve `.wasm` as `application/wasm` and `.js` as `text/javascript`.
- Enable gzip or Brotli compression for `.wasm`, `.js`, and `.html`.
- Cache hashed `.js` and `.wasm` files as immutable, and revalidate `index.html`.
- Use HTTPS, or `localhost` for development, for browser graphics and clipboard support.

The Next.js project serves these files under `/vectorcraft/`. Preserve the relative paths and keep
the license and notice files alongside the application when redistributing it.

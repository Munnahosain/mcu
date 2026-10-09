# Mata Pattern Studio

Mata Pattern Studio is a browser-based workspace for vector illustrations and seamless patterns.
The files in this folder are a static web application; no application server is required.

## Hosting

Serve this folder over HTTP or HTTPS and open `index.html`. Keep the JavaScript and WebAssembly
files beside it so their relative asset URLs continue to work. The Next.js project serves this
folder at `/vectorcraft/`.

For MIME types, serve `.wasm` as `application/wasm` and `.js` as `text/javascript`. HTTPS (or
localhost during development) is needed for browser graphics and clipboard features.

## License files

Keep `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`, and the font license files with redistributed
copies of the application.

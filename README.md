# tobiinzi.com

Personal site and portfolio. Minimal, dark, monospace.

## Stack

Vanilla HTML, CSS, and ES modules — no build step and no dependencies.
Deployed via GitHub Pages on a custom domain (see `CNAME`).

## Local development

Serve the repo root over HTTP (ES modules require it):

```sh
python3 -m http.server 8099
# then open http://localhost:8099
```

## Structure

```
index.html        # page markup
styles/main.css   # styles
scripts/main.js   # accent-type selector
assets/           # favicon + Pokemon type symbols (see assets/README.md)
```

The accent buttons use Pokemon TCG type symbols; their source and attribution
are documented in [assets/README.md](assets/README.md).

# Asset attribution

## Pokémon type symbols (`types/`)

The 11 official Pokémon **TCG energy symbols** — Grass, Fire, Water, Lightning,
Psychic, Fighting, Darkness, Metal, Dragon, Fairy, Colorless:

- Source: Bulbagarden Archives / Bulbapedia
  (<https://bulbapedia.bulbagarden.net/wiki/Type_(TCG)>), files
  `<Type>-attack.png` hosted on <https://archives.bulbagarden.net>.
- Retrieved: 2026-06-28

### Usage / IP notice

Pokémon and its type symbols are trademarks of **Nintendo, Game Freak, and The
Pokémon Company**. These symbols are used here for a personal, non-commercial
project under fair use and carry no endorsement. If you reuse or redistribute
this site, review the rights for these images and remove or replace them if
needed.

## Vendored library (`vendor/`)

- **Lenis** smooth-scroll (`vendor/lenis-1.3.25.mjs`), self-hosted instead of
  loaded from a CDN at runtime — removes the third-party request from the page and
  works offline. It's the jsDelivr `+esm` bundle of `lenis@1.3.25` with the trailing
  `sourceMappingURL` comment stripped. Imported lazily by `scripts/main.js`.
- License: MIT — <https://github.com/darkroomengineering/lenis>.
- To update: fetch `https://cdn.jsdelivr.net/npm/lenis@<version>/+esm`, save under
  `vendor/` with the version in the filename, and bump the import in `main.js`.

## Font (`fonts/`)

- **JetBrains Mono** (`jetbrains-mono-latin-400.woff2`), self-hosted Latin
  subset, weight 400.
- License: SIL Open Font License 1.1 — see `fonts/LICENSE.txt`.
- Source: <https://github.com/JetBrains/JetBrainsMono> (via Fontsource).

# Placeholder typeface

`fcwm new` copies these files into every film so that text renders the same on every machine and
offline (`system-ui` differs between macOS, Windows and Linux, and a font fetched from the web at render
time can change or fail). They are a neutral placeholder, not a house style: replace them with the
user's own typeface or a brand kit's fonts.

| File | Contents |
| --- | --- |
| `sans.woff2` | Inter, variable weight 100 to 900, Latin |
| `sans-ext.woff2` | Inter, variable weight 100 to 900, Latin Extended (Polish, Czech, Turkish and more) |
| `OFL.txt` | SIL Open Font License 1.1 (keep it next to the font files) |

Source: `@fontsource-variable/inter` 5.3.0 on npm (Inter by The Inter Project Authors, OFL-1.1).

To use another open font offline: `npm pack @fontsource-variable/<name>` (or `@fontsource/<name>`),
unpack it, and copy the `files/*-latin-*.woff2` you need into the film's `fonts/` folder with its
`LICENSE`. Check the licence first: OFL, Apache-2.0 and MIT fonts can be embedded in a video.

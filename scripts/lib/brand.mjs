// Optional user brand kits. FCWM ships none: a user saves a kit once (fcwm brand init <name>), outside
// this repository, in ~/.fcwm/brand-kits/<name>/ (or $FCWM_HOME/brand-kits), and a film uses it only when
// started with --brand <name>. The kit is copied into the film (<film>/brand/), so the film folder stays
// self-contained and renders the same on any machine.
import fs from 'node:fs';
import path from 'node:path';
import { fcwmHome } from './setup.mjs';

export const kitsDir = (env = process.env) => path.join(fcwmHome(env), 'brand-kits');
export const kitDir = (name, env) => path.join(kitsDir(env), name);

const HEX = /^#[0-9a-f]{6}$/i;
const NAME = /^[a-z0-9][a-z0-9-]*$/;

// Every field is optional except the name; an empty field means "not decided", and the agent asks.
export const EMPTY_KIT = {
  name: '',
  colors: { ground: '', ink: '', accent: '', palette: [] },
  fonts: { display: { family: '', file: '' }, body: { family: '', file: '' } },
  logo: { file: '', fileOnDark: '' },
  endCard: { enabled: false, text: '', duration: 2 },
  sound: { logo: '' },
  notes: '',
};

export function listKits(env) {
  const dir = kitsDir(env);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'brand.json'))).sort() : [];
}

export function initKit(name, env) {
  if (!NAME.test(name || '')) throw new Error('brand kit name: lowercase letters, digits and dashes');
  const dir = kitDir(name, env);
  if (fs.existsSync(dir)) throw new Error(`${dir} already exists (nothing was changed)`);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ ...EMPTY_KIT, name }, null, 2) + '\n');
  return dir;
}

export function loadKit(name, env) {
  const file = path.join(kitDir(name, env), 'brand.json');
  if (!fs.existsSync(file)) throw new Error(`no brand kit "${name}" (${file}); fcwm brand list shows the saved kits`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Problems as strings; [] means the kit is usable. Files are relative to the kit folder.
export function checkKit(kit, dir) {
  const bad = [];
  if (!NAME.test(kit.name || '')) bad.push('name: lowercase letters, digits and dashes');
  for (const [k, v] of Object.entries(kit.colors || {})) {
    if (k === 'palette') { (v || []).forEach((c, i) => { if (!HEX.test(c)) bad.push(`colors.palette[${i}]: "${c}" is not #rrggbb`); }); continue; }
    if (v && !HEX.test(v)) bad.push(`colors.${k}: "${v}" is not #rrggbb`);
  }
  const files = [['fonts.display.file', kit.fonts?.display?.file], ['fonts.body.file', kit.fonts?.body?.file],
    ['logo.file', kit.logo?.file], ['logo.fileOnDark', kit.logo?.fileOnDark], ['sound.logo', kit.sound?.logo]];
  for (const [k, f] of files) {
    if (!f) continue;
    const full = path.resolve(dir, f);
    if (!full.startsWith(path.resolve(dir) + path.sep)) bad.push(`${k}: "${f}" must be inside the kit folder`);
    else if (!fs.existsSync(full)) bad.push(`${k}: ${f} not found in ${dir}`);
  }
  if (kit.endCard?.enabled && !(kit.endCard.duration > 0)) bad.push('endCard.duration: seconds, more than 0');
  return bad;
}

// CSS custom properties for browser films; only the values the kit sets, so the film's own defaults stay.
export function brandCss(kit) {
  const lines = [];
  const font = (role, f) => {
    if (!f?.family) return;
    if (f.file) lines.push(`@font-face { font-family: "${f.family}"; src: url("${f.file}"); }`);
    lines.push(`:root { --font-${role}: "${f.family}", system-ui, sans-serif; }`);
  };
  const c = kit.colors || {};
  const vars = ['ground', 'ink', 'accent'].filter((k) => c[k]).map((k) => `--${k}: ${c[k]};`);
  (c.palette || []).forEach((v, i) => vars.push(`--palette-${i + 1}: ${v};`));
  if (vars.length) lines.push(`:root { ${vars.join(' ')} }`);
  font('display', kit.fonts?.display);
  font('body', kit.fonts?.body);
  return `/* Brand kit "${kit.name}" (fcwm new --brand). Loaded after the film's own styles. */\n${lines.join('\n')}\n`;
}

// Copy the kit into <film>/brand/ and hook it into the film. Returns what was done, for the log.
export function applyKit(filmDir, name, env) {
  const kit = loadKit(name, env);
  const src = kitDir(name, env);
  const bad = checkKit(kit, src);
  if (bad.length) throw new Error(`brand kit "${name}" has problems:\n  ${bad.join('\n  ')}`);
  const dest = path.join(filmDir, 'brand');
  fs.cpSync(src, dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'brand.css'), brandCss(kit));
  const html = path.join(filmDir, 'index.html');
  if (fs.existsSync(html)) {
    const text = fs.readFileSync(html, 'utf8');
    if (!text.includes('brand/brand.css')) fs.writeFileSync(html, text.replace('</head>', '    <link rel="stylesheet" href="brand/brand.css" />\n  </head>'));
  }
  const cfg = path.join(filmDir, 'film.json');
  fs.writeFileSync(cfg, JSON.stringify({ ...JSON.parse(fs.readFileSync(cfg, 'utf8')), brand: name }, null, 2) + '\n');
  return dest;
}

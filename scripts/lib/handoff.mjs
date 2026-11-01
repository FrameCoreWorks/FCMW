// The exact Terminal command an agent hands to the user: one line per OS, safe for any folder path
// (spaces, '&', quotes, non-ASCII). "first" installs FCWM and whatever is missing, then renders;
// "next" only renders (FCWM still checks the tools and installs anything that went missing).
export const REPO_SLUG = 'FrameCoreWorks/FCWM';
export const OSES = ['macos', 'windows', 'linux'];

export const rawUrl = (file, ref = 'main') => `https://raw.githubusercontent.com/${REPO_SLUG}/${ref}/scripts/${file}`;

// POSIX shells (zsh, bash): single quotes keep everything literal; a quote inside becomes '\''.
export const quoteSh = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// PowerShell: single quotes are literal; a quote inside is doubled.
export const quotePs = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function normalizeOs(os) {
  const o = String(os || '').toLowerCase();
  if (['macos', 'mac', 'darwin', 'osx'].includes(o)) return 'macos';
  if (['windows', 'win', 'win32', 'powershell'].includes(o)) return 'windows';
  if (o === 'linux') return 'linux';
  throw new Error(`--os must be one of ${OSES.join(', ')}`);
}

// `app` is where FCWM is installed when it is not the default ~/.fcwm/app (for example a git clone).
export function handoffCommand({ folder, os, first = true, cloud = false, ref = 'main', app }) {
  if (!folder) throw new Error('name the film folder');
  const o = normalizeOs(os);
  const flags = cloud ? ' --cloud' : '';
  if (o === 'windows') {
    const f = quotePs(folder);
    if (first) return `& ([scriptblock]::Create((irm ${rawUrl('install.ps1', ref)}))) ${f}${flags}`;
    return `node ${app ? quotePs(`${app}\\scripts\\fcwm.mjs`) : '"$HOME\\.fcwm\\app\\scripts\\fcwm.mjs"'} run ${f}${flags}`;
  }
  const f = quoteSh(folder);
  if (first) return `curl -fsSL ${rawUrl('install.sh', ref)} | bash -s -- ${f}${flags}`;
  return `node ${app ? quoteSh(`${app}/scripts/fcwm.mjs`) : '~/.fcwm/app/scripts/fcwm.mjs'} run ${f}${flags}`;
}

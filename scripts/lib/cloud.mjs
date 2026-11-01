// Render a film folder in GitHub Actions on the user's OWN GitHub account, then download the result
// into the same folder. Uses the GitHub CLI (gh) with the user's own login; FCWM holds no tokens.
//
// 1. gh is logged in (else `gh auth login` runs interactively in the browser).
// 2. A temporary repository <login>/fcwm-render-<film>-<time> is created for this one render: private by
//    default, public with --public (Actions minutes on standard runners are free in public repositories,
//    but anyone can see the film's files while the repository exists).
// 3. The film's source (not render/ or .fcwm/) is pushed to films/<slug>/, with the workflow file.
// 4. The workflow runs; FCWM waits for it, then downloads the artifact into <film>/render/.
// 5. After a successful download the temporary repository is deleted (gh needs the delete_repo scope,
//    asked for once in the browser). A failed render keeps it so its logs can be read.
//    With --repo <name> FCWM uses that repository instead, keeps it, and deletes only the run's artifact.
import fs from 'node:fs';
import path from 'node:path';
import { run } from './proc.mjs';

const SKIP = new Set(['render', '.fcwm', 'node_modules', 'out', '.git']);
const WORKFLOW = 'fcwm-render.yml';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(args, opts = {}) {
  const r = await run('gh', args, { capture: true, ...opts });
  return { ...r, out: r.stdout.trim() };
}
async function must(cmd, args, opts = {}) {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit code ${r.code})${r.stderr ? `: ${r.stderr.trim()}` : ''}`);
  return r;
}

// Copy the film's source only: build output (render/, .fcwm/, out/) and system files stay local.
export function copySource(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, filter: (src) => {
    const name = path.basename(src);
    if (name === '.DS_Store') return false;
    return !(path.dirname(src) === from && SKIP.has(name));
  } });
}

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
export function tempRepoName(slug, d) {
  const base = String(slug).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'film';
  return `fcwm-render-${base}-${stamp(d)}`;
}

export function cloudPlan({ film, repo, ref = 'main', mode = 'full', visibility = 'private' }) {
  const name = repo || tempRepoName(film.slug);
  return [
    'gh auth status  (else: gh auth login, in the browser, with your own GitHub account)',
    repo ? `gh repo create <you>/${repo} --${visibility}  (only if it does not exist yet; it is kept)`
      : `gh repo create <you>/${name} --${visibility}  (temporary, for this render only)`,
    `copy ${film.dir} (without render/ and .fcwm/) to films/${film.slug}/ and add .github/workflows/${WORKFLOW}`,
    'git commit and push to your repository',
    `gh workflow run ${WORKFLOW} -f film=films/${film.slug} -f mode=${mode} -f fcwm_ref=${ref}`,
    'gh run watch <run> --exit-status',
    `gh run download <run> -n ${film.slug}-render -D ${path.join(film.renderDir)}`,
    repo ? 'delete the run\'s artifact on GitHub (the repository stays)'
      : `gh repo delete <you>/${name} --yes  (after a successful download; asks once for the delete_repo permission)`,
  ];
}

// gh shows the token's scopes in `gh auth status`; a token from `gh auth login --web` has no delete_repo.
async function canDelete(log) {
  const st = await gh(['auth', 'status', '-h', 'github.com']);
  if (/delete_repo/.test(st.stdout + st.stderr)) return true;
  log('FCWM deletes the temporary render repository when the film is downloaded. GitHub asks once, in the browser, for permission to delete repositories (scope delete_repo).');
  const r = await run('gh', ['auth', 'refresh', '-h', 'github.com', '-s', 'delete_repo']);
  return r.code === 0;
}

export async function cloudRender({ film, repoDir, home, repo, ref = 'main', mode = 'full', visibility = 'private', log = console.log }) {
  if ((await gh(['auth', 'status'])).code !== 0) {
    log('GitHub CLI is not logged in: opening the GitHub login (use your own account).');
    await must('gh', ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web']);
  }
  const login = (await gh(['api', 'user', '--jq', '.login'])).out;
  const id = (await gh(['api', 'user', '--jq', '.id'])).out;
  if (!login) throw new Error('could not read your GitHub login from gh');
  const temporary = !repo;
  const name = repo || tempRepoName(film.slug);
  const full = `${login}/${name}`;
  const deletable = temporary && await canDelete(log);
  log(`render on your own GitHub account: ${full} (${visibility})`);
  log(visibility === 'public'
    ? 'PUBLIC repository: Actions minutes are free, but anyone can see this film\'s files and render while the repository exists.'
    : 'private repository: the render uses your account\'s Actions minutes (GitHub Free: 2,000 a month). Add --public for free minutes if the film may be seen by anyone.');

  if ((await gh(['repo', 'view', full, '--json', 'name'])).code !== 0) {
    log(`creating ${visibility} repository ${full}${temporary ? ' (temporary)' : ''}`);
    await must('gh', ['repo', 'create', full, `--${visibility}`, '--description', temporary ? `Temporary FCWM render of ${film.slug}; deleted after download` : 'Film renders made with FCWM']);
  }
  await must('gh', ['auth', 'setup-git']);

  const work = path.join(home, 'cloud', name);
  if (temporary) fs.rmSync(work, { recursive: true, force: true });
  if (!fs.existsSync(path.join(work, '.git'))) {
    fs.mkdirSync(path.dirname(work), { recursive: true });
    await must('gh', ['repo', 'clone', full, work]);
  } else {
    await run('git', ['fetch', 'origin'], { cwd: work });
    await run('git', ['reset', '--hard', '@{u}'], { cwd: work }); // the clone is FCWM's own cache, never edited by hand
  }
  const empty = (await run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: work, capture: true })).code !== 0;
  if (empty) await must('git', ['checkout', '-B', 'main'], { cwd: work });

  copySource(film.dir, path.join(work, 'films', film.slug));
  fs.mkdirSync(path.join(work, '.github', 'workflows'), { recursive: true });
  fs.copyFileSync(path.join(repoDir, 'templates', 'cloud-render', WORKFLOW), path.join(work, '.github', 'workflows', WORKFLOW));
  fs.writeFileSync(path.join(work, '.gitignore'), 'render/\n.fcwm/\nout/\nnode_modules/\n.DS_Store\n');

  const who = ['-c', `user.name=${login}`, '-c', `user.email=${id}+${login}@users.noreply.github.com`];
  await must('git', ['add', '-A'], { cwd: work });
  const changed = (await run('git', ['diff', '--cached', '--quiet'], { cwd: work })).code !== 0;
  if (changed) await must('git', [...who, 'commit', '-q', '-m', `film: ${film.slug}`], { cwd: work });
  const branch = (await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: work, capture: true })).stdout.trim();
  await must('git', ['push', '-q', '-u', 'origin', `HEAD:${branch}`], { cwd: work });

  const started = Date.now();
  const dispatch = ['workflow', 'run', WORKFLOW, '-R', full, '--ref', branch, '-f', `film=films/${film.slug}`, '-f', `mode=${mode}`, '-f', `fcwm_ref=${ref}`];
  for (let i = 0; ; i++) { // a freshly pushed workflow takes a few seconds to register
    const r = await gh(dispatch);
    if (r.code === 0) break;
    if (i >= 12) throw new Error(`could not start the workflow: ${r.stderr.trim()}`);
    await sleep(5000);
  }
  let runId;
  for (let i = 0; i < 24 && !runId; i++) {
    await sleep(5000);
    const list = await gh(['run', 'list', '-R', full, '--workflow', WORKFLOW, '--event', 'workflow_dispatch', '--limit', '10', '--json', 'databaseId,createdAt']);
    const runs = list.code === 0 ? JSON.parse(list.out || '[]') : [];
    runId = runs.find((x) => Date.parse(x.createdAt) >= started - 30000)?.databaseId;
  }
  if (!runId) throw new Error(`the workflow was started but its run did not show up; open https://github.com/${full}/actions`);
  log(`run: https://github.com/${full}/actions/runs/${runId}`);
  const watch = await run('gh', ['run', 'watch', String(runId), '-R', full, '--exit-status', '--interval', '15']);

  const tmp = path.join(film.dir, '.fcwm', 'download');
  fs.rmSync(tmp, { recursive: true, force: true });
  const dl = await run('gh', ['run', 'download', String(runId), '-R', full, '-n', `${film.slug}-render`, '-D', tmp]);
  if (dl.code === 0) {
    fs.mkdirSync(film.renderDir, { recursive: true });
    fs.cpSync(tmp, film.renderDir, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    log(`downloaded into ${film.renderDir}`);
  }
  if (watch.code !== 0) throw new Error(`the render failed on GitHub; see https://github.com/${full}/actions/runs/${runId}${temporary ? `\nthe repository is kept so you can read the logs; delete it later with: gh repo delete ${full} --yes` : ''}`);
  if (dl.code !== 0) throw new Error(`the render finished but the download failed; the files are at https://github.com/${full}/actions/runs/${runId}`);

  // clean up: nothing of this render stays on GitHub
  if (temporary) {
    fs.rmSync(work, { recursive: true, force: true });
    const del = deletable ? await gh(['repo', 'delete', full, '--yes']) : { code: 1 };
    log(del.code === 0 ? `deleted the temporary repository ${full}` : `could not delete ${full} (no delete_repo permission); delete it with: gh repo delete ${full} --yes`);
  } else {
    const arts = await gh(['api', `repos/${full}/actions/runs/${runId}/artifacts`, '--jq', '.artifacts[].id']);
    for (const a of arts.out.split('\n').filter(Boolean)) await gh(['api', '-X', 'DELETE', `repos/${full}/actions/artifacts/${a}`]);
    log(`deleted the run's artifact on GitHub (it counts toward your storage); ${full} is kept because you named it with --repo`);
  }
  return { repo: full, runId, deleted: temporary && deletable };
}

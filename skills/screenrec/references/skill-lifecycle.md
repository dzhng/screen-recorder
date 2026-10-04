# Skill lifecycle

Use the published `npx skills@1.7.0` installer. Check `node --version`,
`npm --version` and `npx --version`; Node/npm for this command are separate from
the app's bundled runtime. If missing, report this prerequisite and use the
user's existing runtime installation route. Do not build the app to obtain it.
Work in the target project; inspect `.agents/skills/screenrec` and each selected
agent's skill path first. An existing customized installation requires the
explicit update choice below. Do not blindly overwrite through a discovery link.

## Fetch one complete pinned folder

Stage upstream outside the installed folder. Resolve `main` once and save its
commit; use that exact commit for every file. With usable Git:

```sh
screenrec_stage=$(mktemp -d)
screenrec_commit=$(git ls-remote https://github.com/dzhng/screen-recorder.git refs/heads/main | awk '{print $1}')
test ${#screenrec_commit} -eq 40 || exit 1
git init "$screenrec_stage/repo"
git -C "$screenrec_stage/repo" remote add origin https://github.com/dzhng/screen-recorder.git
git -C "$screenrec_stage/repo" sparse-checkout init --no-cone
git -C "$screenrec_stage/repo" sparse-checkout set '/skills/screenrec/'
git -C "$screenrec_stage/repo" -c protocol.version=2 fetch --depth 1 --filter=blob:none origin "$screenrec_commit"
git -C "$screenrec_stage/repo" checkout --detach FETCH_HEAD
screenrec_source="$screenrec_stage/repo/skills/screenrec"
printf '%s\n' "$screenrec_commit" > "$screenrec_stage/source-commit.txt"
```

Without usable Git, use the same Node prerequisite to recursively fetch the GitHub
contents API. This resolves `main` once and binds every directory/file to its SHA:

```sh
screenrec_stage=$(mktemp -d)
export SCREENREC_SKILL_STAGE="$screenrec_stage"
node --input-type=module <<'NODE' || exit 1
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const base = 'https://api.github.com/repos/dzhng/screen-recorder';
async function get(url, json = true) {
  const response = await fetch(url, { headers: { 'User-Agent': 'screenrec-skill-fetch' } });
  if (!response.ok) throw new Error(`Skill acquisition failed: HTTP ${response.status} ${url}`);
  return json ? response.json() : Buffer.from(await response.arrayBuffer());
}
const { sha } = await get(`${base}/commits/main`);
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid main commit identity');
const stage = process.env.SCREENREC_SKILL_STAGE;
const prefix = 'skills/screenrec';
async function folder(path) {
  const entries = await get(`${base}/contents/${path}?ref=${sha}`);
  if (!Array.isArray(entries) || !entries.length) throw new Error(`Incomplete folder: ${path}`);
  for (const entry of entries) {
    if (entry.path !== `${path}/${entry.name}` || entry.name.includes('/') || entry.name === '..') throw new Error('Invalid source path');
    if (entry.type === 'dir') await folder(entry.path);
    else if (entry.type === 'file') {
      const destination = join(stage, 'screenrec', entry.path.slice(prefix.length + 1));
      await mkdir(join(destination, '..'), { recursive: true });
      await writeFile(destination, await get(`https://raw.githubusercontent.com/dzhng/screen-recorder/${sha}/${entry.path}`, false));
    } else throw new Error(`Unsupported source entry: ${entry.type}`);
  }
}
await folder(prefix);
await writeFile(join(stage, 'source-commit.txt'), `${sha}\n`);
console.log(`Complete skill staged at ${join(stage, 'screenrec')}; commit ${sha}`);
NODE
screenrec_source="$screenrec_stage/screenrec"
```

If neither route is available, report the acquisition blocker. Do not install
Xcode/Command Line Tools merely to download a skill or clone repository media.
For a supplied complete local snapshot, record its identity and skip acquisition.

## First project install

In the intended project, select the agents you use (`codex`, `claude-code` here).
Do not use `--copy`, global installation, `skills check`, a dry-run flag, or a
custom manager command. Local folder sources have no remote tracking.

```sh
test ! -e .agents/skills/screenrec && test ! -L .agents/skills/screenrec || exit 1
test ! -e .claude/skills/screenrec && test ! -L .claude/skills/screenrec || exit 1
npx --yes skills@1.7.0 add "$screenrec_source" --skill screenrec --agent codex claude-code --yes
test -d .agents/skills/screenrec && test ! -L .agents/skills/screenrec || exit 1
test -L .claude/skills/screenrec || exit 1
test "$(cd .claude/skills/screenrec && pwd -P)" = "$(cd .agents/skills/screenrec && pwd -P)" || exit 1
diff -ru "$screenrec_source" .agents/skills/screenrec
```

Check every staged reference exists in the canonical folder. The installer can
fall back to copies; a claimed symlink is insufficient. Never link an entire
agent configuration directory. Start a fresh session in this project and verify
skill discovery before using the released-app installation procedure.

## Read-only comparison and surgical updates

For inspection, fetch the entire pinned folder, resolve the actual canonical
folder and record current file/link hashes and `skills-lock.json` before and
after. Run only a recursive textual diff:

```sh
diff -ru .agents/skills/screenrec "$screenrec_source"
```

Exit 1 means differences; exit greater than 1 means comparison failed. Account
for modified files, upstream additions, upstream removals and local extras, even
when SKILL.md itself is unchanged. Return the diff and source commit. Do not run
`add`/`update`, edit metadata or alter links for an inspection request.

For an explicit surgical request, apply only the requested hunks/files to the
resolved canonical folder. Preserve unrelated custom text and local extras;
deletions require the requested scope. Do not reinstall the entire folder. Show
the resulting diff and verify references, links and unrelated settings.

## Explicit whole-folder replacement

Only an explicit replacement request authorizes removal of local extras and
upstream-deleted files. Back up the entire old canonical folder, existing selected
discovery entries (preserving symlinks), and installer metadata before removing
anything. Keep unrelated configuration intact. For this two-agent project layout,
the following block saves those entries, replaces from the staged complete folder,
and restores them on a failed add or failed link/content verification. Avoid
concurrent skill-management writes during the transaction. If the canonical path
itself is a symlink, first inspect its owner and resolve the intended topology;
do not run this block against an unknown external target.

```sh
test -d .agents/skills/screenrec && test ! -L .agents/skills/screenrec || exit 1
screenrec_backup=$(mktemp -d)
for screenrec_entry in .agents/skills/screenrec .claude/skills/screenrec skills-lock.json; do
  if test -e "$screenrec_entry" || test -L "$screenrec_entry"; then
    mkdir -p "$screenrec_backup/$(dirname "$screenrec_entry")"
    cp -RP "$screenrec_entry" "$screenrec_backup/$screenrec_entry" || exit 1
  fi
done
rm -rf .agents/skills/screenrec .claude/skills/screenrec || {
  printf 'Cleanup failed; backup retained at %s\n' "$screenrec_backup" >&2
  exit 1
}
if npx --yes skills@1.7.0 add "$screenrec_source" --skill screenrec --agent codex claude-code --yes &&
   test -d .agents/skills/screenrec && test ! -L .agents/skills/screenrec &&
   test -L .claude/skills/screenrec &&
   test "$(cd .claude/skills/screenrec && pwd -P)" = "$(cd .agents/skills/screenrec && pwd -P)" &&
   diff -ru "$screenrec_source" .agents/skills/screenrec; then
  printf 'Replaced; backup retained at %s\n' "$screenrec_backup"
else
  rm -rf .agents/skills/screenrec .claude/skills/screenrec skills-lock.json || {
    printf 'Rollback cleanup failed; backup retained at %s\n' "$screenrec_backup" >&2
    exit 1
  }
  for screenrec_entry in .agents/skills/screenrec .claude/skills/screenrec skills-lock.json; do
    if test -e "$screenrec_backup/$screenrec_entry" || test -L "$screenrec_backup/$screenrec_entry"; then
      mkdir -p "$(dirname "$screenrec_entry")"
      cp -RP "$screenrec_backup/$screenrec_entry" "$screenrec_entry" || exit 1
    fi
  done
  diff -r "$screenrec_backup/.agents/skills/screenrec" .agents/skills/screenrec || exit 1
  if test -L "$screenrec_backup/.claude/skills/screenrec"; then
    test -L .claude/skills/screenrec &&
      test "$(readlink .claude/skills/screenrec)" = "$(readlink "$screenrec_backup/.claude/skills/screenrec")" || exit 1
  elif test -e "$screenrec_backup/.claude/skills/screenrec"; then
    diff -r "$screenrec_backup/.claude/skills/screenrec" .claude/skills/screenrec || exit 1
  fi
  if test -e "$screenrec_backup/skills-lock.json"; then
    cmp "$screenrec_backup/skills-lock.json" skills-lock.json || exit 1
  fi
  printf 'Replacement failed; prior entries restored from %s\n' "$screenrec_backup" >&2
  exit 1
fi
```

If filesystem access prevents cleanup or restoration, stop and report incomplete
recovery and the retained backup path; never claim that restoration succeeded.

Report the retained backup path, pinned source, resulting full-folder diff and
actual discovery link targets. Verify unrelated settings and other skills remain
unchanged. Retain the backup until the user decides it can be removed. A local
install's future refresh repeats this fetch/diff/explicit-update sequence; app
automatic updates never edit skill files.

# Skill lifecycle

Use the published `npx skills@1.7.0` installer. Check `node --version`,
`npm --version` and `npx --version`; Node/npm for this command are separate from
the app's bundled runtime. If missing, report this prerequisite and use the
user's existing runtime installation route. Do not build the app to obtain it.
Work in the target project; inspect `.agents/skills/yap` and each selected
agent's skill path first. An existing customized installation requires the
explicit update choice below. Do not blindly overwrite through a discovery link.

## Fetch one complete pinned folder

Stage upstream outside the installed folder. Resolve `main` once and save its
commit; use that exact commit for every file. With usable Git:

```sh
yap_stage=$(mktemp -d)
yap_commit=$(git ls-remote https://github.com/dzhng/yap.git refs/heads/main | awk '{print $1}')
test ${#yap_commit} -eq 40 || exit 1
git init "$yap_stage/repo"
git -C "$yap_stage/repo" remote add origin https://github.com/dzhng/yap.git
git -C "$yap_stage/repo" sparse-checkout init --no-cone
git -C "$yap_stage/repo" sparse-checkout set '/skills/yap/'
git -C "$yap_stage/repo" -c protocol.version=2 fetch --depth 1 --filter=blob:none origin "$yap_commit"
git -C "$yap_stage/repo" checkout --detach FETCH_HEAD
yap_source="$yap_stage/repo/skills/yap"
printf '%s\n' "$yap_commit" > "$yap_stage/source-commit.txt"
```

Without usable Git, use the same Node prerequisite to recursively fetch the GitHub
contents API. This resolves `main` once and binds every directory/file to its SHA:

```sh
yap_stage=$(mktemp -d)
export YAP_SKILL_STAGE="$yap_stage"
node --input-type=module <<'NODE' || exit 1
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const base = 'https://api.github.com/repos/dzhng/yap';
async function get(url, json = true) {
  const response = await fetch(url, { headers: { 'User-Agent': 'yap-skill-fetch' } });
  if (!response.ok) throw new Error(`Skill acquisition failed: HTTP ${response.status} ${url}`);
  return json ? response.json() : Buffer.from(await response.arrayBuffer());
}
const { sha } = await get(`${base}/commits/main`);
if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid main commit identity');
const stage = process.env.YAP_SKILL_STAGE;
const prefix = 'skills/yap';
async function folder(path) {
  const entries = await get(`${base}/contents/${path}?ref=${sha}`);
  if (!Array.isArray(entries) || !entries.length) throw new Error(`Incomplete folder: ${path}`);
  for (const entry of entries) {
    if (entry.path !== `${path}/${entry.name}` || entry.name.includes('/') || entry.name === '..') throw new Error('Invalid source path');
    if (entry.type === 'dir') await folder(entry.path);
    else if (entry.type === 'file') {
      const destination = join(stage, 'yap', entry.path.slice(prefix.length + 1));
      await mkdir(join(destination, '..'), { recursive: true });
      await writeFile(destination, await get(`https://raw.githubusercontent.com/dzhng/yap/${sha}/${entry.path}`, false));
    } else throw new Error(`Unsupported source entry: ${entry.type}`);
  }
}
await folder(prefix);
await writeFile(join(stage, 'source-commit.txt'), `${sha}\n`);
console.log(`Complete skill staged at ${join(stage, 'yap')}; commit ${sha}`);
NODE
yap_source="$yap_stage/yap"
```

If neither route is available, report the acquisition blocker. Do not install
Xcode/Command Line Tools merely to download a skill or clone repository media.
For a supplied complete local snapshot, record its identity and skip acquisition.

## First project install

In the intended project, select the agents you use (`codex`, `claude-code` here).
Do not use `--copy`, global installation, `skills check`, a dry-run flag, or a
custom manager command. Local folder sources have no remote tracking.

```sh
test ! -e .agents/skills/yap && test ! -L .agents/skills/yap || exit 1
test ! -e .claude/skills/yap && test ! -L .claude/skills/yap || exit 1
npx --yes skills@1.7.0 add "$yap_source" --skill yap --agent codex claude-code --yes
test -d .agents/skills/yap && test ! -L .agents/skills/yap || exit 1
test -L .claude/skills/yap || exit 1
test "$(cd .claude/skills/yap && pwd -P)" = "$(cd .agents/skills/yap && pwd -P)" || exit 1
diff -ru "$yap_source" .agents/skills/yap
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
diff -ru .agents/skills/yap "$yap_source"
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
test -d .agents/skills/yap && test ! -L .agents/skills/yap || exit 1
yap_backup=$(mktemp -d)
for yap_entry in .agents/skills/yap .claude/skills/yap skills-lock.json; do
  if test -e "$yap_entry" || test -L "$yap_entry"; then
    mkdir -p "$yap_backup/$(dirname "$yap_entry")"
    cp -RP "$yap_entry" "$yap_backup/$yap_entry" || exit 1
  fi
done
rm -rf .agents/skills/yap .claude/skills/yap || {
  printf 'Cleanup failed; backup retained at %s\n' "$yap_backup" >&2
  exit 1
}
if npx --yes skills@1.7.0 add "$yap_source" --skill yap --agent codex claude-code --yes &&
   test -d .agents/skills/yap && test ! -L .agents/skills/yap &&
   test -L .claude/skills/yap &&
   test "$(cd .claude/skills/yap && pwd -P)" = "$(cd .agents/skills/yap && pwd -P)" &&
   diff -ru "$yap_source" .agents/skills/yap; then
  printf 'Replaced; backup retained at %s\n' "$yap_backup"
else
  rm -rf .agents/skills/yap .claude/skills/yap skills-lock.json || {
    printf 'Rollback cleanup failed; backup retained at %s\n' "$yap_backup" >&2
    exit 1
  }
  for yap_entry in .agents/skills/yap .claude/skills/yap skills-lock.json; do
    if test -e "$yap_backup/$yap_entry" || test -L "$yap_backup/$yap_entry"; then
      mkdir -p "$(dirname "$yap_entry")"
      cp -RP "$yap_backup/$yap_entry" "$yap_entry" || exit 1
    fi
  done
  diff -r "$yap_backup/.agents/skills/yap" .agents/skills/yap || exit 1
  if test -L "$yap_backup/.claude/skills/yap"; then
    test -L .claude/skills/yap &&
      test "$(readlink .claude/skills/yap)" = "$(readlink "$yap_backup/.claude/skills/yap")" || exit 1
  elif test -e "$yap_backup/.claude/skills/yap"; then
    diff -r "$yap_backup/.claude/skills/yap" .claude/skills/yap || exit 1
  fi
  if test -e "$yap_backup/skills-lock.json"; then
    cmp "$yap_backup/skills-lock.json" skills-lock.json || exit 1
  fi
  printf 'Replacement failed; prior entries restored from %s\n' "$yap_backup" >&2
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

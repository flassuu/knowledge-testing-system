# Release checklist

Use this only when cutting a release. It does not apply to ordinary tasks: a fix
or a feature commit is committed and pushed on its own, without any of this.

**A release is atomic.** Once the release is published, nothing is renamed and no
behavior changes. Anything discovered afterwards goes into the next version. If a
rename or a behavior change is wanted right after a release, that is the next
version, not an amendment to this one.

## 1. Decide the version

SemVer. Bump every manifest in one scripted pass with an expected-match-count
assertion (Working rules, rule 8):

- `package.json`
- `apps/server/package.json`
- `apps/web-client/package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json` (`version`)
- `apps/desktop/src-tauri/Cargo.toml` (`version`)
- `apps/desktop/src-tauri/Cargo.lock` (the workspace package entry)

## 2. Update the docs

- `CHANGELOG.md` — retitle `Unreleased` to `[x.y.z] — <date>`, write the lead
  paragraph, keep one uniform section style, add the verification note and any
  migrations.
- `ROADMAP.md` — mark the finished phase, leave no checkbox open unless the
  item is a deliberate decision (say so in the item).
- `docs/api.md`, `docs/schema.md`, `README.md` — version numbers and examples
  that quote a version or schema version must match reality.
- Repo description on GitHub, if the name or the pitch changed.

## 3. Run the full gate once

Proportional verification does not apply here — this is the one full pass:

```bash
pnpm typecheck
cd apps/server && bun test
pnpm --filter @lantern/web-client test
cd apps/desktop/src-tauri && HOST=$(rustc -vV | sed -n 's/^host: //p') cargo test
pnpm smoke:console
pnpm check:browser                              # needs a server on :3300
```

## 4. Commit, tag, push

```bash
git add -A && git commit          # conventional commit
git tag -a v<version> -m "v<version> — <title>"
git push origin main && git push origin v<version>
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds the
server, the web client and the desktop bundles and creates a GitHub Release with
placeholder notes.

## 5. Wait for CI

Both workflows must succeed: `Release` and `Build desktop app (Linux +
Windows)`. Watch with `gh run watch <id> --repo flassuu/lantern`.

### The AppImage job is allowed to fail, and is checked

The Linux matrix is split: the `.deb` is required, the AppImage is
`continue-on-error`. This is not caution about a flaky test — it is a known
packaging conflict, and it is worth knowing before anyone spends an afternoon
on it:

- **`.deb`** is built by `dpkg-deb`, which rewrites nothing. Its sidecar is
  intact and the bundle works.
- **AppImage** is assembled by `linuxdeploy`, which runs `patchelf` over every
  ELF in the AppDir's `usr/bin` to set an rpath. On our sidecar — a
  `bun build --compile` binary — that rewrite **corrupts it**. The bundle builds,
  uploads, and the app inside segfaults silently on startup.
- Nothing structural notices. `readelf` reads the header, the program headers and
  the dynamic section without complaint, and `ldd` is content wherever the
  libraries happen to resolve. Only running it tells you.
- `linuxdeploy` also runs `ldd` on each ELF and aborts on a non-zero exit, which
  `ldd` gives for a Bun binary it cannot trace. The `ldd` shim in the workflow
  exists only for that; it is not what fixes the corruption.
- A step after the build opens the produced AppImage, gives the sidecar inside it
  a data directory and eight seconds, and requires it to still be alive when the
  timeout takes it. Anything else — a segfault, an abort, a bind failure —
  **deletes the asset from the release**, so a broken AppImage never reaches the
  download list.

Shipping a working AppImage therefore means moving the Bun binary out of
`usr/bin` into a directory `linuxdeploy` does not scan, with a small wrapper in
the sidecar slot. Until that is done, expect Linux users to take the `.deb`, or
to build the AppImage locally.

## 6. Publish the notes

```bash
gh release edit v<version> --repo flassuu/lantern \
  --title "v<version> — <title>" --notes-file <file> --latest
```

The notes explain **why**, not a list of features: what was broken, what the
change is, what a user has to do (migrations, a changed app identifier, a
renamed binary), and what was verified. Draft the file before CI finishes.

## 7. Verify the released assets as a user would

Never trust the CI log alone — download and run it:

```bash
gh release download v<version> --repo flassuu/lantern --pattern 'lantern-server*' --pattern 'lantern-web*'
chmod +x lantern-server_<version>_linux-x64
./lantern-server_<version>_linux-x64 --port 3499 --data ./data --webroot ./dist &
curl -s http://127.0.0.1:3499/api/health     # version must match
curl -s http://127.0.0.1:3499/ | grep '<title>' # LANtern
```

Confirm the asset names match the release conventions: `lantern-server_<v>_linux-x64`,
`lantern-web_<v>.tar.gz`, and `LANtern_<v>_*` for the desktop bundles (those come
from `productName`, so mixed case is correct there).

Stop the process by PID (`ss -lptn 'sport = :3499'`), never by a `pkill` pattern.
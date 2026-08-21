// Copies distribution/policies.json into the built application, whichever
// platform and architecture produced it.
//
// The policies file is what keeps Firefox's updater from advertising phantom
// updates (DisableAppUpdate). It lives OUTSIDE the profile, in the app itself,
// so it must be re-copied after every build that regenerates dist/.
//
// Cross-platform by design: Windows is the primary target, macOS secondary.
import fs from "fs";
import path from "path";

const OBJ_ROOT = "engine";
const SRC = "distribution/policies.json";

function findObjDir() {
  const entries = fs.existsSync(OBJ_ROOT) ? fs.readdirSync(OBJ_ROOT) : [];
  const objDirs = entries.filter((e) => e.startsWith("obj-"));
  if (!objDirs.length) {
    return null;
  }
  // Newest first, so a fresh build wins if several object dirs linger.
  objDirs.sort(
    (a, b) =>
      fs.statSync(path.join(OBJ_ROOT, b)).mtimeMs -
      fs.statSync(path.join(OBJ_ROOT, a)).mtimeMs
  );
  return path.join(OBJ_ROOT, objDirs[0]);
}

function findDistributionTargets(distDir) {
  const targets = [];
  if (!fs.existsSync(distDir)) {
    return targets;
  }
  // macOS: dist/<App>.app/Contents/Resources/distribution
  for (const entry of fs.readdirSync(distDir)) {
    if (entry.endsWith(".app")) {
      targets.push(path.join(distDir, entry, "Contents/Resources/distribution"));
    }
  }
  // Windows/Linux: dist/bin/distribution (bin/ is the runnable build)
  const bin = path.join(distDir, "bin");
  if (fs.existsSync(bin)) {
    targets.push(path.join(bin, "distribution"));
  }
  return targets;
}

const objDir = findObjDir();
if (!objDir) {
  console.error("dist:apply — no engine/obj-* directory found; build first.");
  process.exit(1);
}

const targets = findDistributionTargets(path.join(objDir, "dist"));
if (!targets.length) {
  console.error(`dist:apply — no application found under ${objDir}/dist.`);
  process.exit(1);
}

const EXT_SRC = "distribution/extensions";

for (const dir of targets) {
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(SRC, path.join(dir, "policies.json"));
  console.log(`policies.json -> ${dir}`);
  // Owner decision 2026-08-20: no extensions are bundled by default (the
  // Bitwarden auto-install was dropped). If distribution/extensions/ ever
  // gains content again, it still ships; its absence is the normal state.
  if (fs.existsSync(EXT_SRC)) {
    fs.cpSync(EXT_SRC, path.join(dir, "extensions"), { recursive: true });
    console.log(`extensions/ -> ${dir}`);
  }
}

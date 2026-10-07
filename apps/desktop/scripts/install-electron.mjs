import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Only the installed, pinned Electron package's official installer is executable here.
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(desktop, "../..");
const generated = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop");
const cache = join(generated, "electron-cache");
const packaging = join(generated, "packaging");
const temporary = join(generated, "tmp");
const electron = join(desktop, "node_modules/electron");
const version = "44.6.0";
const artifact = "electron-v44.6.0-win32-x64.zip";
const officialUrl = "https://github.com/electron/electron/releases/download/v44.6.0/" + artifact;

async function directory(target) {
  const child = relative(project, target);
  assert.ok(child !== "" && !child.startsWith("..") && !resolve(target).startsWith("\\\\"));
  let current = project;
  for (const component of child.split(sep)) {
    current = join(current, component);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe_generated_directory");
  }
}
async function fileHash(target) {
  const metadata = await fs.lstat(target);
  assert.ok(metadata.isFile() && !metadata.isSymbolicLink(), "unsafe_artifact_file");
  return createHash("sha256").update(await fs.readFile(target)).digest("hex");
}

assert.equal(process.argv.length, 2, "installer_has_no_dynamic_arguments");
assert.equal(process.platform, "win32");
assert.equal(process.arch, "x64");
const manifest = JSON.parse(await fs.readFile(join(desktop, "package.json"), "utf8"));
const lock = JSON.parse(await fs.readFile(join(desktop, "package-lock.json"), "utf8"));
const installed = JSON.parse(await fs.readFile(join(electron, "package.json"), "utf8"));
assert.equal(manifest.devDependencies.electron, version);
assert.equal(lock.packages["node_modules/electron"].version, version);
assert.equal(installed.version, version);
const checksums = JSON.parse(await fs.readFile(join(electron, "checksums.json"), "utf8"));
const checksum = checksums[artifact];
assert.match(checksum, /^[a-f0-9]{64}$/);
await directory(cache);
await directory(packaging);
await directory(temporary);
await directory(electron);
const url = new URL(officialUrl);
url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf("/"));
const bucket = createHash("sha256").update(url.toString()).digest("hex");
const archive = join(cache, bucket, artifact);
await directory(dirname(archive));
const historicalSeed = join(project, ".ans/runtime/legion-desktop-gui-v1/electron-cache", bucket, artifact);
assert.equal(await fileHash(historicalSeed), checksum, "historical_archive_checksum_mismatch");
try { await fs.copyFile(historicalSeed, archive, 1); }
catch (error) { if (error.code !== "EEXIST") throw error; }
assert.equal(await fileHash(archive), checksum);

const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (/electron_(mirror|nightly_?mirror|custom_?(dir|filename|version)|override_dist_path|use_remote_checksums|skip_binary_download)/i.test(key)) delete environment[key];
}
delete environment.force_no_cache;
delete environment.NODE_COMPILE_CACHE;
delete environment.NODE_OPTIONS;
Object.assign(environment, { electron_config_cache: cache,
  ELECTRON_INSTALL_PLATFORM: "win32", ELECTRON_INSTALL_ARCH: "x64",
  ELECTRON_GET_NO_PROGRESS: "1", NODE_DISABLE_COMPILE_CACHE: "1",
  TEMP: temporary, TMP: temporary });
const result = spawnSync(process.execPath, [join(electron, "install.js")], {
  cwd: desktop, env: environment, encoding: "utf8", timeout: 270000, maxBuffer: 4 * 1024 * 1024,
});
await fs.writeFile(join(packaging, "electron-install.log"), (result.stdout ?? "") + (result.stderr ?? ""));
assert.equal(result.error, undefined, String(result.error));
assert.equal(result.status, 0, result.stdout + result.stderr);
assert.equal((await fs.readFile(join(electron, "dist/version"), "utf8")).trim().replace(/^v/, ""), version);
assert.equal(await fs.readFile(join(electron, "path.txt"), "utf8"), "electron.exe");

assert.equal(await fileHash(archive), checksum, "official_checksum_mismatch");
const binary = join(electron, "dist/electron.exe");
const evidence = { version, platform: "win32", arch: "x64", officialUrl,
  archive, archiveSha256: checksum, checksumSource: join(electron, "checksums.json"),
  binary, binarySha256: await fileHash(binary), cache, installer: join(electron, "install.js"),
  officialInstallerExitCode: result.status, checksumVerified: true };
await fs.writeFile(join(packaging, "electron-install.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));

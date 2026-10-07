import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startDesktop } from "./src/interface/main.mjs";

/** Workbench 0.2 entry: callable startup remains inert on import. */
export function bootstrap(options = {}) { return startDesktop(options); }

function startupOptions() {
  const options = {};
  if (process.env.LEGION_DESKTOP_USER_DATA_DIR) options.userDataDir = process.env.LEGION_DESKTOP_USER_DATA_DIR;
  if (process.env.LEGION_DESKTOP_INITIAL_WORKSPACE) options.initialWorkspace = process.env.LEGION_DESKTOP_INITIAL_WORKSPACE;
  if (process.env.LEGION_DESKTOP_SHOW !== undefined) {
    if (process.env.LEGION_DESKTOP_SHOW === "false") options.show = false;
    else if (process.env.LEGION_DESKTOP_SHOW === "true") options.show = true;
    else throw new TypeError("invalid_startup_show");
  }
  return options;
}

function runProcess(app) {
  let starting;
  let stopping;
  try { starting = bootstrap(startupOptions()); }
  catch {
    process.stderr.write("Legion desktop startup failed.\n"); app.exit(1); return;
  }
  const stop = () => {
    if (stopping) return stopping;
    const deadline = setTimeout(() => app.exit(1), 10000);
    stopping = starting.then((handle) => handle.close()).then((result) => {
      let code = 0;
      if (!result.closed) { code = 1; process.stderr.write("Legion desktop shutdown failed.\n"); }
      app.exit(code);
    }).catch(() => { process.stderr.write("Legion desktop shutdown failed.\n"); app.exit(1); })
      .finally(() => clearTimeout(deadline));
    return stopping;
  };
  app.on("before-quit", (event) => { event.preventDefault(); void stop(); });
  app.on("window-all-closed", () => { void stop(); });
  process.once("SIGINT", () => { void stop(); });
  process.once("SIGTERM", () => { void stop(); });
  starting.then((handle) => {
    if (handle.readiness.ready !== true) throw new Error("desktop_not_ready");
    process.stdout.write("LEGION_DESKTOP_READY " + JSON.stringify(handle.readiness) + "\n");
  }).catch(() => { process.stderr.write("Legion desktop startup failed.\n"); app.exit(1); });
}

// Do not await app.whenReady() during ESM entry evaluation: Electron must finish loading first.
if (process.versions.electron && process.type === "browser") {
  void import("electron").then(({ app }) => {
    if (resolve(app.getAppPath()) === dirname(fileURLToPath(import.meta.url))) runProcess(app);
  }).catch(() => { process.stderr.write("Legion desktop entry failed.\n"); process.exitCode = 1; });
}

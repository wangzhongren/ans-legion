import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const desktop = dirname(fileURLToPath(import.meta.url));
export default {
  packagerConfig: {
    name: "LegionDesktop", executableName: "LegionDesktop", asar: false, prune: true,
    electronVersion: "44.6.0",
    electronZipDir: join(desktop, "../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/electron-cache/8ed3ed5a704bf2ea4aac1ece9f050d2f11422ac8430103e9efbf921b4ea38d8c"),
    ignore: [/^\/(tests|scripts|out)(\/|$)/, /^\/(forge\.config\.mjs|package-lock\.json)$/],
  },
  makers: [{ name: "@electron-forge/maker-zip", platforms: ["win32"] }],
};

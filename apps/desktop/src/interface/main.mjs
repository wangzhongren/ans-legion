import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';
import { createWorkbenchPipeline } from '../pipelines/workbench.mjs';
import { exactObject, identifier, projectIdentifier, displayText, immutable, probeDTO } from '../models/desktop.mjs';
import { WB_OPERATIONS, WB_LIMITS, workbenchInput, workbenchDTO, planDocument, taskState, contextDescriptor, wbSuccess, wbFailure, wbError } from '../models/workbench.mjs';
const directory = dirname(fileURLToPath(import.meta.url));
const channel = (operation) => `legion-desktop:${operation}`;
let active = null;
let starting = false;

/** Rebuild the finite wire projection, never transport a private project document. */
function wireState(value) {
  const base = workbenchDTO({ profiles: value.profiles, assignments: value.assignments, projects: value.projects, defaultProfileId: value.defaultProfileId, history: value.history, turn: value.turn, observation: value.observation, probe: value.probe, error: value.error });
  let currentProject = null;
  if (value.currentProject) {
    const project = value.currentProject;
    if (typeof project.hasManager !== 'boolean') throw new TypeError('invalid_projection');
    currentProject = { id: projectIdentifier(project.id), name: displayText(project.name, 100), organizationVersion: identifier(project.organizationVersion), hasManager: project.hasManager };
  }
  if (!Array.isArray(value.roles) || value.roles.length > WB_LIMITS.roles + 1 || !Array.isArray(value.tasks) || value.tasks.length > WB_LIMITS.tasks) throw new TypeError('invalid_projection');
  const roles = value.roles.map((role) => ({ id: identifier(role.id), name: displayText(role.name, 100), purpose: displayText(role.purpose, 1000), profileId: identifier(role.profileId) }));
  let plan = null;
  if (value.plan) plan = planDocument(value.plan);
  return immutable({ ...base, currentProject, roles, plan, tasks: value.tasks.map(taskState), context: contextDescriptor(value.context) });
}

/** Focused boundary tests only. Renderer never receives these helpers. */
export function _validateIpcRequest(event, window, documentUrl, operation, input = {}) {
  try {
    if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== documentUrl) return wbFailure('unauthorized_sender');
    return workbenchInput(operation, input);
  } catch { return wbFailure('unauthorized_sender'); }
}
export async function _dispatchDesktopIpc(event, window, documentUrl, operation, input, pipeline) {
  const checked = _validateIpcRequest(event, window, documentUrl, operation, input);
  if (!checked.ok) return checked;
  try {
    let result;
    switch (operation) {
      case 'getState': result = await pipeline.getState(checked.value); break;
      case 'refreshProject': result = await pipeline.refreshProject(); break;
      case 'setDefaultProfile': result = await pipeline.setDefaultProfile(checked.value); break;
      case 'saveProfile': result = await pipeline.saveProfile(checked.value); break;
      case 'deleteProfile': result = await pipeline.deleteProfile(checked.value); break;
      case 'assignProfile': result = await pipeline.assignProfile(checked.value); break;
      case 'sendMessage': result = await pipeline.sendMessage(checked.value); break;
      case 'selectContext': result = await pipeline.selectContext(checked.value); break;
      case 'confirmPlan': result = await pipeline.confirmPlan(checked.value); break;
      case 'cancelTurn': result = await pipeline.cancelTurn(checked.value); break;
      case 'stopExecution': result = await pipeline.stopExecution(checked.value); break;
      case 'testConnection': result = await pipeline.testConnection(checked.value); break;
      case 'cancelProbe': result = await pipeline.cancelProbe(checked.value); break;
      default: return wbFailure('unknown_operation');
    }
    if (!result.ok) return wbFailure(result.error?.code, result.error?.field);
    if (operation === 'cancelProbe') return wbSuccess(null);
    if (operation === 'testConnection') return wbSuccess(probeDTO(result.value));
    return wbSuccess(wireState(result.value));
  } catch { return wbFailure('internal_error'); }
}

/** Inert import; root bootstrap owns app.quit/signals, this handle owns one window. */
export async function startDesktop(options = {}) {
  exactObject(options, ['userDataDir', 'initialWorkspace', 'show']);
  if (active || starting) throw new Error('桌面窗口已经启动。');
  for (const field of ['userDataDir', 'initialWorkspace']) if (options[field] !== undefined && (typeof options[field] !== 'string' || !isAbsolute(options[field]))) throw new Error('启动目录无效。');
  if (options.show !== undefined && typeof options.show !== 'boolean') throw new Error('窗口选项无效。');
  starting = true;
  try {
    const { app, BrowserWindow, ipcMain, dialog } = await import('electron');
    if (!app || !BrowserWindow) throw new Error('请通过 Electron 启动桌面程序。');
    if (options.userDataDir) {
      app.setPath('userData', options.userDataDir);
      app.setPath('sessionData', options.userDataDir);
      app.setAppLogsPath(join(options.userDataDir, 'logs'));
    }
    await app.whenReady();
    const pipeline = createWorkbenchPipeline({ userDataDir: app.getPath('userData') });
    let window = null;
    let closePromise = null;
    const owned = [];
    const documentUrl = new URL('./index.html', import.meta.url).href;
    const preventNavigation = (event, url) => { if (url !== documentUrl) event.preventDefault(); };
    const preventWebview = (event) => event.preventDefault();
    const closeRequested = (event) => { event.preventDefault(); void close(); };
    const close = () => {
      if (closePromise) return closePromise;
      const stopped = pipeline.close(); // synchronously revokes before waiting for state reads
      closePromise = (async () => {
        let error = null;
        for (const operation of owned) ipcMain.removeHandler(channel(operation));
        try { const result = await stopped; if (!result.ok) error = wbError(result.error?.code); }
        catch { error = wbError('internal_error'); }
        try {
          if (window && !window.isDestroyed()) {
            window.removeListener('close', closeRequested);
            window.webContents.removeListener('will-navigate', preventNavigation);
            window.webContents.removeListener('will-attach-webview', preventWebview);
            window.destroy();
          }
        } catch { error = wbError('internal_error'); }
        active = null;
        return Object.freeze({ closed: error === null, error });
      })();
      return closePromise;
    };
    active = { close };
    try {
      if (options.initialWorkspace) await pipeline.selectProject(options.initialWorkspace);
      window = new BrowserWindow({ width: 1260, height: 860, minWidth: 960, minHeight: 640, title: 'Legion 工作台', show: false, backgroundColor: '#f7f8fa', autoHideMenuBar: true, webPreferences: { preload: join(directory, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false, partition: 'legion-desktop' } });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', preventNavigation);
      window.webContents.on('will-attach-webview', preventWebview);
      window.on('close', closeRequested);
      for (const operation of WB_OPERATIONS) {
        ipcMain.handle(channel(operation), async (event, input = {}) => {
          if (operation !== 'chooseProject') return _dispatchDesktopIpc(event, window, documentUrl, operation, input, pipeline);
          const checked = _validateIpcRequest(event, window, documentUrl, operation, input);
          if (!checked.ok) return checked;
          try {
            const selected = await dialog.showOpenDialog(window, { title: '选择客户项目文件夹', properties: ['openDirectory'] });
            if (!_validateIpcRequest(event, window, documentUrl, operation, input).ok) return wbFailure('unauthorized_sender');
            let result;
            if (selected.canceled || selected.filePaths.length !== 1) result = await pipeline.getState();
            else result = await pipeline.selectProject(selected.filePaths[0]);
            if (!result.ok) return wbFailure(result.error?.code);
            return wbSuccess(wireState(result.value));
          } catch { return wbFailure('internal_error'); }
        });
        owned.push(operation);
      }
      await window.loadFile(join(directory, 'index.html'));
      if (options.show !== false) window.show();
      return Object.freeze({ readiness: Object.freeze({ ready: true, windowId: window.id }), close });
    } catch { await close(); throw new Error(wbError('internal_error').message); }
  } finally { starting = false; }
}

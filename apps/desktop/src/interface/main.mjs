import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';
import { createWorkbenchPipeline } from '../pipelines/workbench.mjs';
import { exactObject, identifier, projectIdentifier, displayText, immutable, probeDTO } from '../models/desktop.mjs';
import { WB_OPERATIONS, WB_LIMITS, workbenchInput, workbenchDTO, planDocument, taskState, contextDescriptor, publicQueryDTO, wbSuccess, wbFailure, wbError, governedWireDTO, roleActivity } from '../models/workbench.mjs';
import { ProjectFileOwners } from 'legion-runtime/workbench-models';
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
  if (!Array.isArray(value.roles) || value.roles.length > 64 || !Array.isArray(value.tasks) || value.tasks.length > WB_LIMITS.tasks) throw new TypeError('invalid_projection');
  const domain = governedWireDTO(value);
  const roles = value.roles.map((role) => {
    const member = domain.organization?.members.find((item) => item.id === role.id);
    return { ...member, ...roleActivity(role), id: identifier(role.id), name: displayText(role.name, 100), purpose: displayText(role.purpose, 4000), profileId: identifier(role.profileId) };
  });
  let plan = null;
  if (value.plan) plan = planDocument(value.plan);
  let fileOwners = null;
  if (value.fileOwners) {
    fileOwners = new ProjectFileOwners(value.fileOwners);
    if (fileOwners.projectId !== currentProject?.id) throw new TypeError('invalid_projection');
  }
  return immutable({ ...base, ...domain, currentProject, fileOwners, roles, plan, tasks: value.tasks.map(taskState), context: contextDescriptor(value.context) });
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
      case 'answerInteraction': result = await pipeline.answerInteraction(checked.value); break;
      case 'closeInteraction': result = await pipeline.closeInteraction(checked.value); break;
      case 'confirmPlan': result = await pipeline.confirmPlan(checked.value); break;
      case 'cancelTurn': result = await pipeline.cancelTurn(checked.value); break;
      case 'stopExecution': result = await pipeline.stopExecution(checked.value); break;
      case 'testConnection': result = await pipeline.testConnection(checked.value); break;
      case 'cancelProbe': result = await pipeline.cancelProbe(checked.value); break;
      case 'listProjectFiles': result = await pipeline.listProjectFiles(checked.value); break;
      case 'readProjectFile': result = await pipeline.readProjectFile(checked.value); break;
      case 'queryRoleActivity': result = await pipeline.queryRoleActivity(checked.value); break;
      case 'queryRoleLog': result = await pipeline.queryRoleLog(checked.value); break;
      case 'queryProjectFacts': result = await pipeline.queryProjectFacts(checked.value); break;
      case 'queryProjectOutputs': result = await pipeline.queryProjectOutputs(checked.value); break;
      case 'queryProjectMemory': result = await pipeline.queryProjectMemory(checked.value); break;
      default: return wbFailure('unknown_operation');
    }
    if (!result.ok) return wbFailure(result.error?.code, result.error?.field);
    if (operation === 'cancelProbe') return wbSuccess(null);
    if (operation === 'testConnection') return wbSuccess(probeDTO(result.value));
    if (['listProjectFiles','readProjectFile','queryRoleActivity','queryRoleLog','queryProjectFacts','queryProjectOutputs','queryProjectMemory'].includes(operation)) return wbSuccess(publicQueryDTO(operation,result.value));
    return wbSuccess(wireState(result.value));
  } catch { return wbFailure('internal_error'); }
}

/** Safe external links are UI activations, never Workbench operations. */
export function _externalLinkUrl(value) {
  if (typeof value !== 'string' || value.length > 8192 || !/^https?:\/\//iu.test(value) || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    let decoded = value;
    for (let depth = 0; depth < 4; depth += 1) {
      if (/[\u0000-\u001f\u007f]/u.test(decoded)) return null;
      const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next;
    }
    if (/[\u0000-\u001f\u007f]/u.test(decoded)) return null;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
/** Focused Interface tests replay this exact handler with a controlled OS opener. */
export function _createExternalLinkHandler({ window, documentUrl, openExternal, showFailure }) {
  let closed = false; let pressed = null; let activation = null;
  const alive = () => !closed && !window.isDestroyed() && !window.webContents.isDestroyed?.() && window.webContents.mainFrame?.url === documentUrl;
  const readAnchor = async (expression) => {
    if (!alive()) return { ok: false, anchor: null };
    const script = `(() => { const a = (${expression}); if (!(a instanceof HTMLAnchorElement) || a.dataset.externalLink !== 'true' || a.target !== 'handwell-external-link') return null; return {href:a.href, target:a.target, documentUrl:document.URL}; })()`;
    try {
      const value = await window.webContents.executeJavaScript(script);
      if (!alive() || !value || value.documentUrl !== documentUrl || value.target !== 'handwell-external-link') return { ok: true, anchor: null };
      const href = _externalLinkUrl(value.href); if (!href) return { ok: true, anchor: null };
      return { ok: true, anchor: { href, target: value.target } };
    } catch { return { ok: false, anchor: null }; }
  };
  const point = (mouse) => {
    if (!Number.isFinite(mouse.x) || !Number.isFinite(mouse.y) || mouse.x < 0 || mouse.y < 0) return null;
    const zoom = window.webContents.getZoomFactor?.() ?? 1; if (!Number.isFinite(zoom) || zoom <= 0) return null;
    return `document.elementFromPoint(${mouse.x / zoom},${mouse.y / zoom})?.closest('a[data-external-link]')`;
  };
  const notify = async () => {
    if (!alive()) return;
    try { await showFailure('链接未打开。请在原始回复中复制网址，在浏览器打开。'); }
    catch { console.error('external_link_notice_failed'); }
  };
  const beforeMouse = (_event, mouse) => {
    if (!alive()) { pressed = null; activation = null; return; }
    if (mouse.type === 'mouseDown') {
      activation = null; pressed = null; const expression = point(mouse);
      if (mouse.button === 'left' && expression) pressed = readAnchor(expression);
    } else if (mouse.type === 'mouseUp') {
      const down = pressed; pressed = null; activation = null; const expression = point(mouse);
      if (mouse.button !== 'left' || !down || !expression) return;
      activation = Promise.all([down, readAnchor(expression)]).then(([start, end]) => {
        if (!start.ok || !end.ok) return { ok: false, anchor: null };
        if (!start.anchor || !end.anchor || start.anchor.href !== end.anchor.href || start.anchor.target !== end.anchor.target) return { ok: true, anchor: null };
        return end;
      });
    } else if (['mouseLeave', 'mouseWheel', 'contextMenu'].includes(mouse.type)) { pressed = null; activation = null; }
  };
  const beforeInput = (_event, input) => {
    if (input.type === 'keyUp' && input.key === 'Enter' && alive()) {
      const current = activation;
      // A native Enter popup may reach main after keyUp. Expire any unused
      // binding after that renderer event queue roundtrip, not a time window.
      if (current) void window.webContents.executeJavaScript('void 0').then(() => { if (activation === current) activation = null; }, () => { if (activation === current) activation = null; });
      return;
    }
    pressed = null; activation = null;
    if (!alive() || input.type !== 'keyDown' || input.key !== 'Enter' || input.isComposing || input.isAutoRepeat) return;
    activation = readAnchor("document.activeElement?.closest('a[data-external-link]')");
  };
  const handler = (details) => {
    const current = activation; activation = null; // Exactly one window request consumes this activation.
    const url = _externalLinkUrl(details.url);
    if (!alive() || !current || !url || details.frameName !== 'handwell-external-link' || details.postBody || !['foreground-tab', 'background-tab', 'new-window'].includes(details.disposition)) return { action: 'deny' };
    void current.then(async (result) => {
      if (!alive()) return;
      if (!result.ok) { await notify(); return; }
      if (!result.anchor || result.anchor.href !== url || result.anchor.target !== details.frameName) return;
      try { await openExternal(url); }
      catch { await notify(); }
    });
    return { action: 'deny' };
  };
  return { handler, beforeMouse, beforeInput, close: () => { closed = true; pressed = null; activation = null; } };
}

/** Inert import; root bootstrap owns app.quit/signals, this handle owns one window. */
export async function startDesktop(options = {}) {
  exactObject(options, ['userDataDir', 'initialWorkspace', 'show']);
  if (active || starting) throw new Error('桌面窗口已经启动。');
  for (const field of ['userDataDir', 'initialWorkspace']) if (options[field] !== undefined && (typeof options[field] !== 'string' || !isAbsolute(options[field]))) throw new Error('启动目录无效。');
  if (options.show !== undefined && typeof options.show !== 'boolean') throw new Error('窗口选项无效。');
  starting = true;
  try {
    const { app, BrowserWindow, ipcMain, dialog, shell } = await import('electron');
    if (!app || !BrowserWindow) throw new Error('请通过 Electron 启动桌面程序。');
    if (options.userDataDir) {
      app.setPath('userData', options.userDataDir);
      app.setPath('sessionData', options.userDataDir);
      app.setAppLogsPath(join(options.userDataDir, 'logs'));
    }
    await app.whenReady();
    const pipeline = createWorkbenchPipeline({ userDataDir: app.getPath('userData') });
    let window = null;
    let closePromise = null; let externalLinks = null;
    const owned = [];
    const documentUrl = new URL('./index.html', import.meta.url).href;
    const preventNavigation = (event, url) => { if (url !== documentUrl) event.preventDefault(); };
    const preventWebview = (event) => event.preventDefault();
    const closeRequested = (event) => { event.preventDefault(); void close(); };
    const close = () => {
      if (closePromise) return closePromise;
      externalLinks?.close();
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
            if (externalLinks) { window.webContents.removeListener('before-mouse-event', externalLinks.beforeMouse); window.webContents.removeListener('before-input-event', externalLinks.beforeInput); }
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
      window = new BrowserWindow({ width: 1440, height: 900, minWidth: 860, minHeight: 640, title: '二哥项目指挥台', show: false, backgroundColor: '#131312', autoHideMenuBar: true, webPreferences: { preload: join(directory, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false, partition: 'legion-desktop' } });
      externalLinks = _createExternalLinkHandler({ window, documentUrl, openExternal: (url) => shell.openExternal(url), showFailure: (message) => dialog.showMessageBox(window, { type: 'error', title: '无法打开链接', message }) });
      window.webContents.setWindowOpenHandler(externalLinks.handler);
      window.webContents.on('before-mouse-event', externalLinks.beforeMouse); window.webContents.on('before-input-event', externalLinks.beforeInput);
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
            if (!result.ok) return wbFailure(result.error?.code, result.error?.field);
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

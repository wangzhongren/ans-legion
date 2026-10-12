import { createInterface } from 'node:readline';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { createHeadlessWorkbenchPipeline } from '../apps/desktop/src/pipelines/workbench.mjs';

export function chatOptions(args, env = process.env) {
  const allowed = new Set(['project','user-data','protocol','provider','model','base-url']);
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]?.slice(2);
    if (!args[index]?.startsWith('--') || !allowed.has(name) || !args[index + 1] || values[name]) throw new TypeError('invalid_cli_options');
    values[name] = args[index + 1];
  }
  const profile = { protocol: values.protocol ?? env.LEGION_PROTOCOL, provider: values.provider ?? env.LEGION_PROVIDER,
    modelId: values.model ?? env.LEGION_MODEL, baseUrl: values['base-url'] ?? env.LEGION_BASE_URL };
  if (Object.values(profile).some(value => !value)) throw new TypeError('missing_model_configuration');
  return { project: resolve(values.project ?? process.cwd()), userDataDir: resolve(values['user-data'] ?? join(homedir(), '.legion')), profile };
}
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
export function deliverySummary(state) {
  const lines = ['交付结果 / Delivery: ' + state.plan?.status];
  const monitor = state.supervisions?.findLast(item => item.phase === 'monitor' && item.planDigest === state.plan?.planDigest);
  const evidenceIds = new Set((state.tasks ?? []).flatMap(task => task.evidenceIds ?? []));
  const acceptanceIds = new Set((monitor?.resultStates?.acceptances ?? []).map(item => item.id));
  for (const task of state.tasks ?? []) {
    lines.push(`${task.title ?? task.id} [${task.roleId}] ${task.status} · Check ${task.checkStatus} · Acceptance ${task.acceptanceStatus ?? 'pending'}`);
    for (const result of [...(task.results ?? []), ...(task.retainedOutputs ?? []), ...(task.generatedOutputs ?? [])]) {
      let status = 'observed'; if (result.success) status = 'written'; if (result.status) status = result.status;
      lines.push(`  ${result.resource} · ${result.action ?? 'retain'} · ${status}`);
    }
    if (task.error) lines.push('  失败 / Failure: ' + task.error.code);
  }
  const currentEvidence = (state.evidence ?? []).filter(item => item.planDigest === state.plan?.planDigest && evidenceIds.has(item.id) && (state.tasks ?? []).some(task => task.id === item.taskId && task.runId === item.result?.runId));
  if (currentEvidence.length < evidenceIds.size) lines.push('检查详情未展示 / Evidence omitted: ' + (evidenceIds.size - currentEvidence.length));
  for (const evidence of currentEvidence) lines.push(`检查 / Check ${evidence.checkId ?? evidence.result?.checkId}: ${evidence.result?.status ?? evidence.status} · executed ${evidence.result?.executed ?? evidence.executed}`);
  for (const acceptance of (state.acceptances ?? []).filter(item => item.planDigest === state.plan?.planDigest && acceptanceIds.has(item.id))) lines.push(`独立验收 / Acceptance ${acceptance.taskId}: ${acceptance.decision}`);
  lines.push('二哥监控: ' + (monitor?.status ?? 'not_completed'));
  if (monitor?.advice) {
    lines.push('建议 / Recommendation: ' + monitor.advice.recommendation);
    for (const finding of monitor.advice.findings) lines.push(`${finding.severity}: ${finding.reason} · 来源 ${finding.sourceRefs.join(', ')}`);
  }
  if (state.plan?.status !== 'completed' || monitor?.status !== 'completed') lines.push('剩余风险 / Remaining: 当前交付或监督尚未完整通过，请与二哥讨论。');
  else lines.push('剩余风险 / Remaining: 此摘要仅说明本次计划的实际检查与验收结果。');
  return lines.map(clean).join('\n');
}
export function interactionIdentity(request) {
  return JSON.stringify([request.requestId, request.version, request.digest]);
}
export function discardInteractionError(code) {
  return ['stale_interaction', 'interaction_invalidated', 'stale_file_owners'].includes(code);
}
export function selectInteraction(state, unavailable = new Set()) {
  const requests = (state.interactions ?? []).filter(request => {
    if (request.status !== 'pending' || unavailable.has(interactionIdentity(request))) return false;
    if (request.projectId !== state.currentProject?.id) return false;
    if (request.purpose !== 'execute_plan') return true;
    if (!state.plan || request.bindings?.planDigest !== state.plan.planDigest) return false;
    if (state.organization && (request.bindings.organizationDigest !== state.organization.digest || request.bindings.organizationRevision !== state.organization.revision)) return false;
    if (state.plan.contextSnapshotDigest && request.bindings.contextDigest !== state.plan.contextSnapshotDigest) return false;
    if (state.plan.profileBindings && !state.plan.profileBindings.some(binding => binding.profileVersion === request.bindings.profileVersion)) return false;
    return true;
  });
  requests.sort((left, right) => right.createdOrder - left.createdOrder);
  return requests[0];
}
export async function runChat(args, { input = process.stdin, output = process.stdout, error = process.stderr } = {}) {
  let host;
  let lines;
  let stopping = false;
  let projectId;
  const queue = [];
  let pending;
  let eof = false;
  const write = value => output.write(clean(value) + '\n');
  const fail = result => { if (!result.ok) throw new Error(result.error.code); return result.value; };
  const next = () => { if (queue.length) return Promise.resolve(queue.shift()); if (eof) return Promise.resolve(null); return new Promise(done => { pending = done; }); };
  const cancel = async () => {
    if (!host || !projectId) return;
    const state = fail(await host.getState());
    if (state.turn && ['running','waiting'].includes(state.turn.status)) fail(await host.cancelTurn({ projectId, turnId: state.turn.id }));
    fail(await host.stopExecution({ projectId })); write('已取消 / Cancelled');
  };
  const stop = () => { stopping = true; if (pending) { const done = pending; pending = null; done(null); } };
  const interrupt = () => { void cancel().catch(() => write('取消失败 / Cancellation failed')); };
  try {
    const options = chatOptions(args);
    host = createHeadlessWorkbenchPipeline({ userDataDir: options.userDataDir, profile: options.profile });
    projectId = fail(await host.selectProject(options.project)).currentProject.id;
    lines = createInterface({ input, terminal: false });
    lines.on('line', line => {
      if (line === '/cancel') { interrupt(); return; }
      if (line === '/exit') { stop(); return; }
      if (pending) { const done = pending; pending = null; done(line); } else queue.push(line);
    });
    lines.on('close', () => { eof = true; if (pending) { const done = pending; pending = null; done(null); } });
    process.on('SIGINT', interrupt); process.on('SIGTERM', stop);
    write('二哥 · /cancel 取消 · /exit 退出');
    let printedTurn = null;
    let delivered = null;
    let inputPrompted = false;
    const unavailable = new Set();
    while (!stopping) {
      let state = fail(await host.getState());
      const request = selectInteraction(state, unavailable);
      if (request) {
        write(`${request.title}\n${request.text}`);
        for (const option of request.options ?? []) write(`${option.id}: ${option.label}`);
        if (request.kind === 'confirmation') write('Answer> yes / no');
        else write('Answer>');
        const answer = await next(); if (answer === null) break;
        let value = answer;
        if (request.kind === 'confirmation') {
          if (!['yes','no','是','否'].includes(answer.trim().toLowerCase())) { write('请输入 yes 或 no'); continue; }
          value = ['yes','是'].includes(answer.trim().toLowerCase());
        }
        if (request.kind === 'choice') {
          const parts = answer.trim().split(/\s+/);
          const optionId = parts.shift(); let supplement = '';
          if (request.allowSupplement) supplement = parts.join(' ');
          value = { optionId, text: supplement };
        }
        const result = await host.answerInteraction({ projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, value });
        if (!result.ok) {
          write('答复被拒绝 / Refused: ' + result.error.code);
          if (discardInteractionError(result.error.code)) unavailable.add(interactionIdentity(request));
        }
        continue;
      }
      if (['running','waiting'].includes(state.turn?.status)) { await delay(100); continue; }
      if (state.turn?.id && printedTurn !== state.turn.id) {
        printedTurn = state.turn.id;
        write('二哥: ' + (state.turn.text ?? state.history?.messages?.findLast(item => item.role === 'assistant')?.text ?? ''));
        if (state.turn.status === 'failed' || state.error) write('失败 / Failure: ' + (state.error?.code ?? state.turn.error?.code ?? 'run_failed'));
      }
      if (state.plan && ['completed','failed','invalidated','cancelled'].includes(state.plan.status) && delivered !== state.plan.planDigest + state.plan.status) {
        const deadline = Date.now() + 20000;
        while (!stopping && !state.supervisions?.some(item => item.phase === 'monitor' && ['completed','failed'].includes(item.status)) && !queue.length && Date.now() < deadline) { await delay(100); state = fail(await host.getState()); }
        if (!queue.length) { write(deliverySummary(state)); delivered = state.plan.planDigest + state.plan.status; }
      }
      if (stopping) break;
      if (!inputPrompted) { write('二哥>'); inputPrompted = true; }
      let text;
      if (['confirmed','running'].includes(state.plan?.status)) {
        if (eof && !queue.length) break;
        if (!queue.length) { await delay(100); continue; }
        text = queue.shift();
      } else text = await next();
      if (text === null) break;
      inputPrompted = false;
      const result = await host.sendMessage({ projectId, roleId: 'Supervisor', text });
      if (!result.ok) write('请求被拒绝 / Refused: ' + result.error.code);
    }
    return 0;
  } catch (caught) {
    const known = ['invalid_cli_options','missing_model_configuration'];
    let reason = 'cli_request_failed'; if (known.includes(caught.message)) reason = caught.message;
    error.write('二哥: ' + reason + '\n'); return 1;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', stop);
    lines?.close();
    if (host) { const result = await host.close(); if (!result.ok) error.write('二哥: cleanup_failed\n'); }
  }
}

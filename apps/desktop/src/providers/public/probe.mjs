import { probeOptions } from '../abstract/probe.mjs';
import { ProbeProviderImpl } from '../impl/probe.mjs';

export function createProbeProvider(options = {}) {
  const provider = new ProbeProviderImpl(probeOptions(options));
  return Object.freeze({ run: provider.run.bind(provider), state: provider.state.bind(provider), cancel: provider.cancel.bind(provider), close: provider.close.bind(provider) });
}

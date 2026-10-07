import {
  historyProviderOptions
} from '../abstract/history.mjs';
import {
  HistoryProviderImpl
} from '../impl/history.mjs';
export function createHistoryProvider(options) {
  const provider = new HistoryProviderImpl(historyProviderOptions(options));
  return Object.freeze({
    read: provider.read.bind(provider),
    write: provider.write.bind(provider),
    close: provider.close.bind(provider)
  });
}

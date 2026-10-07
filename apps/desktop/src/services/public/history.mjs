import {
  historyServiceOptions
} from '../abstract/history.mjs';
import {
  HistoryServiceImpl
} from '../impl/history.mjs';
export function createHistoryService(options) {
  const service = new HistoryServiceImpl(historyServiceOptions(options));
  return Object.freeze({
    load: service.load.bind(service),
    save: service.save.bind(service),
    close: service.close.bind(service)
  });
}

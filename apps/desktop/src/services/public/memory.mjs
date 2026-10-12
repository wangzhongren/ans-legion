import { MemoryServiceImpl } from '../impl/memory.mjs';
export function createMemoryService(options){const service=new MemoryServiceImpl(options);return Object.freeze(Object.fromEntries(['remember','query','inspect','close'].map(name=>[name,service[name].bind(service)])));}

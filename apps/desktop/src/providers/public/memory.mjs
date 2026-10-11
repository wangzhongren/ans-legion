import { MemoryProviderImpl } from '../impl/memory.mjs';
export function createMemoryProvider(options){const provider=new MemoryProviderImpl(options);return Object.freeze(Object.fromEntries(['read','write','newId','now','close'].map(name=>[name,provider[name].bind(provider)])));}

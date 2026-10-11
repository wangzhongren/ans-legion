export class MutationError extends Error {}
export class MutationService {
  constructor() { if (new.target === MutationService) throw new TypeError("abstract_mutation_service"); }
  static assert(value) {
    const methods = ["observeTime", "execute", "recordEvents", "events", "readFile", "createIdentity", "workspace", "close"];
    if (!(value instanceof MutationService) || methods.some((method) => typeof value[method] !== "function")) {
      throw new TypeError("invalid_mutation_service");
    }
    return value;
  }
}

// Mutation construction forwards private leaseContext data to adjacent Storage only.
// No upper-layer or peer Provider IO callback is part of this contract.

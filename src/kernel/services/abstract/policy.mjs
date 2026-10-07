/** Pure policy contract. No permit issuance or infrastructure access. */
export class PolicyService {
  constructor() { if (new.target === PolicyService) throw new TypeError("abstract_policy_service"); }
  static assert(value) {
    if (!(value instanceof PolicyService) || typeof value.evaluate !== "function" ||
        typeof value.validateScope !== "function") throw new TypeError("invalid_policy_service");
    return value;
  }
}

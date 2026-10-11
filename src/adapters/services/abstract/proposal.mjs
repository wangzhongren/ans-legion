/** Pure write/edit proposal conversion contract. Read/check/control requests are rejected.
 * Concrete variants remain internal; converting a proposal never executes it. */
export class ProposalService {
  constructor() {
    if (new.target === ProposalService) throw new TypeError("abstract_proposal_service");
  }
  static assert(value) {
    if (!(value instanceof ProposalService) || typeof value.convert !== "function") {
      throw new TypeError("invalid_proposal_service");
    }
    return value;
  }
}

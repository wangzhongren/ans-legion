import { ProposalService } from "../abstract/proposal.mjs";
import { _ProposalService, _CodexAdapter, _ClaudeAdapter } from "../impl/proposal.mjs";

export { ProposalService };
export function createProposalService() { return ProposalService.assert(new _ProposalService()); }
export function createCodexAdapter() { return ProposalService.assert(new _CodexAdapter()); }
export function createClaudeAdapter() { return ProposalService.assert(new _ClaudeAdapter()); }

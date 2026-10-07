import { ProposalService } from "../abstract/proposal.mjs";
import { ActionProposal, AgentSession } from "../../../kernel/models/core.mjs";
import { PiToolRequest } from "../../../kernel/models/agent.mjs";

export class _ProposalService extends ProposalService {
  convert(request, session) {
    if (!(request instanceof PiToolRequest) || request.tool !== "legion_write_file") {
      throw new TypeError("invalid_controlled_request");
    }
    if (!(session instanceof AgentSession)) throw new TypeError("invalid_trusted_session");
    return new ActionProposal({ proposalId: request.requestId, runId: request.runId,
      action: "write_file", capability: "write_file", tool: "legion_write_file",
      resource: request.parameters.resource, content: request.parameters.content, session });
  }
}
export class _CodexAdapter extends _ProposalService {}
export class _ClaudeAdapter extends _ProposalService {}

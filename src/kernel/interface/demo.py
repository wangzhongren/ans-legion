"""Run `python -m kernel.interface.demo` with PYTHONPATH=src."""
from dataclasses import asdict, replace
import json
from kernel.models.core import AgentSession, ActionProposal, RoleBoundary
from kernel.pipelines.permission import PermissionRuntime


def run_demo():
    """Return observations and readable events; Provider owns the temporary workspace."""
    backend = AgentSession("backend-session","Backend","demo-task","v1")
    frontend = AgentSession("frontend-session","Frontend","setup-task","v1")
    stale = AgentSession("stale-session","Backend","stale-task","v0")
    backend_boundary = RoleBoundary("Backend",write_scope=("backend/",),
        deny_scope=("backend/private/",),capabilities={"write_file"},tools={"legion_write_file"})
    frontend_boundary = RoleBoundary("Frontend",write_scope=("frontend/",),
        capabilities={"write_file"},tools={"legion_write_file"})
    observations = []
    with PermissionRuntime(None,[backend_boundary,frontend_boundary],[backend,frontend,stale],"v1") as runtime:
        setup = ActionProposal("setup-login","write_file","frontend/login.vue","original login",
            "legion_write_file","write_file",frontend)
        setup_decision, setup_result = runtime.submit(setup)
        if not setup_result.success:
            raise RuntimeError("demo_setup_failed: " + setup_result.status)
        proposal = ActionProposal("allowed-backend","write_file","backend/service.py","print('backend')",
            "legion_write_file","write_file",backend)
        cases = [proposal,
            replace(proposal,proposal_id="denied-frontend",resource="frontend/login.vue",content="replacement"),
            replace(proposal,proposal_id="missing-tool",tool="shell"),
            replace(proposal,proposal_id="missing-capability",capability="network"),
            replace(proposal,proposal_id="explicit-deny",resource="backend/private/key"),
            replace(proposal,proposal_id="stale-version",session=stale)]
        for case in cases:
            decision,result = runtime.submit(case)
            observations.append({"case":case.proposal_id,"decision":decision.outcome.value,
                "reason":decision.reason,"status":result.status,"observed_mutation":result.observed_mutation})
        preserved = runtime.read_file("frontend/login.vue") == "original login"
        written = runtime.read_file("backend/service.py") == proposal.content
        events = [asdict(event) for event in runtime.events()]
    return {"organization_version":"v1","observations":observations,
        "frontend_preserved":preserved,"backend_written":written,"events":events}


def main():
    report = run_demo()
    for observation in report["observations"]:
        print(json.dumps(observation,ensure_ascii=False,sort_keys=True))
    print("backend_written=" + str(report["backend_written"]))
    print("frontend_preserved=" + str(report["frontend_preserved"]))
    print("events:")
    for event in report["events"]:
        print(json.dumps(event,ensure_ascii=False,sort_keys=True))
    if not report["backend_written"] or not report["frontend_preserved"]:
        raise RuntimeError("demo_observation_failed")


if __name__ == "__main__":
    main()

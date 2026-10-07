import { runPermissionDemo } from "../pipelines/permission.mjs";
const demo = await runPermissionDemo();
for (const row of demo.rows) console.log(row.scenario + ": " + row.decision.outcome + " / " + row.result.status + " / " + row.result.reason);
console.log("backendWritten=" + demo.backendWritten + " frontendPreserved=" + demo.frontendPreserved);
for (const event of demo.events) console.log(JSON.stringify(event));
if (!demo.backendWritten || !demo.frontendPreserved || demo.rows[0].result.status !== "written" ||
    demo.rows.slice(1).some((row) => row.result.status !== "denied")) throw new Error("permission_demo_failed");

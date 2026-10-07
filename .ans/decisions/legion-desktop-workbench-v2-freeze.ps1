$ErrorActionPreference='Stop'
$projectDirectory='D:\work\code-work\agent-organization-runtime'
$phaseId='legion-desktop-workbench-v2'
$decisionDirectory=Join-Path $projectDirectory '.ans/decisions'
$candidate=Get-Content -LiteralPath (Join-Path $decisionDirectory ($phaseId+'-candidate.json')) -Raw | ConvertFrom-Json -AsHashtable
if($candidate.status -ne 'OWNER_SCOPES_ACCEPTED'){throw 'Do not freeze unaccepted candidate scopes.'}
$canonicalPath=Join-Path $projectDirectory 'docs/design/2026-10-07_design_desktop-workbench-v2.md'
$canonicalHash=(Get-FileHash -LiteralPath $canonicalPath -Algorithm SHA256).Hash.ToLowerInvariant()
if($canonicalHash -ne $candidate.canonicalSha256){throw 'Canonical does not match accepted version.'}
$checks=Get-Content -LiteralPath (Join-Path $decisionDirectory ($phaseId+'-checks.json')) -Raw | ConvertFrom-Json -AsHashtable
$stageScopes=Get-Content -LiteralPath (Join-Path $decisionDirectory ($phaseId+'-stages.json')) -Raw | ConvertFrom-Json -AsHashtable
$manifest=[ordered]@{}
$generated=[ordered]@{}
$roleDefinitions=[ordered]@{}
$owners=@{}
$responsibilities=@{
 ProjectManager='整体架构、有限Node公开入口、实际本地依赖与Windows发行包、跨角色管理评审'
 Supervisor='唯一task_ops scheduler、精确派发、依赖验证与完整工作台交付'
 KernelEngineer='共享批准与会话Model、Policy scope和Storage写前上下文重查'
 AgentAdapterEngineer='真实Pi多轮、纯数据连接、流事件、取消与受限恢复'
 DesktopEngineer='唯一Workbench Pipeline、用户项目/历史与上下文、专注对话GUI和IPC'
 Reviewer='独立结构/权限/IPC/凭据/发行源审查；不修生产'
 Tester='独立真实Pi协议、完整执行/取消/重启/项目隔离和实际ZIP GUI回归；不修生产'
}
function SaveUtf8([string]$relativePath,[string]$content){
 $absolutePath=Join-Path $projectDirectory $relativePath
 $parentPath=Split-Path -Parent $absolutePath
 [IO.Directory]::CreateDirectory($parentPath)|Out-Null
 [IO.File]::WriteAllText($absolutePath,$content,[Text.UTF8Encoding]::new($false))
}
foreach($roleId in @('ProjectManager','Supervisor','KernelEngineer','AgentAdapterEngineer','DesktopEngineer','Reviewer','Tester')){
 $specification=$candidate.owners[$roleId]
 $paths=@($specification.source)+@($specification.tests)
 foreach($document in $candidate.commonDocsPerRole){$paths+='docs/roles/'+$roleId+'/'+$document}
 foreach($feature in $specification.features){$paths+='docs/roles/'+$roleId+'/docs/feature/'+$feature+'.md'}
 if($specification.ContainsKey('extraDocs')){$paths+=@($specification.extraDocs)}
 foreach($relativePath in $paths){
  if($relativePath -match '(^[/\\]|^[A-Za-z]:|\.\.|[?*]|\\)'){throw ('Unsafe exact scope: '+$relativePath)}
  if($owners.ContainsKey($relativePath)){throw ('Duplicate owner: '+$relativePath)}
  $owners[$relativePath]=$roleId
 }
 $manifest[$roleId]=$paths
 $effectPaths=@($candidate.generatedByRole[$roleId])
 $generated[$roleId]=$effectPaths
 $roleChecks=$checks[$roleId]
 if($null -eq $roleChecks){$roleChecks=[ordered]@{}}
 foreach($checkEntry in $roleChecks.GetEnumerator()){
  if($checkEntry.Value.timeoutSeconds -lt 1 -or $checkEntry.Value.timeoutSeconds -gt 300){throw ('Invalid check timeout: '+$roleId+'/'+$checkEntry.Key)}
  if($checkEntry.Value.argv[0] -ne 'node'){throw ('Product checks must use Node: '+$roleId+'/'+$checkEntry.Key)}
 }
 $roleDefinitions[$roleId]=[ordered]@{autoDispatch=$true;card='.ans/roles/'+$roleId+'/role-card.md';boundary='.ans/roles/'+$roleId+'/boundary.md';operations=@('implement','review','test');writeFiles=$paths;checks=$roleChecks}
}
foreach($stage in $stageScopes.GetEnumerator()){
 foreach($relativePath in $stage.Value){if(-not $owners.ContainsKey($relativePath)){throw ('Stage contains unowned path: '+$stage.Key+'/'+$relativePath)}}
}
$effectOwners=@{}
foreach($roleEntry in $generated.GetEnumerator()){
 foreach($path in $roleEntry.Value){
  foreach($existing in $effectOwners.Keys){if($path.StartsWith($existing,[StringComparison]::OrdinalIgnoreCase) -or $existing.StartsWith($path,[StringComparison]::OrdinalIgnoreCase)){throw ('Overlapping generated effects: '+$path)}}
  $effectOwners[$path]=$roleEntry.Key
 }
}
$policy=[ordered]@{schemaVersion=1;projectName='Legion Runtime';authorizationSource='Direct customer 确认 after reviewed legion-desktop-workbench-v2; .ans/decisions/legion-desktop-workbench-v2-authorization.md';designFiles=@('docs/design/2026-10-07_design_desktop-workbench-v2.md');maxConcurrentWorkers=2;allowRequirementRevision=$false;allowDesignRevision=$false;roles=$roleDefinitions}
SaveUtf8 ('.ans/decisions/'+$phaseId+'-manifest.json') ((ConvertTo-Json -InputObject $manifest -Depth 10)+"`n")
SaveUtf8 '.ans/project.json' ((ConvertTo-Json -InputObject $policy -Depth 16)+"`n")
foreach($roleId in $manifest.Keys){
 $boundaryLines=@('# Section 1: 可修改文件与执行效果','','客户已确认工作台v2；task writeSet只能缩小本清单。权限以本阶段精确策略与实际派发为准。旧历史产物和未列出的源文件只读。','','| 类型 | 项目相对路径 | 用途 |','| --- | --- | --- |')
 foreach($path in $manifest[$roleId]){$boundaryLines+=('| 文件 | `'+$path+'` | '+$roleId+'独占 authored；实际任务需派发 |')}
 foreach($path in $generated[$roleId]){$boundaryLines+=('| 条件生成目录 | `'+$path+'` | 本角色本阶段实际检查/安装/打包效果；不得手改依赖源码 |')}
 if($roleId -eq 'Supervisor'){
  $boundaryLines+='| 条件目录 | `docs/scheduling/` | 仅task_ops生成本阶段记录 |'
  $boundaryLines+='| 文件 | `.ans/handoffs/active/governance-legion-desktop/acceptance.md` | 本角色独占正式接收 |'
 }
 $boundaryLines+=@('','固定检查可创建localhost受控协议服务、启动项目安装的Electron及仅关闭本次跟踪的进程。TEMP/userData/fixture/截图在自己的本阶段隔离生成路径；不得写旧runtime阶段、全局Pi配置或客户实际源码。递归清理前核对真实绝对路径属于自己的生成子目录且无链接跳转。')
 if($roleId -eq 'ProjectManager'){$boundaryLines+='仅PM安装项目内真实本地tarball及必要依赖、使用官方Electron安装能力与生成ZIP；不全局安装、不注册表发布、不改依赖包源码。'}
 $boundaryLines+='其他角色源码、治理/组织/角色/策略、旧Node tarball及旧GUI ZIP只读。客户确认具体计划后动态Agent执行已纳入v2；不启用任意Shell检查执行器。'
 SaveUtf8 ('.ans/roles/'+$roleId+'/boundary.md') (($boundaryLines -join "`n")+"`n")
 $pathsJson=ConvertTo-Json -InputObject @($manifest[$roleId]) -Compress
 $effectsJson=ConvertTo-Json -InputObject @($generated[$roleId]) -Compress
 $boundaryYaml=@('schema_version: 1',('role_id: '+$roleId),'status: ACCEPTED',('version: '+$phaseId),"read_scope: ['project/**']",('write_scope: '+$pathsJson),('generated_effect_scope: '+$effectsJson),"deny_scope: ['outside_boundary', '.ans/organization/**', '.ans/roles/**', '.ans/project.json', 'historical_runtime_artifacts']",'approval_source: direct_customer_workbench_v2_confirm_2026-10-07')
 SaveUtf8 ('.ans/roles/'+$roleId+'/boundary.yaml') (($boundaryYaml -join "`n")+"`n")
 $reporting='Supervisor'
 if($roleId -eq 'ProjectManager' -or $roleId -eq 'Reviewer'){$reporting='Human'}
 if($roleId -eq 'Supervisor'){$reporting='ProjectManager'}
 $roleYaml=@('schema_version: 1',('id: '+$roleId),('name: '+$roleId),('responsibility: "'+$responsibilities[$roleId]+'"'),'status: ACCEPTED',"read_scope: ['project/**']",('write_scope: '+$pathsJson),'authority_source: boundary.md',"deny_scope: [outside_boundary]",'tools: [read,scoped_edit,approved_checks]',"capabilities: ['workbench_v2_authorized_role_task']",'allowed_actions: [authorized_role_task]','forbidden_actions: [self_expand,self_approve,peer_mutation]','delegation_scope: []',"handoff_targets: ['Supervisor']",'required_approvals: [human_for_material_scope_change]',('reporting_line: '+$reporting),("memory_scope: 'docs/roles/"+$roleId+"/'"),'contracts: [desktop-workbench,kernel-adapter,kernel-runtime]')
 SaveUtf8 ('.ans/roles/'+$roleId+'/role.yaml') (($roleYaml -join "`n")+"`n")
 $card=@(('# '+$roleId),'','你是本职责的长期维护者。理解实际使用、上下游与未来维护，交付可持续维护的可用结果；这不会扩大权限。','',('职责：'+$responsibilities[$roleId]+'。'),'','## 固定身份与必读','',('本上下文终身只绑定'+$roleId+'；阅读同行资料不激活同行身份。权限只见 [boundary.md](boundary.md) Section 1，task_ops只缩小此范围。'),'必读：[已确认v2](../../../docs/design/2026-10-07_design_desktop-workbench-v2.md)、[客户确认](../../decisions/legion-desktop-workbench-v2-authorization.md)、[管理评审](../../decisions/legion-desktop-workbench-v2-review.md)、desktop-workbench/kernel-adapter/kernel-runtime契约、本阶段manifest/stages/freeze，以及ans-governed-construction SKILL.md、architecture/testing/documentation/evidence/coordination/workflow。','各层须读相应model/provider/service/pipeline/interface指南；PM另读entrypoint/proposal-review/api-spec，Supervisor另读scheduler/task-operations。','','## 执行与质量','','客户已对同版回复“确认”，无需重复同版审批。依 Model→Provider→Service→Pipeline→Interface构造，只通过相邻层公开入口；Model无外部效果。唯一Workbench Pipeline由Desktop维护，只组合公开Services，不调用Core Interface或peer PermissionRuntime。','保持Service/Provider三层。不得三元、吞异常、私有跨层访问、留stub、弱化断言或以skip冒充通过。真实运行错误必须保留安全可诊断原因；SDK原文和凭据不出renderer或日志。','讨论仅Adapter/userData，禁止调用Mutation或客户目录审计。Human确认绑定plan/workspace/profile/context/role/task/writeSet；范围或上下文变更、取消、关闭撤销；旧requiredApprovals和.ans硬拒绝不变。','仅Supervisor派发worker；能力角色不派发子agent，本上下文不换角色。每个owner先写具体角色设计，再在已确认canonical范围内实现，无重大差异不重复客户gate。','实际checks记录候选、输入、命令和结果；变更依赖后重验调用方。旧141与GUI原型不充当v2证据；未知模型metadata/费用保持unknown，软件检查尚未运行显示not_executed。','所有测试副作用在本角色隔离生成范围；关闭资源可重复、只清理本次进程。Tester独立完整Node/三协议/多轮/确认/取消/DPAPI/ZIP/视觉验收；Reviewer和Tester不修生产。','','## 功能导航','',('维护 [feature-map](../../../docs/roles/'+$roleId+'/feature-map.md)，当前功能与设计历史按真实行为更新。治理授权不代表生产完成。'))
 SaveUtf8 ('.ans/roles/'+$roleId+'/role-card.md') (($card -join "`n")+"`n")
}
$policyHash=(Get-FileHash -LiteralPath (Join-Path $projectDirectory '.ans/project.json') -Algorithm SHA256).Hash.ToLowerInvariant()
$manifestHash=(Get-FileHash -LiteralPath (Join-Path $decisionDirectory ($phaseId+'-manifest.json')) -Algorithm SHA256).Hash.ToLowerInvariant()
$authorizationHash=(Get-FileHash -LiteralPath (Join-Path $decisionDirectory ($phaseId+'-authorization.md')) -Algorithm SHA256).Hash.ToLowerInvariant()
$freeze=[ordered]@{schemaVersion=1;phase=$phaseId;status='GOVERNANCE_FROZEN_IMPLEMENTATION_AUTHORIZED_NOT_VERIFIED';configSha256=$policyHash;designSha256=$canonicalHash;authorizationSha256=$authorizationHash;manifestSha256=$manifestHash;authoredFileCount=$owners.Count;roles=@($manifest.Keys);generatedEffects=$generated;previousPolicy='.ans/decisions/legion-desktop-workbench-v2-previous-policy.json';previousPolicySha256='e72ba37fc080453ecf9ef0229c5f6f11bf4e41ecf017cf2febf85cea6ef6d89d';review='.ans/decisions/legion-desktop-workbench-v2-review.md';defaultLayout='focus_conversation';publicSymbolsContract='.ans/contracts/desktop-workbench.yaml';versions=$candidate.versionsProposal}
SaveUtf8 ('.ans/decisions/'+$phaseId+'-freeze.json') ((ConvertTo-Json -InputObject $freeze -Depth 12)+"`n")
$organizationLines=@('schema_version: 1','status: ACCEPTED','version: v004','approval_source: direct_customer_workbench_v2_confirm_2026-10-07','roles:')
foreach($roleId in $manifest.Keys){$reporting=$roleDefinitions[$roleId];$reportingLine='Supervisor';if($roleId -eq 'ProjectManager' -or $roleId -eq 'Reviewer'){$reportingLine='Human'};if($roleId -eq 'Supervisor'){$reportingLine='ProjectManager'};$organizationLines+='  - {id: '+$roleId+', status: ACCEPTED, reporting_line: '+$reportingLine+", role: '../roles/"+$roleId+"/role.yaml', boundary: '../roles/"+$roleId+"/boundary.yaml'}"}
$organizationLines+=@('delegations: []','handoff_topology: graph.yaml','canonical_design: docs/design/2026-10-07_design_desktop-workbench-v2.md',('design_sha256: '+$canonicalHash),('policy_sha256: '+$policyHash),'path_base: project_root_for_canonical_design; organization_directory_for_role_refs')
$organizationText=($organizationLines -join "`n")+"`n"
if(Test-Path -LiteralPath (Join-Path $projectDirectory '.ans/organization/versions/v004.yaml')){throw 'Never overwrite an organization version.'}
SaveUtf8 '.ans/organization/versions/v004.yaml' $organizationText
SaveUtf8 '.ans/organization/current.yaml' $organizationText
Write-Output ('Frozen exact ownership: '+$owners.Count+' authored files; '+$effectOwners.Count+' generated scopes; '+$policyHash)

$ErrorActionPreference='Stop'
$projectDirectory='D:\work\code-work\agent-organization-runtime'
$candidate=Get-Content -LiteralPath (Join-Path $projectDirectory '.ans/decisions/legion-desktop-workbench-v2-candidate.json') -Raw | ConvertFrom-Json -AsHashtable
$scopes=[ordered]@{}
function CompleteOwnerScope([string]$roleId){
 $specification=$candidate.owners[$roleId]
 $paths=@($specification.source)+@($specification.tests)
 foreach($document in $candidate.commonDocsPerRole){$paths+='docs/roles/'+$roleId+'/'+$document}
 foreach($feature in $specification.features){$paths+='docs/roles/'+$roleId+'/docs/feature/'+$feature+'.md'}
 if($specification.ContainsKey('extraDocs')){$paths+=@($specification.extraDocs)}
 return $paths
}
$scopes.kernel=@(CompleteOwnerScope 'KernelEngineer')
$scopes.adapter=@(CompleteOwnerScope 'AgentAdapterEngineer')
$scopes.'core-package-deps'=@('package.json','package-lock.json','workbench.mjs','README.md','tests/package/test_package.mjs','docs/roles/ProjectManager/docs/feature/distribution.md','docs/roles/ProjectManager/docs/design/2026-10-07_design_desktop-workbench-v2.md','apps/desktop/package.json','apps/desktop/package-lock.json','apps/desktop/scripts/install-electron.mjs','apps/desktop/scripts/verify-dependencies.mjs')
$scopes.'desktop-package'=@((CompleteOwnerScope 'ProjectManager')|Where-Object {$_ -notin $scopes.'core-package-deps'})
$allDesktop=@(CompleteOwnerScope 'DesktopEngineer')
$interfacePaths=@('apps/desktop/src/interface/main.mjs','apps/desktop/src/interface/preload.cjs','apps/desktop/src/interface/index.html','apps/desktop/src/interface/renderer.mjs','apps/desktop/src/interface/styles.css','apps/desktop/tests/unit/pipeline.test.mjs','apps/desktop/tests/unit/ipc.test.mjs','docs/roles/DesktopEngineer/feature-map.md','docs/roles/DesktopEngineer/functional-description.md','docs/roles/DesktopEngineer/api-spec.md','docs/roles/DesktopEngineer/changelog.md','docs/roles/DesktopEngineer/docs/feature/desktop-console.md')
$scopes.'desktop-interface'=$interfacePaths
$scopes.'desktop-capabilities'=@($allDesktop|Where-Object {$_ -notin $interfacePaths})
$scopes.reviewer=@(CompleteOwnerScope 'Reviewer')
$scopes.tester=@(CompleteOwnerScope 'Tester')
$stagesPath=Join-Path $projectDirectory '.ans/decisions/legion-desktop-workbench-v2-stages.json'
[IO.File]::WriteAllText($stagesPath,(ConvertTo-Json -InputObject $scopes -Depth 8)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
foreach($entry in $scopes.GetEnumerator()){Write-Output ($entry.Key+': '+$entry.Value.Count+' exact files')}

$ErrorActionPreference='Stop'
$projectDirectory='D:\work\code-work\agent-organization-runtime'
$baselinePath=Join-Path $projectDirectory '.ans/decisions/legion-desktop-workbench-v2-protected-baseline.json'
if(Test-Path -LiteralPath $baselinePath){throw 'Baseline already exists; do not overwrite it.'}
$entries=[ordered]@{}
$paths=@(
 'docs/design/2026-10-07_design_desktop-gui-v1.md',
 'docs/design/2026-10-07_design_desktop-workbench-v2.md',
 '.ans/organization/versions/v001.yaml',
 '.ans/organization/versions/v002.yaml',
 '.ans/organization/versions/v003.yaml',
 '.ans/runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz',
 '.ans/runtime/legion-desktop-gui-v1/packaging/LegionDesktop-0.1.0-win32-x64.zip'
)
foreach($relativePath in $paths){
 $absolutePath=Join-Path $projectDirectory $relativePath
 $entry=Get-Item -LiteralPath $absolutePath
 $entries[$relativePath]=[ordered]@{bytes=$entry.Length;sha256=(Get-FileHash -LiteralPath $absolutePath -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$sourceFiles=Get-ChildItem -LiteralPath (Join-Path $projectDirectory 'src') -Recurse -File -Filter '*.mjs'
$sourcePaths=@($sourceFiles | ForEach-Object {[IO.Path]::GetRelativePath($projectDirectory,$_.FullName).Replace('\','/')})
$sourcePaths+=@('package.json','package-lock.json','runtime.mjs','bin/legion.mjs','README.md','apps/desktop/package.json','apps/desktop/package-lock.json')
$sources=[ordered]@{}
foreach($relativePath in $sourcePaths){$absolutePath=Join-Path $projectDirectory $relativePath;$sources[$relativePath]=(Get-FileHash -LiteralPath $absolutePath -Algorithm SHA256).Hash.ToLowerInvariant()}
$snapshot=[ordered]@{schemaVersion=1;purpose='Pre-mutation historical protection and actual source baseline; authorized exact v2 source may change';protected=$entries;currentSources=$sources}
$snapshotText=ConvertTo-Json -InputObject $snapshot -Depth 7
[IO.File]::WriteAllText($baselinePath,$snapshotText+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
Write-Output ('Recorded '+$entries.Count+' protected artifacts and '+$sources.Count+' current source hashes; product unmodified.')

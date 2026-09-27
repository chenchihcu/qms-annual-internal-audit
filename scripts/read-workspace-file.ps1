[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Path,

  [ValidateRange(1, 100000)]
  [int]$StartLine = 1,

  [ValidateRange(1, 2000)]
  [int]$LineCount = 200
)

$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$targetPath = (Resolve-Path -LiteralPath (Join-Path $workspaceRoot $Path)).Path
$rootPrefix = $workspaceRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

if (-not $targetPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Only files inside the project workspace can be read.'
}

if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
  throw 'The requested path is not a file.'
}

$lines = Get-Content -LiteralPath $targetPath -Encoding UTF8
$lastLine = [Math]::Min($lines.Count, $StartLine + $LineCount - 1)
if ($StartLine -gt $lines.Count) {
  throw "StartLine exceeds the file length ($($lines.Count) lines)."
}

for ($lineNumber = $StartLine; $lineNumber -le $lastLine; $lineNumber++) {
  '{0,5}: {1}' -f $lineNumber, $lines[$lineNumber - 1]
}

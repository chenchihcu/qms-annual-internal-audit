[CmdletBinding()]
param(
    [ValidateSet('inventory', 'risk-and-corrective-action', 'ncr-guidance')]
    [string]$Mode = 'inventory'
)

$ErrorActionPreference = 'Stop'
$knowledgeManagement = -join ([char[]]@(0x77E5, 0x8B58, 0x7BA1, 0x7406))
$standardsLibrary = -join ([char[]]@(0x570B, 0x969B, 0x898F, 0x7BC4, 0x8207, 0x6A19, 0x6E96))
$libraryRoot = Join-Path 'C:\Dropbox' ("01_{0}\01_{1}\11_IAQG_SCMH" -f $knowledgeManagement, $standardsLibrary)
$python = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$reader = Join-Path $PSScriptRoot 'read_scmh_library.py'

if (-not (Test-Path -LiteralPath $libraryRoot -PathType Container)) {
    throw "SCMH library folder is missing: $libraryRoot"
}
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Bundled Python runtime is missing.'
}
if (-not (Test-Path -LiteralPath $reader -PathType Leaf)) {
    throw 'Read-only SCMH reader is missing.'
}

$exitCode = 0
if ($Mode -eq 'inventory') {
    & $python -X utf8 $reader --root $libraryRoot --mode inventory
    $exitCode = $LASTEXITCODE
} elseif ($Mode -eq 'risk-and-corrective-action') {
    & $python -X utf8 $reader --root $libraryRoot --mode pdf --name Root-Cause-Analysis --pages 14-18,68-75
    $exitCode = $LASTEXITCODE
    if ($exitCode -eq 0) {
        & $python -X utf8 $reader --root $libraryRoot --mode pdf --name Risk-Based-Thinking-Details --pages 2-5,20-24
        $exitCode = $LASTEXITCODE
    }
} else {
    & $python -X utf8 $reader --root $libraryRoot --mode pdf --name Control-of-Nonconforming-Outputs-Guidance
    $exitCode = $LASTEXITCODE
}
if ($exitCode -ne 0) {
    throw "SCMH reader exited with code $exitCode."
}

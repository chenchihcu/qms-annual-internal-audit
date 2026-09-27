[CmdletBinding()]
param(
    [ValidateSet('settings', 'validation', 'tests', 'lint', 'store', 'release', 'event', 'all')]
    [string]$Target = 'all'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Show-Context {
    param(
        [string]$RelativePath,
        [string]$Pattern,
        [int]$Before,
        [int]$After
    )

    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Expected review source is missing: $RelativePath"
    }

    Write-Output "--- $RelativePath ---"
    $matches = Select-String -LiteralPath $path -Pattern $Pattern -Context $Before, $After
    if ($null -eq $matches) {
        Write-Output '(no matching source lines)'
        return
    }

    foreach ($match in $matches) {
        Write-Output ("line {0}: {1}" -f $match.LineNumber, $match.Line.Trim())
        foreach ($line in $match.Context.PreContext) {
            Write-Output ("  {0}" -f $line)
        }
        foreach ($line in $match.Context.PostContext) {
            Write-Output ("  {0}" -f $line)
        }
        Write-Output ''
    }
}

function Show-Range {
    param(
        [string]$RelativePath,
        [int]$Start,
        [int]$Count
    )

    $path = Join-Path $repoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Expected review source is missing: $RelativePath"
    }

    $lines = Get-Content -LiteralPath $path
    $end = [Math]::Min($lines.Count, $Start + $Count - 1)
    Write-Output "--- $RelativePath ($Start-$end) ---"
    for ($lineNumber = $Start; $lineNumber -le $end; $lineNumber++) {
        Write-Output ("{0,4}: {1}" -f $lineNumber, $lines[$lineNumber - 1])
    }
}

if ($Target -eq 'settings' -or $Target -eq 'all') {
    Show-Context 'src/components/SettingsPanel.tsx' 'standardFieldErrors|procedureFieldErrors|standardErrors|procedureErrors|role=' 5 8
    Show-Context 'src/components/ui/Badge.tsx' 'InputProps|export function Input|export const Input|error\??:|hint\??:|aria-invalid|text-red|role=' 5 8
}

if ($Target -eq 'validation' -or $Target -eq 'all') {
    Show-Context 'src/lib/auditProfileValidation.ts' 'standardFieldErrors|procedureFieldErrors|standardReady|procedureSourceReady' 3 8
}

if ($Target -eq 'tests' -or $Target -eq 'all') {
    Show-Context 'src/components/__tests__/SettingsPanel.test.tsx' 'standardFieldErrors|procedureFieldErrors|standardErrors|procedureErrors|role=|describe\(|it\(' 4 7
    Show-Context 'src/lib/__tests__/auditProfileValidation.test.ts' 'standardFieldErrors|procedureFieldErrors|standardReady|procedureSourceReady' 3 6
}

if ($Target -eq 'lint' -or $Target -eq 'all') {
    Show-Range 'src/components/ProcedureAuditPanel.tsx' 88 28
    Show-Range 'src/components/DepartmentOwnerField.tsx' 26 24
    Show-Range 'src/components/NCRList.tsx' 56 25
    Show-Range 'src/components/Observations.tsx' 55 38
    Show-Range 'src/components/PersonnelPage.tsx' 174 28
    Show-Range 'src/hooks/useAuditStore.ts' 463 24
    Show-Range 'src/hooks/useAuditStore.ts' 744 22
}

if ($Target -eq 'store' -or $Target -eq 'all') {
    Show-Range 'src/hooks/useAuditStore.ts' 749 84
    Show-Context 'src/hooks/__tests__/useAuditStore.migration.test.ts' 'createAuditEvent|switchAuditYear' 5 8
}

if ($Target -eq 'release' -or $Target -eq 'all') {
    Show-Range 'RELEASE_CHECKLIST.md' 1 160
}

if ($Target -eq 'event' -or $Target -eq 'all') {
    $eventPath = 'C:\Users\user\.codex\data\harness\events.jsonl'
    if (-not (Test-Path -LiteralPath $eventPath -PathType Leaf)) {
        throw 'Harness events.jsonl is missing.'
    }

    $eventPattern = '(?:"?event"?\s*[:=]\s*"?verification"?)'
    $resultPattern = '(?:"?result"?\s*[:=]\s*"?ok"?)'
    $markerPattern = '(?:"?verification_marker"?\s*[:=]\s*"?true"?)'
    $verified = Get-Content -LiteralPath $eventPath -Tail 1000 | Where-Object {
        $_ -match $eventPattern -and $_ -match $resultPattern -and $_ -match $markerPattern
    } | Select-Object -Last 1

    if ($null -eq $verified) {
        throw 'No successful verification marker was found in the recent harness events.'
    }

    Write-Output 'harness_latest_verification=ok verification_marker=true'
}

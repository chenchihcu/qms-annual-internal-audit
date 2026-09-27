param(
    [ValidateSet('all', 'lint', 'tests', 'build', 'browser-smoke', 'migration-backup', 'local-backup')]
    [string]$Mode = 'all',
    [ValidatePattern('^src/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_.-]+\.test\.tsx?$')]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$TestFile,
    [ValidatePattern('^[\p{L}\p{N}_ .:/-]+$')]
    [string]$TestName,
    [string]$BackupPath
)

$ErrorActionPreference = 'Stop'

if ($Mode -eq 'migration-backup' -or $Mode -eq 'local-backup') {
    $downloadsRegistryPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders'
    $downloadsGuid = '{374DE290-123F-4565-9164-39C4925E467B}'
    $downloadsValue = (Get-ItemProperty -LiteralPath $downloadsRegistryPath).PSObject.Properties[$downloadsGuid].Value
    $downloadsPath = if ($downloadsValue) {
        [Environment]::ExpandEnvironmentVariables($downloadsValue)
    } else {
        Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads'
    }
    if (-not (Test-Path -LiteralPath $downloadsPath -PathType Container)) {
        Write-Output 'backup_verification result=not_pass reason=downloads-folder-not-found'
        exit 1
    }

    $cutoff = (Get-Date).AddMinutes(-30)
    # Build non-ASCII prefixes from code points so Windows PowerShell 5.1 can
    # read this UTF-8 script without mis-decoding the backup name patterns.
    $localBackupPrefix = [string]::Concat([char]0x0051, [char]0x004D, [char]0x0053, [char]0x5099, [char]0x4EFD)
    $migrationBackupPrefix = [string]::Concat(
        [char]0x0051, [char]0x004D, [char]0x0053,
        [char]0x9077, [char]0x79FB, [char]0x524D, [char]0x5099, [char]0x4EFD
    )
    $backupPrefix = if ($Mode -eq 'local-backup') { $localBackupPrefix } else { $migrationBackupPrefix }
    $backupPattern = "${backupPrefix}_*.json"
    $backupNamePattern = if ($Mode -eq 'local-backup') {
        '^' + [regex]::Escape($localBackupPrefix) + '_\d{4}_\d{4}-\d{2}-\d{2}(?:T\d{2}-\d{2}-\d{2}-\d{3}Z)?\.json$'
    } else {
        '^' + [regex]::Escape($migrationBackupPrefix) + '_.*\.json$'
    }
    $matchingBackups = @(Get-ChildItem -LiteralPath $downloadsPath -Filter $backupPattern -File)
    if ($BackupPath) {
        if (-not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
            Write-Output 'backup_verification result=not_pass reason=specified-backup-not-found'
            exit 1
        }
        $backup = Get-Item -LiteralPath $BackupPath
        if ($backup.Name -notmatch $backupNamePattern) {
            Write-Output 'backup_verification result=not_pass reason=specified-file-name-invalid'
            exit 1
        }
    } else {
        $backup = $matchingBackups |
            Where-Object { $_.LastWriteTime -ge $cutoff -and $_.Length -gt 0 } |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
    }
    if (-not $backup) {
        $newestWriteUtc = if ($matchingBackups.Count -gt 0) {
            $matchingBackups | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty LastWriteTimeUtc
        } else {
            'none'
        }
        Write-Output "backup_verification result=not_pass scope=$Mode reason=recent-backup-not-found matching_files=$($matchingBackups.Count) newest_write_utc=$newestWriteUtc"
        exit 1
    }
    if ($backup.Name -notmatch $backupNamePattern) {
        Write-Output 'backup_verification result=not_pass reason=backup-file-name-invalid'
        exit 1
    }
    if ($backup.Length -eq 0) {
        Write-Output 'backup_verification result=not_pass reason=backup-empty'
        exit 1
    }
    if ($backup.LastWriteTime -lt $cutoff) {
        Write-Output 'backup_verification result=not_pass reason=backup-too-old'
        exit 1
    }

    try {
        $rawBackup = Get-Content -LiteralPath $backup.FullName -Raw
        $parsedBackup = ConvertFrom-Json -InputObject $rawBackup -AsHashtable -ErrorAction Stop
    } catch {
        Write-Output 'backup_verification result=not_pass reason=backup-json-invalid'
        exit 1
    }
    $backupVersion = if ($Mode -eq 'local-backup') { $parsedBackup.state.version } else { $parsedBackup.version }
    if ($Mode -eq 'local-backup' -and $parsedBackup._format -ne 'qms-annual-internal-audit-backup') {
        Write-Output 'backup_verification result=not_pass reason=backup-format-invalid'
        exit 1
    }
    $maximumVersion = if ($Mode -eq 'local-backup') { 14 } else { 13 }
    if ($null -eq $parsedBackup -or $backupVersion -isnot [ValueType] -or
        $backupVersion -lt 1 -or $backupVersion -gt $maximumVersion) {
        Write-Output 'backup_verification result=not_pass reason=backup-version-invalid'
        exit 1
    }

    $hash = Get-FileHash -LiteralPath $backup.FullName -Algorithm SHA256
    Write-Output "backup_verification result=ok scope=$Mode version=$backupVersion bytes=$($backup.Length) sha256=$($hash.Hash)"
    exit 0
}

$checks = @(
    @{ Name = 'lint'; Arguments = @('run', 'lint') }
    @{ Name = 'tests'; Arguments = @('test') }
    @{ Name = 'build'; Arguments = @('run', 'build') }
)

if (($TestFile -or $TestName) -and $Mode -ne 'tests') {
    throw '-TestFile and -TestName can only be used with -Mode tests.'
}
if ($BackupPath -and $Mode -ne 'migration-backup' -and $Mode -ne 'local-backup') {
    throw '-BackupPath can only be used with -Mode migration-backup or -Mode local-backup.'
}

$selectedChecks = if ($Mode -eq 'all') { $checks } else { @($checks | Where-Object { $_.Name -eq $Mode }) }

foreach ($check in $selectedChecks) {
    $npmArguments = $check.Arguments
    if ($check.Name -eq 'tests' -and $TestFile) {
        $npmArguments = @('test', '--', $TestFile)
    }
    if ($check.Name -eq 'tests' -and $TestName) {
        if ($TestFile) {
            $npmArguments = @('test', '--', $TestFile, '--testNamePattern', $TestName)
        } else {
            $npmArguments = @('test', '--', '--testNamePattern', $TestName)
        }
    }
    Write-Host "==> npm.cmd $($npmArguments -join ' ')"
    & npm.cmd @npmArguments
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Output "event=verification result=not_pass check=$($check.Name) exit_code=$exitCode verification_marker=false"
        exit $exitCode
    }
}

if ($Mode -eq 'all' -or $Mode -eq 'browser-smoke') {
    Write-Host '==> node.exe smoke-playwright.mjs (selected local app: 127.0.0.1:43124)'
    & node.exe smoke-playwright.mjs
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Output "event=verification result=not_pass check=browser-smoke exit_code=$exitCode verification_marker=false"
        exit $exitCode
    }
}

if ($Mode -eq 'all') {
    Write-Output 'event=verification result=ok verification_marker=true checks=lint,tests,build,browser-smoke'
} else {
    $scope = "verification_scope=focused mode=$Mode"
    if ($TestFile) { $scope += " test=$TestFile" }
    if ($TestName) { $scope += " name=$TestName" }
    Write-Output $scope
    Write-Output "event=verification result=ok verification_marker=true scope=focused checks=$Mode"
}
exit 0

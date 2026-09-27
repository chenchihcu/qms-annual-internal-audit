$ErrorActionPreference = 'Stop'

& npm.cmd audit --audit-level=low
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

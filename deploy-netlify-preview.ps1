$ErrorActionPreference = 'Stop'
$siteId = '3c4efad3-ce7b-4c46-80ab-f6af9992870b'
$siteName = 'as9100qms'

Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'dist/index.html' -PathType Leaf)) {
  throw 'dist/index.html is missing; build before deployment.'
}

$sites = @(& netlify.cmd sites:list --json | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or -not ($sites | Where-Object { $_.id -eq $siteId -and $_.name -eq $siteName })) {
  throw 'The active Netlify account cannot access the approved as9100qms site ID.'
}

& netlify.cmd deploy --site $siteId --dir dist --alias v6-20260916-review --json
if ($LASTEXITCODE -ne 0) { throw 'Netlify preview deployment failed.' }

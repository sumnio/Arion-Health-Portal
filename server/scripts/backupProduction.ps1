[CmdletBinding()]
param(
    [switch]$ConfirmProductionBackup
)

$ErrorActionPreference = 'Stop'

function Stop-Backup([string]$Message) {
    Write-Error $Message
    exit 1
}

if (-not $ConfirmProductionBackup) {
    Stop-Backup 'Manual backup not started. Re-run with -ConfirmProductionBackup after completing the operator checklist.'
}

$requiredDatabase = 'arion_health_production'
$mongoUri = [Environment]::GetEnvironmentVariable('MONGODB_URI', 'Process')
$databaseName = [Environment]::GetEnvironmentVariable('MONGODB_DB_NAME', 'Process')
$outputRoot = [Environment]::GetEnvironmentVariable('BACKUP_OUTPUT_DIR', 'Process')

if ([string]::IsNullOrWhiteSpace($mongoUri)) {
    Stop-Backup 'MONGODB_URI must be supplied through the process environment.'
}

if ($mongoUri.Contains("`r") -or $mongoUri.Contains("`n")) {
    Stop-Backup 'MONGODB_URI contains an invalid newline.'
}

if ($databaseName -ne $requiredDatabase) {
    Stop-Backup "MONGODB_DB_NAME must be exactly $requiredDatabase for this operator helper."
}

if ([string]::IsNullOrWhiteSpace($outputRoot)) {
    Stop-Backup 'BACKUP_OUTPUT_DIR must point to an operator-controlled encrypted local or removable volume.'
}

$dumpCommand = Get-Command mongodump -ErrorAction SilentlyContinue
if ($null -eq $dumpCommand) {
    Stop-Backup 'mongodump was not found. Install the official MongoDB Database Tools before running a manual backup.'
}

$resolvedOutputRoot = [System.IO.Path]::GetFullPath($outputRoot)
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ($resolvedOutputRoot.StartsWith($repositoryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Stop-Backup 'BACKUP_OUTPUT_DIR must be outside the repository on an approved encrypted volume.'
}
New-Item -ItemType Directory -Path $resolvedOutputRoot -Force | Out-Null

$timestamp = [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$archivePath = Join-Path $resolvedOutputRoot "$requiredDatabase-$timestamp.archive.gz"
$temporaryConfig = Join-Path ([System.IO.Path]::GetTempPath()) "arion-mongodump-$([Guid]::NewGuid().ToString('N')).yml"
$escapedUri = $mongoUri.Replace("'", "''")

try {
    # A short-lived config file keeps the connection URI out of the mongodump
    # command line. It is deleted in finally and its content is never printed.
    Set-Content -LiteralPath $temporaryConfig -Value "uri: '$escapedUri'" -Encoding UTF8 -NoNewline

    if ($env:OS -eq 'Windows_NT') {
        $currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        & icacls.exe $temporaryConfig /inheritance:r /grant:r "${currentIdentity}:R" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Stop-Backup 'Could not restrict access to the temporary MongoDB configuration file.'
        }
    }
    else {
        & chmod 600 $temporaryConfig
        if ($LASTEXITCODE -ne 0) {
            Stop-Backup 'Could not restrict access to the temporary MongoDB configuration file.'
        }
    }

    & $dumpCommand.Source --config $temporaryConfig --db $requiredDatabase --archive=$archivePath --gzip
    if ($LASTEXITCODE -ne 0) {
        Stop-Backup 'mongodump failed. Review its non-sensitive error output; do not retry blindly.'
    }

    if (-not (Test-Path -LiteralPath $archivePath) -or (Get-Item -LiteralPath $archivePath).Length -eq 0) {
        Stop-Backup 'mongodump reported success but did not create a non-empty archive.'
    }

    Write-Host "Manual backup completed: $archivePath"
    Write-Host 'Keep the archive on the approved encrypted volume and follow the retention procedure in OPERATIONS_RUNBOOK.md.'
}
catch {
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    }
    throw
}
finally {
    if (Test-Path -LiteralPath $temporaryConfig) {
        Remove-Item -LiteralPath $temporaryConfig -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Creates, or brings back to its intended state, the read-only role that runs
# SQL a language model wrote.
#
#   powershell -ExecutionPolicy Bypass -File database\create_readonly_role.ps1
#
# Run it after the schema and the seed data. It is safe to run again: the SQL
# describes what the role holds rather than adding to it, and everything runs
# inside a single transaction, so a failure leaves the role exactly as it was.
#
# Settings come from the repository root .env, the same file the backend reads.
# A value already set in the environment wins over the file.
#   PG_READONLY_PASSWORD  required - the password the backend connects with
#   PG_READONLY_USER      optional - defaults to sqlai_readonly
#   PGDATABASE, PGUSER, PGHOST, PGPORT, PGPASSWORD - who creates the role, where
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'

# Only the keys this script needs, and only when the environment does not
# already carry them. The file is parsed rather than executed: .env is not
# PowerShell, and running it would run whatever somebody typed into it.
$wanted = @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
            'PG_READONLY_USER', 'PG_READONLY_PASSWORD')

if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -Encoding UTF8) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $name = $Matches[1]
            $value = $Matches[2]
            if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") { $value = $Matches[1] }
            if ($wanted -contains $name -and $value -and
                -not [Environment]::GetEnvironmentVariable($name, 'Process')) {
                [Environment]::SetEnvironmentVariable($name, $value, 'Process')
            }
        }
    }
}

if (-not $env:PG_READONLY_PASSWORD) {
    Write-Host 'PG_READONLY_PASSWORD is not set.'
    Write-Host "Choose a password, put it in $envFile, and run this again."
    Write-Host 'The backend connects with the same value, so there is only one place to set it.'
    exit 1
}

$dbName   = if ($env:PGDATABASE)       { $env:PGDATABASE }       else { 'savunma_db' }
$dbUser   = if ($env:PGUSER)           { $env:PGUSER }           else { 'postgres' }
$roleName = if ($env:PG_READONLY_USER) { $env:PG_READONLY_USER } else { 'sqlai_readonly' }

# Locate psql: PATH first, then the default Windows install location.
$psql = $null
try { $psql = (Get-Command psql -ErrorAction Stop).Source } catch {
    $found = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending
    if ($found) { $psql = $found[0].FullName }
}
if (-not $psql) {
    Write-Host 'psql.exe not found. Install PostgreSQL or add its bin folder to PATH.'
    exit 1
}

$sqlFile = Join-Path $PSScriptRoot 'migrations\003_readonly_role.sql'
if (-not (Test-Path $sqlFile)) {
    Write-Host "Missing migration file: $sqlFile"
    exit 1
}

# The password travels in the environment rather than on the command line,
# where anything listing processes could read it. The SQL file picks it up
# with \getenv.
$psqlArgs = @('-U', $dbUser, '-d', $dbName, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', $sqlFile)
if (-not $env:PGPASSWORD) { $psqlArgs += '-W' }

Write-Host "Setting up role $roleName in $dbName as $dbUser using $psql"
& $psql @psqlArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'FAILED - the transaction was rolled back, the role is unchanged.'
    exit $LASTEXITCODE
}

Write-Host ''
Write-Host "Role $roleName is ready. Above: every table readable, and 0 other privileges."

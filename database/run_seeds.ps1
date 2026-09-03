# ---------------------------------------------------------------------------
# Applies the seed migrations to the local development database in one go.
#
#   powershell -ExecutionPolicy Bypass -File database\run_seeds.ps1
#
# Every file runs inside a SINGLE transaction, so if any statement fails the
# whole batch is rolled back and the database is left exactly as it was -
# no half-seeded tables to clean up by hand.
#
# The database name / user can be overridden with the standard libpq
# environment variables PGDATABASE, PGUSER, PGHOST, PGPORT and PGPASSWORD.
# When PGPASSWORD is not set, psql asks for the password once.
# ---------------------------------------------------------------------------
$ErrorActionPreference = 'Stop'

$dbName = if ($env:PGDATABASE) { $env:PGDATABASE } else { 'savunma_db' }
$dbUser = if ($env:PGUSER)     { $env:PGUSER }     else { 'postgres' }

# Order matters: sequences first, then parents, then the junction tables.
$files = @(
    '002_sequence_baslangic.sql',
    '010_seed_departments.sql',
    '011_seed_employees.sql',
    '012_seed_projects.sql',
    '013_seed_products.sql',
    '014_seed_investments.sql',
    '015_seed_project_employees.sql',
    '016_seed_project_products.sql'
)

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

$migrations = Join-Path $PSScriptRoot 'migrations'
$psqlArgs = @('-U', $dbUser, '-d', $dbName, '-v', 'ON_ERROR_STOP=1', '--single-transaction')
if (-not $env:PGPASSWORD) { $psqlArgs += '-W' }

foreach ($file in $files) {
    $path = Join-Path $migrations $file
    if (-not (Test-Path $path)) {
        Write-Host "Missing migration file: $path"
        exit 1
    }
    $psqlArgs += @('-f', $path)
}

# Row counts are printed at the end of the same transaction as a sanity check.
$summary = @'
SELECT 'departments'       AS table_name, count(*) AS rows FROM departments
UNION ALL SELECT 'employees',         count(*) FROM employees
UNION ALL SELECT 'projects',          count(*) FROM projects
UNION ALL SELECT 'products',          count(*) FROM products
UNION ALL SELECT 'investments',       count(*) FROM investments
UNION ALL SELECT 'project_employees', count(*) FROM project_employees
UNION ALL SELECT 'project_products',  count(*) FROM project_products
ORDER BY 1;
'@
$psqlArgs += @('-c', $summary)

Write-Host "Seeding $dbName as $dbUser using $psql"
& $psql @psqlArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'Seeding FAILED - the transaction was rolled back, nothing was written.'
    Write-Host 'If the error mentions a duplicate key, the tables are already seeded.'
    exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'All seed migrations applied successfully.'

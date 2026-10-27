# ==============================================================================
# Open-Mart: Automated PostgreSQL Database Backup Script (PowerShell)
# Usage: .\scripts\backup-database.ps1
# ==============================================================================

param(
    [string]$BackupDir = "./backups/postgres",
    [int]$RetentionDays = 7,
    [string]$DbUser = $env:POSTGRES_USER ?? "openmart",
    [string]$DbName = $env:POSTGRES_DB ?? "open-mart",
    [string]$DbPort = $env:POSTGRES_PORT ?? "6432",
    [string]$ContainerName = "openmart-postgres"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "open_mart_$timestamp.sql"

Write-Host "[$([DateTime]::UtcNow.ToString('o'))] Initiating database backup for '$DbName'..." -ForegroundColor Cyan

# Attempt backup using Docker exec if container is running
$dockerRunning = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>$null

if ($dockerRunning -eq $ContainerName) {
    Write-Host "[INFO] Dumping from running container '$ContainerName'..." -ForegroundColor Gray
    docker exec $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists > $backupFile
} elseif (Get-Command pg_dump -ErrorAction SilentlyContinue) {
    Write-Host "[INFO] Dumping via local pg_dump..." -ForegroundColor Gray
    $env:PGPASSWORD = $env:POSTGRES_PASSWORD ?? "pgmart"
    pg_dump -h localhost -p $DbPort -U $DbUser -d $DbName --clean --if-exists -f $backupFile
} else {
    Write-Error "Neither Docker container '$ContainerName' nor local 'pg_dump' utility was accessible."
    exit 1
}

if ((Get-Item $backupFile).Length -eq 0) {
    Remove-Item $backupFile -Force
    Write-Error "Backup file was generated empty. Please check database connectivity."
    exit 1
}

$sizeMb = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
Write-Host "[$([DateTime]::UtcNow.ToString('o'))] Backup completed successfully: $backupFile ($sizeMb MB)" -ForegroundColor Green

# Retention cleanup
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "open_mart_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
    Write-Host "[INFO] Pruning obsolete backup: $($_.Name)" -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Write-Host "[$([DateTime]::UtcNow.ToString('o'))] Database maintenance finished." -ForegroundColor Cyan


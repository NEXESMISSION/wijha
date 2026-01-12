# PowerShell script to kill process on port 3000 (Windows)
$port = 3000
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($processes) {
    $processes | ForEach-Object {
        $pid = $_.OwningProcess
        Write-Host "Killing process $pid on port $port"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Port $port is now free"
} else {
    Write-Host "No process found on port $port"
}


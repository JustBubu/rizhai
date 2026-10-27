$ErrorActionPreference = "SilentlyContinue"
$url = "http://127.0.0.1:43123/"
for ($i = 0; $i -lt 90; $i++) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      Start-Process $url
      exit 0
    }
  } catch {
    # still starting
  }
  Start-Sleep -Seconds 1
}
Write-Host "Rizhai did not become ready in time. Open $url manually once the server is up."
exit 1

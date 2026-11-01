param(
  [string]$DatasetRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$Language = 'tr',
  [int]$Limit = 0,
  [string]$Split = 'test'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and
  $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1)
function Wait-WinRT($Operation, [Type]$ResultType) {
  $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.GetAwaiter().GetResult()
}

$languageObject = [Windows.Globalization.Language]::new($Language)
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($languageObject)
if ($null -eq $engine) { throw "OCR language is not installed: $Language. This script does not install it." }
$root = [IO.Path]::GetFullPath($DatasetRoot)
$manifestPath = Join-Path $root 'metadata/manifest.jsonl'
$records = @(Get-Content -LiteralPath $manifestPath -Encoding UTF8 | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.split -eq $Split -and $_.variant -eq 'clean' })
if ($Limit -gt 0) { $records = @($records | Select-Object -First $Limit) }
$outputName = if ($Limit -gt 0) { '.work/full-image-ocr-smoke.jsonl' } else { 'docs/baselines/windows-ocr-test.jsonl' }
$outputPath = Join-Path $root $outputName
if (Test-Path -LiteralPath $outputPath) { throw 'Output exists; preserve prior OCR evidence' }
$writer = [IO.StreamWriter]::new($outputPath, $false, [Text.UTF8Encoding]::new($false))
$timer = [Diagnostics.Stopwatch]::StartNew()
$count = 0
try {
  foreach ($record in $records) {
    $imagePath = [IO.Path]::GetFullPath((Join-Path $root $record.image_path))
    if (-not $imagePath.StartsWith(($root + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'Image path escapes dataset root' }
    $file = Wait-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)) ([Windows.Storage.StorageFile])
    $stream = Wait-WinRT ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $bitmap = $null
    try {
      $decoder = Wait-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
      $bitmap = Wait-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
      if ($bitmap.PixelWidth -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension -or $bitmap.PixelHeight -gt [Windows.Media.Ocr.OcrEngine]::MaxImageDimension) { throw 'Image exceeds OCR engine dimension limit' }
      $ocr = Wait-WinRT ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
      $lines = @($ocr.Lines | ForEach-Object {
        $line = $_
        $words = @($line.Words | ForEach-Object { [ordered]@{
          text = $_.Text
          bbox = @($_.BoundingRect.X, $_.BoundingRect.Y, $_.BoundingRect.Width, $_.BoundingRect.Height)
        } })
        [ordered]@{ text = $line.Text; words = $words }
      })
      $result = [ordered]@{ id=$record.id; image_sha256=$record.image_sha256; language=$engine.RecognizerLanguage.LanguageTag; width=$bitmap.PixelWidth; height=$bitmap.PixelHeight; lines=$lines }
      $writer.WriteLine(($result | ConvertTo-Json -Depth 8 -Compress))
    } finally {
      if ($null -ne $bitmap) { $bitmap.Dispose() }
      $stream.Dispose()
    }
    $count++
    if ($count % 10 -eq 0 -or $count -eq $records.Count) { Write-Output "OCR $count/$($records.Count)"; $writer.Flush() }
  }
} finally { $writer.Dispose() }
$environment = [ordered]@{
  engine='Windows.Media.Ocr.OcrEngine'; language=$engine.RecognizerLanguage.LanguageTag
  available_languages=@([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object LanguageTag)
  windows_build=[Environment]::OSVersion.Version.ToString(); powershell=$PSVersionTable.PSVersion.ToString()
  images=$count; elapsed_seconds=[Math]::Round($timer.Elapsed.TotalSeconds,3)
  source='full original PNG frames; no ground-truth crops or DOM text passed to OCR'
  network='No network client or external service is called by this script; OS internals were not instrumented.'
}
$environmentName = if ($Limit -gt 0) { '.work/full-image-ocr-smoke-environment.json' } else { 'docs/baselines/windows-ocr-environment.json' }
[IO.File]::WriteAllText((Join-Path $root $environmentName), ($environment | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))

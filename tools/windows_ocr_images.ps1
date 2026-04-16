param(
  [string]$Manifest = ".tmp\ipa-pm-bank\local-ocr\ocr-manifest.json",
  [string]$OutDir = ".tmp\ipa-pm-bank\local-ocr\text"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() |
  Where-Object {
    $_.Name -eq "AsTask" -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]

function Await-Operation($op, [type]$resultType) {
  $asTask = $script:asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($op))
  $task.Wait() | Out-Null
  $task.Result
}

function Invoke-Ocr($path, $engine) {
  $file = Await-Operation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
  $stream = Await-Operation ($file.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-Operation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $result = Await-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $result.Text
}

$manifestPath = (Resolve-Path $Manifest).Path
$outRoot = New-Item -ItemType Directory -Force -Path $OutDir
$lang = [Windows.Globalization.Language]::new("ja")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if ($null -eq $engine) {
  throw "Windows Japanese OCR engine is not available."
}

$items = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
foreach ($item in $items) {
  $out = Join-Path $outRoot.FullName ($item.stem + ".ocr.txt")
  $chunks = New-Object System.Collections.Generic.List[string]
  $pageNumber = 0
  foreach ($page in $item.pages) {
    $pageNumber += 1
    $pagePath = (Resolve-Path $page).Path
    $text = Invoke-Ocr $pagePath $engine
    $chunks.Add("---PAGE p$($pageNumber.ToString('000'))---`n$text")
  }
  [IO.File]::WriteAllText($out, ($chunks -join "`n"), [Text.UTF8Encoding]::new($false))
  Write-Host "ocr $($item.stem): $pageNumber pages -> $out"
}

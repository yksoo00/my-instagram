# 앱 아이콘(PNG 192/512, ICO 256)을 다시 만들 때 쓴다. 결과물은 저장소에 같이 들어 있으므로 평소엔 실행할 필요 없다.
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\make-icons.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\frontend\public'

function New-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)

  # 둥근 사각형 바탕 + 인스타그램풍 그라데이션
  $radius = [single]($size * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [single]($radius * 2)
  $path.AddArc([single]0, [single]0, $d, $d, [single]180, [single]90)
  $path.AddArc([single]($size - $d), [single]0, $d, $d, [single]270, [single]90)
  $path.AddArc([single]($size - $d), [single]($size - $d), $d, $d, [single]0, [single]90)
  $path.AddArc([single]0, [single]($size - $d), $d, $d, [single]90, [single]90)
  $path.CloseFigure()

  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::Black), ([System.Drawing.Color]::Black), 315
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend 4
  $blend.Colors = @(
    [System.Drawing.Color]::FromArgb(254, 218, 117),
    [System.Drawing.Color]::FromArgb(250, 126, 30),
    [System.Drawing.Color]::FromArgb(214, 41, 118),
    [System.Drawing.Color]::FromArgb(79, 91, 213)
  )
  $blend.Positions = @(0.0, 0.35, 0.7, 1.0)
  $brush.InterpolationColors = $blend
  $g.FillPath($brush, $path)

  $font = New-Object System.Drawing.Font 'Segoe UI', ($size * 0.42), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = 'Center'
  $format.LineAlignment = 'Center'
  $g.DrawString('Ig', $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, ($size * 0.02), $size, $size), $format)
  $g.Dispose()
  return $bmp
}

foreach ($size in 192, 512) {
  $bmp = New-Icon $size
  $bmp.Save((Join-Path $out "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# ICO: 헤더 + PNG 한 장(256). 바탕화면 바로가기 아이콘으로 쓴다.
$bmp = New-Icon 256
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$png = $ms.ToArray()
$bmp.Dispose()
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)          # ICONDIR
$w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0) # 256x256, 색 수/예약 0
$w.Write([uint16]1); $w.Write([uint16]32)                              # planes, bpp
$w.Write([uint32]$png.Length); $w.Write([uint32]22)                    # 크기, 데이터 위치
$w.Write($png)
[IO.File]::WriteAllBytes((Join-Path $out 'app.ico'), $ico.ToArray())
Write-Host 'icons done'

# PowerShell script to translate Turkish JS files to English
$dmControlsPath = "c:\Users\Deniz\Desktop\mapprogram\en\map\js\dm-controls.js"

# Read the file content
$content = Get-Content $dmControlsPath -Raw

# Apply all translations for DM controls
$content = $content -replace 'İşaret ve arazi verisini indir', 'Download marker and terrain data'
$content = $content -replace 'İndir', 'Download'
$content = $content -replace 'Değişiklikleri depoya kaydet \(giriş gerekli\)', 'Save changes to repository (login required)'
$content = $content -replace 'Yayınla', 'Publish'
$content = $content -replace 'KAYDEDİLMEDİ', 'UNSAVED'
$content = $content -replace 'Yayınlanacak değişiklik yok', 'No changes to publish'
$content = $content -replace 'Yolları boya', 'Paint roads'
$content = $content -replace 'Yol', 'Road'
$content = $content -replace 'Geçilmez alanları boya', 'Paint impassable areas'
$content = $content -replace 'Geçilmez', 'Impassable'
$content = $content -replace 'Normal çizim', 'Normal drawing'
$content = $content -replace 'Normal', 'Normal'
$content = $content -replace 'İçe Aktar', 'Import'
$content = $content -replace 'CSV ile işaretleri içe aktar', 'Import markers via CSV'

# Write the content back
Set-Content $dmControlsPath $content -Encoding UTF8

Write-Host "DM Controls translation completed!"
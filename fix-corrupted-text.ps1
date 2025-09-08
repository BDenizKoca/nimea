# Fix corrupted Turkish text in English DM controls

$filePath = "en/map/js/dm-controls.js"

# Read the file
$content = Get-Content $filePath -Raw -Encoding UTF8

# Fix corrupted notification messages
$content = $content -replace "Publishnacak deÄŸiÅŸiklik yok", "No changes to publish"
$content = $content -replace "CSV ile iÅŸaretleri Import", "Import markers from CSV"
$content = $content -replace "CanlÄ± CMS iÃ§in giriÅŸ", "Login for live CMS"
$content = $content -replace "GiriÅŸ", "Login"
$content = $content -replace "Kimlik doÄŸrulama kullanÄ±lamÄ±yor \(konsola bakÄ±nÄ±z\)\.", "Authentication unavailable (check console)."
$content = $content -replace "CanlÄ± CMS: DeÄŸiÅŸiklikler depoya otomatik kaydedilir", "Live CMS: Changes are automatically saved to repository"
$content = $content -replace "CanlÄ± CMS kipi etkinleÅŸtirildi", "Live CMS mode enabled"
$content = $content -replace "Arazi kipi: \$\{modeTr\}\. Araziyi boyamak iÃ§in Ã§okgen/Ã§izgi Ã§iz\.", "Terrain mode: `${modeEn}. Draw polygons/lines to paint terrain."

# Write the file back
Set-Content $filePath -Value $content -Encoding UTF8

# Fix UI.js corrupted text
$uiFilePath = "en/map/js/ui.js"
$uiContent = Get-Content $uiFilePath -Raw -Encoding UTF8

$uiContent = $uiContent -replace "DÃ¼zenle", "Edit"
$uiContent = $uiContent -replace "KÃ¼lliyatta GÃ¶r", "View on Wiki"
$uiContent = $uiContent -replace "iÅŸaretini Deletemek istediÄŸine emin misin\? Bu iÅŸlem geri alÄ±namaz\.", "marker? Are you sure you want to delete it? This action cannot be undone."

Set-Content $uiFilePath -Value $uiContent -Encoding UTF8

Write-Host "Corrupted text fixed in DM controls and UI!"
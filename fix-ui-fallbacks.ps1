# Fix remaining Turkish fallback text in ui.js

$filePath = "en/map/js/ui.js"

# Read the file content
$content = Get-Content $filePath -Raw

# Replace Turkish fallback text with English equivalents
$content = $content -replace "Rotaya Ekle", "Add to Route"
$content = $content -replace "Düzenle", "Edit"
$content = $content -replace "Sil", "Delete"
$content = $content -replace "işaretini silmek istediğine emin misin\? Bu işlem geri alınamaz\.", "marker? This action cannot be undone."

# Write the updated content back
Set-Content $filePath $content -Encoding UTF8

Write-Host "UI fallbacks translation completed!"
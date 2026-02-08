# Script d'installation pour My 3D Manager
Add-Type -AssemblyName System.Windows.Forms

$title = "Installateur My 3D Manager"

# 1. Sélection du dossier de destination
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$folderBrowser.Description = "Sélectionnez le dossier parent où vous souhaitez installer l'application (un sous-dossier 'my-3d-manager' sera créé)."

if ($folderBrowser.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host "Installation annulée." -ForegroundColor Yellow
    exit
}

$installPath = $folderBrowser.SelectedPath
$targetDir = Join-Path $installPath "my-3d-manager"

Write-Host "`n--- Installation de My 3D Manager ---" -ForegroundColor Cyan
Write-Host "Destination : $targetDir"

# 2. Création du dossier et copie des fichiers
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
}

Write-Host "Copie des fichiers en cours (cela peut prendre quelques secondes)..."
# On utilise robocopy pour être efficace et exclure les dossiers inutiles/lourds
robocopy . $targetDir /E /XD node_modules .next .git /R:1 /W:1 | Out-Null

# 3. Finalisation dans le nouveau dossier
$originalDir = Get-Location
Set-Location $targetDir

Write-Host "Installation des dépendances technologiques..." -ForegroundColor Gray
npm install --quiet

Write-Host "Optimisation de l'application pour la vitesse (Build)..." -ForegroundColor Gray
npm run build

# 4. Création du lanceur (.bat)
$batPath = Join-Path $targetDir "lancer-manager.bat"
$batContent = "@echo off`ncd /d `"$targetDir`"`necho Démarrage de My 3D Manager...`nnpm run start"
Set-Content -Path $batPath -Value $batContent

# 5. Ajout au démarrage de Windows
$startupFolder = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$startupShortcut = Join-Path $startupFolder "Lancer My3DManager.bat"
Copy-Item $batPath $startupShortcut -Force

Write-Host "`n-------------------------------------------" -ForegroundColor Green
Write-Host "INSTALLATION RÉUSSIE !" -ForegroundColor Green
Write-Host "-------------------------------------------" -ForegroundColor Green
Write-Host "1. Votre application est maintenant dans : $targetDir"
Write-Host "2. Elle se lancera automatiquement à chaque démarrage de Windows."
Write-Host "3. Vous pouvez fermer cette fenêtre et supprimer l'ancien dossier si vous le souhaitez."
Write-Host "`nAppuyez sur une touche pour terminer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Documentation Stockage - My 3D Manager (V3)

Ce document explique où sont stockées vos données et fichiers au sein de la version V3 de l'application.

## 🗄️ Base de données (Database)
Toutes vos configurations (imprimantes, filaments, catégories, liens, descriptions) sont stockées dans une base de données SQLite unique.

**Chemin :**
`%AppData%\Roaming\v3\my3dmanager.db`

---

## � Gestion des Fichiers (STL & G-code)
La V3 propose deux modes de fonctionnement selon votre choix lors de l'import :

### 1. Mode "Importer (Copier)" - Stockage Interne 📦
L'application **duplique physiquement** les fichiers dans son propre dossier.
*   **Avantage :** Vos projets sont autonomes. Vous pouvez supprimer les fichiers originaux sur votre disque sans perdre l'accès dans l'app.
*   **Emplacement :** `%AppData%\Roaming\v3\storage\projects\[ID]\files\`

### 2. Mode "Lier uniquement" - Lien Externe 🔗
L'application enregistre seulement le **chemin d'accès** vers votre fichier actuel.
*   **Bouton Scanner :** Utilise toujours ce mode pour éviter les doublons inutiles.
*   **Attention :** Si vous déplacez ou renommez le fichier original, il ne sera plus accessible dans l'app.

---

## 🖼️ Photos du Projet
*   **Collage (Ctrl+V) :** Enregistré dans le sous-dossier `photos` de votre projet (si un dossier local est lié) ou dans `%AppData%\Roaming\v3\pasted_images\`.
*   **Import manuel :** Enregistré comme un lien vers le fichier original (même comportement que le mode "Lier").

---

## 🚀 Commandes utiles (npm)

S'exécutent à la racine du projet :
*   **Lancer l'app :** `npm run dev:v3`
*   **Créer l'exécutable (ZIP) :** `npm run package --prefix v3`
*   **Réinstaller tout :** `npm install`

---

> [!TIP]
> **Le Scan G-code est intelligent !** Il lie automatiquement les G-code aux fichiers STL même s'ils ont des suffixes (ex: `vace_0.4n_lh.gcode` sera lié à `vase.stl`).

#!/bin/zsh
# ─────────────────────────────────────────────────────────────────────────────
#  Construit « Pacevo.app » et le pose sur le Bureau, avec le logo de l'application.
#
#  Relancer ce script après toute modification de `pacevo-liens.applescript`.
#  ⚠️ zsh, pas bash : c'est le shell de Cyprien.
# ─────────────────────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."
RACINE="$PWD"
APP="$HOME/Desktop/Pacevo.app"

echo "▸ Compilation du script…"
rm -rf "$APP"
osacompile -o "$APP" "$RACINE/outils/pacevo-liens.applescript"

echo "▸ Fabrication de l'icône depuis le logo de l'application…"
# On part du master 1024 px : les tailles inférieures en sont dérivées, jamais
# agrandies depuis une petite image — un logo flou sur le Bureau se voit tout de suite.
SRC="$RACINE/public/icon-master-1024.png"
[ -f "$SRC" ] || { echo "✗ $SRC introuvable"; exit 1; }
TMP="$(mktemp -d)/pacevo.iconset"
mkdir -p "$TMP"
for T in 16 32 64 128 256 512 1024; do
  sips -z $T $T "$SRC" --out "$TMP/icon_${T}x${T}.png" >/dev/null
done
# macOS attend des noms précis, avec les variantes @2x.
mv "$TMP/icon_32x32.png"     "$TMP/icon_16x16@2x.png"
cp "$TMP/icon_64x64.png"     "$TMP/icon_32x32@2x.png"
mv "$TMP/icon_64x64.png"     "$TMP/tmp64.png" 2>/dev/null || true
rm -f "$TMP/tmp64.png"
cp "$TMP/icon_256x256.png"   "$TMP/icon_128x128@2x.png"
cp "$TMP/icon_512x512.png"   "$TMP/icon_256x256@2x.png"
mv "$TMP/icon_1024x1024.png" "$TMP/icon_512x512@2x.png"
iconutil -c icns "$TMP" -o "$APP/Contents/Resources/applet.icns"

echo "▸ Rafraîchissement du cache d'icônes…"
touch "$APP"

echo "✓ Prêt : $APP"
echo "  Double-clic → la liste des adresses s'ouvre."

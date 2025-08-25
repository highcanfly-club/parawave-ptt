#!/bin/bash
set -euo pipefail
source .env
# Vérifie la variable d'environnement
if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_TUNNEL_TOKEN non défini."
  echo "Exportez le token: export CLOUDFLARE_TUNNEL_TOKEN=xxx"
  exit 1
fi

CLOUDFLARED_BIN=/usr/local/bin/cloudflared
LOGFILE="$(mktemp -t cloudflared-log.XXXXXX)"

if [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared introuvable à $CLOUDFLARED_BIN"
  exit 1
fi

echo "Lancement de cloudflared tunnel (log: $LOGFILE)..."
# Lancer en background, rediriger logs
"$CLOUDFLARED_BIN" tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" > "$LOGFILE" 2>&1 &
CLOUDFLARED_PID=$!
echo "cloudflared PID=$CLOUDFLARED_PID"

# Nettoyage à la sortie
cleanup() {
  echo "Arrêt de cloudflared (pid=$CLOUDFLARED_PID)..."
  kill "$CLOUDFLARED_PID" 2>/dev/null || true
  wait "$CLOUDFLARED_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Attendre que le tunnel publie une URL publique (max 30s)
echo "Attente du tunnel..."
for i in $(seq 1 30); do
  if grep -Eo "https?://[A-Za-z0-9./-]+" "$LOGFILE" | head -n 1 >/dev/null 2>&1; then
    PUB_URL=$(grep -Eo "https?://[A-Za-z0-9./-]+" "$LOGFILE" | head -n 1)
    echo "Tunnel prêt: $PUB_URL"
    break
  fi
  sleep 1
done

if [[ -z "${PUB_URL:-}" ]]; then
  echo "WARNING: tunnel non détecté dans les logs après 30s, vérifier $LOGFILE"
else
  echo "Utiliser $PUB_URL comme API_BASE_URL sur le device si besoin."
fi

# Lancer les dev servers via turbo (appel interne pour éviter récursion)
echo "Démarrage des services de développement (turbo)..."
yarn run dev:env
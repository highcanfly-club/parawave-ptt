#!/bin/bash
set -euo pipefail

# Check if .env file exists
if [[ ! -f ".env" ]]; then
  echo "ERROR: .env file not found. Please create it with required environment variables."
  exit 1
fi

source .env
# Vérifie les variables d'environnement
if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_TUNNEL_TOKEN non défini."
  echo "Exportez le token: export CLOUDFLARE_TUNNEL_TOKEN=xxx"
  exit 1
fi
if [[ -z "${CLOUDFLARE_TUNNEL_FRONTEND_TOKEN:-}" ]]; then
  echo "ERROR: CLOUDFLARE_TUNNEL_FRONTEND_TOKEN non défini."
  echo "Exportez le token: export CLOUDFLARE_TUNNEL_FRONTEND_TOKEN=xxx"
  exit 1
fi

CLOUDFLARED_BIN=/usr/local/bin/cloudflared
LOGFILE_BACKEND="$(mktemp -t cloudflared-backend-log.XXXXXX)"
LOGFILE_FRONTEND="$(mktemp -t cloudflared-frontend-log.XXXXXX)"

# Ensure log files exist and are writable
touch "$LOGFILE_BACKEND" "$LOGFILE_FRONTEND"

if [[ ! -x "$CLOUDFLARED_BIN" ]]; then
  echo "ERROR: cloudflared introuvable à $CLOUDFLARED_BIN"
  exit 1
fi

echo "Lancement de cloudflared tunnel pour le backend (log: $LOGFILE_BACKEND)..."
# Lancer en background, rediriger logs
"$CLOUDFLARED_BIN" tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" > "$LOGFILE_BACKEND" 2>&1 &
CLOUDFLARED_BACKEND_PID=$!
echo "cloudflared backend PID=$CLOUDFLARED_BACKEND_PID"

echo "Lancement de cloudflared tunnel pour le frontend (log: $LOGFILE_FRONTEND)..."
# Lancer en background, rediriger logs
"$CLOUDFLARED_BIN" tunnel run --token "$CLOUDFLARE_TUNNEL_FRONTEND_TOKEN" > "$LOGFILE_FRONTEND" 2>&1 &
CLOUDFLARED_FRONTEND_PID=$!
echo "cloudflared frontend PID=$CLOUDFLARED_FRONTEND_PID"

# Nettoyage à la sortie
cleanup() {
  echo "Arrêt de cloudflared (pid=$CLOUDFLARED_BACKEND_PID)..."
  kill "$CLOUDFLARED_BACKEND_PID" 2>/dev/null || true
  wait "$CLOUDFLARED_BACKEND_PID" 2>/dev/null || true
  echo "Arrêt de cloudflared (pid=$CLOUDFLARED_FRONTEND_PID)..."
  kill "$CLOUDFLARED_FRONTEND_PID" 2>/dev/null || true
  wait "$CLOUDFLARED_FRONTEND_PID" 2>/dev/null || true
  
  # Clean up temporary log files
  rm -f "$LOGFILE_BACKEND" "$LOGFILE_FRONTEND"
}
trap cleanup EXIT INT TERM

# Attendre que le tunnel publie une URL publique (max 30s)
echo "Attente du tunnel..."
for i in $(seq 1 30); do
  # Check if cloudflared processes are still running
  if ! kill -0 "$CLOUDFLARED_BACKEND_PID" 2>/dev/null; then
    echo "ERROR: cloudflared backend process died"
    exit 1
  fi
  
  if [[ -f "$LOGFILE_BACKEND" ]] && grep -Eo "https?://[A-Za-z0-9./-]+" "$LOGFILE_BACKEND" | head -n 1 >/dev/null 2>&1; then
    PUB_URL=$(grep -Eo "https?://[A-Za-z0-9./-]+" "$LOGFILE_BACKEND" | head -n 1)
    echo "Tunnel prêt: $PUB_URL"
    break
  fi
  sleep 1
done

if [[ -z "${PUB_URL:-}" ]]; then
  echo "WARNING: tunnel non détecté dans les logs après 30s"
  echo "Vérifiez les logs: $LOGFILE_BACKEND"
  echo "Vous pouvez continuer manuellement ou relancer le script"
else
  echo "✅ Utiliser $PUB_URL comme API_BASE_URL sur le device si besoin."
fi

# Lancer les dev servers via turbo (appel interne pour éviter récursion)
echo "🚀 Démarrage des services de développement (turbo)..."
if ! yarn run dev:env; then
  echo "ERROR: Échec du démarrage des services de développement"
  exit 1
fi
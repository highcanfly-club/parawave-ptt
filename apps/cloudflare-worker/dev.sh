#!/bin/bash

# ParaWave PTT Backend - Script de développement
# Usage: ./dev.sh [command]

set -e

PROJECT_DIR="/Users/rlemeill/Development/parawave-ptt/apps/cloudflare-worker"
cd "$PROJECT_DIR"

case "${1:-help}" in
  "dev")
    echo "🚀 Démarrage du serveur de développement..."
    wrangler dev
    ;;
    
  "deploy")
    echo "📦 Déploiement en production..."
    wrangler deploy
    ;;
    
  "logs")
    echo "📋 Affichage des logs..."
    wrangler tail
    ;;
    
  "db:migrate")
    echo "🗃️ Migration de la base de données..."
    wrangler d1 execute PTT_DB --file=./migrations/001_initial_schema.sql
    ;;
    
  "db:shell")
    echo "🔍 Ouverture du shell D1..."
    wrangler d1 execute PTT_DB --command="SELECT name FROM sqlite_master WHERE type='table';"
    ;;
    
  "test")
    echo "🧪 Tests de compilation TypeScript..."
    npx tsc --noEmit
    echo "✅ Compilation réussie !"
    ;;
    
  "types")
    echo "🔧 Régénération des types TypeScript..."
    npx wrangler types
    echo "✅ Types régénérés !"
    ;;
    
  "test:api")
    echo "🌐 Test des endpoints API..."
    if [ -z "$2" ]; then
      URL="http://localhost:8787"
    else
      URL="$2"
    fi
    
    echo "Testing health endpoint..."
    curl -s "$URL/health" | jq '.'
    
    echo -e "\nTesting API v1 health..."
    curl -s "$URL/api/v1/health" | jq '.'
    ;;
    
  "clean")
    echo "🧹 Nettoyage..."
    rm -f src/index.bak.ts
    echo "✅ Nettoyage terminé !"
    ;;
    
  "help"|*)
    echo "ParaWave PTT Backend - Script de développement"
    echo ""
    echo "Commandes disponibles:"
    echo "  dev                 - Démarrer le serveur de développement"
    echo "  deploy              - Déployer en production"
    echo "  logs                - Afficher les logs en temps réel"
    echo "  db:migrate          - Exécuter les migrations de base de données"
    echo "  db:shell            - Ouvrir le shell de la base de données"
    echo "  test                - Vérifier la compilation TypeScript"
    echo "  test:api [url]      - Tester les endpoints API (défaut: localhost:8787)"
    echo "  clean               - Nettoyer les fichiers temporaires"
    echo "  help                - Afficher cette aide"
    echo ""
    echo "Exemple d'utilisation:"
    echo "  ./dev.sh dev        # Démarrer le développement"
    echo "  ./dev.sh test:api   # Tester l'API locale"
    echo "  ./dev.sh deploy     # Déployer"
    ;;
esac

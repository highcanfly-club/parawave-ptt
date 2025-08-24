# Configuration Environment Variables - ParaWave PTT iOS

Ce document explique comment utiliser la configuration basée sur les variables d'environnement pour le développement de l'application iOS ParaWave PTT.

## Vue d'ensemble

L'application iOS ParaWave PTT utilise un système de configuration flexible qui lit les variables d'environnement depuis le fichier `.env` à la racine du projet. Cette approche permet de :

- Partager la configuration entre les différents composants du projet (backend, frontend admin, iOS)
- Faciliter le développement avec des configurations différentes selon l'environnement
- Éviter les valeurs codées en dur dans le code source
- Simplifier la gestion des secrets et tokens de développement

## Architecture de Configuration

### 1. EnvironmentReader

La classe `EnvironmentReader` lit automatiquement le fichier `.env` à la racine du projet et parse les variables d'environnement.

**Fonctionnalités :**
- Recherche automatique du fichier `.env` dans l'arborescence du projet
- Parsing des formats `KEY=VALUE` avec support des commentaires
- Support des guillemets simples et doubles
- Méthodes utilitaires pour différents types (String, Bool, Int, Double)
- Masquage automatique des valeurs sensibles en mode debug

### 2. ConfigurationManager

La classe `ConfigurationManager` utilise `EnvironmentReader` pour fournir une interface centralisée à toute la configuration de l'application.

**Hiérarchie de priorité :**
1. Variables d'environnement (fichier `.env`)
2. Valeurs du Info.plist du bundle
3. Valeurs de fallback codées en dur

## Variables d'Environnement Disponibles

### Configuration Auth0
```env
AUTH0_DOMAIN=highcanfly.eu.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SCOPE="openid profile email read:api write:api admin:api"
AUTH0_AUDIENCE=http://localhost:5173
```

### Configuration API
```env
API_BASE_URL=http://localhost:8787/api/v1
API_VERSION=1.0.0
API_TIMEOUT=30.0
MAX_RETRY_ATTEMPTS=3
```

### Configuration Application
```env
APPLE_APP_BUNDLE_ID=club.highcanfly.parawave-ptt
ENVIRONMENT=development
DEBUG_ENABLED=true
MAX_TRANSMISSION_DURATION=60.0
EMERGENCY_CHANNEL_ID=emergency-global
```

### Configuration Cloudflare (pour les scripts de déploiement)
```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
```

## Utilisation

### 1. Configuration Initiale

```bash
# Copier le template
cp ios/.env.example .env

# Éditer avec vos valeurs
nano .env

# Ou utiliser le script de configuration
./ios/setup-dev.sh
```

### 2. Dans le Code Swift

```swift
// Accès via ConfigurationManager
let config = ConfigurationManager.shared

// Configuration Auth0
let auth0Domain = config.auth0Domain
let clientId = config.auth0ClientId

// Configuration API
let apiURL = config.apiBaseURL
let timeout = config.apiTimeout

// Vérifications d'environnement
if config.isDevelopment {
    print("Mode développement activé")
}
```

### 3. Via NetworkConfiguration

```swift
// Utilisation simplifiée via NetworkConfiguration
let baseURL = NetworkConfiguration.baseURL
let websocketURL = NetworkConfiguration.websocketURL
let auth0Domain = NetworkConfiguration.auth0Domain
```

## Modes d'Environnement

### Mode Développement (`ENVIRONMENT=development`)
- Utilise `API_BASE_URL` pour les appels API
- Active les logs détaillés
- Charge la configuration depuis `.env`
- URL par défaut : `http://localhost:8787/api/v1`

### Mode Production (`ENVIRONMENT=production`)
- Utilise les URLs de production
- Logs minimaux
- URL par défaut : `https://ptt-backend.highcanfly.club/api/v1`

## Script de Développement

Le script `setup-dev.sh` automatise la configuration de l'environnement de développement :

```bash
./ios/setup-dev.sh
```

**Fonctionnalités du script :**
- Vérification de l'existence du fichier `.env`
- Validation des variables requises
- Ouverture automatique de Xcode
- Démarrage du serveur de développement backend
- Lancement de l'iOS Simulator

## Sécurité

### Variables Sensibles
Les variables suivantes sont automatiquement masquées dans les logs :
- `AUTH0_CLIENT_SECRET`
- `AUTH0_MANAGEMENT_CLIENT_SECRET` 
- `CLOUDFLARE_API_TOKEN`
- `CRYPTOKEN`
- `AUTH0_TOKEN`

### Bonnes Pratiques
- Ne jamais committer le fichier `.env` avec des vraies valeurs
- Utiliser des valeurs de développement distinctes
- Faire tourner les secrets régulièrement
- Utiliser des permissions minimales pour les tokens

## Dépannage

### Fichier .env non trouvé
```
⚠️ .env file not found at project root
```
**Solution :** Créer le fichier `.env` à la racine du projet ou utiliser `setup-dev.sh`

### Variables manquantes
```
❌ Missing required environment variables: AUTH0_DOMAIN
```
**Solution :** Ajouter les variables manquantes dans le fichier `.env`

### Problèmes de parsing
- Vérifier la syntaxe `KEY=VALUE`
- Éviter les espaces autour du `=`
- Utiliser des guillemets pour les valeurs avec espaces

### Debug de Configuration

En mode DEBUG, l'application affiche automatiquement :
- La liste de toutes les variables d'environnement chargées
- Les valeurs de configuration utilisées (avec masquage des secrets)
- L'état de l'environnement de développement

```swift
#if DEBUG
EnvironmentReader.printAllEnvironmentVariables()
#endif
```

## Exemple Complet

Fichier `.env` typique pour le développement :

```env
# Configuration de base
ENVIRONMENT=development
DEBUG_ENABLED=true

# Auth0
AUTH0_DOMAIN=highcanfly.eu.auth0.com
AUTH0_CLIENT_ID=AGONL8vQ499yY9jRS7qxutc3A1DffSDo
AUTH0_SCOPE="openid profile email read:api write:api admin:api"
AUTH0_AUDIENCE=http://localhost:5173

# API locale pour développement
API_BASE_URL=http://localhost:8787/api/v1
API_TIMEOUT=30.0

# Application
APPLE_APP_BUNDLE_ID=club.highcanfly.parawave-ptt
MAX_TRANSMISSION_DURATION=60.0
```

Cette configuration sera automatiquement chargée au démarrage de l'application et utilisée par tous les composants.
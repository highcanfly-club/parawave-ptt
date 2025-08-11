# ParaWave PTT Backend - Cloudflare Worker

## Vue d'ensemble

Cette implémentation fournit un backend complet pour la gestion des canaux PTT (Push-to-Talk) parapente, conçu spécifiquement selon l'analyse technique détaillée dans `docs/ios_ptt_analysis.md`.

## Architecture

### Composants principaux

1. **API REST** (`/api/v1/`)
   - Gestion CRUD complète des canaux PTT
   - Authentification Auth0 avec permissions
   - Validation et gestion d'erreurs

2. **Durable Objects** (`/channel/{uuid}`)
   - Communication en temps réel WebSocket
   - Gestion des participants
   - Coordination des transmissions PTT

3. **Base de données D1**
   - Stockage persistant des canaux
   - Historique des transmissions
   - Géolocalisation et sites de vol

4. **Cache KV**
   - Cache haute performance
   - Session utilisateur
   - Données fréquemment accédées

## Endpoints API

### Canaux PTT

- `GET /api/v1/channels` - Liste des canaux
- `POST /api/v1/channels` - Créer un canal
- `GET /api/v1/channels/{uuid}` - Détails du canal
- `PUT /api/v1/channels/{uuid}` - Modifier le canal
- `DELETE /api/v1/channels/{uuid}` - Supprimer le canal

### Communication temps réel

- `WebSocket /channel/{uuid}/websocket` - Communication en temps réel
- `POST /channel/{uuid}/join` - Rejoindre le canal
- `POST /channel/{uuid}/leave` - Quitter le canal
- `POST /channel/{uuid}/transmission` - Démarrer/arrêter transmission

### Santé et statistiques

- `GET /api/v1/health` - État du service
- `GET /api/v1/channels/{uuid}/stats` - Statistiques du canal

## Configuration

### Variables d'environnement

Les variables d'environnement sont définies dans `wrangler.jsonc` dans la section `vars` pour les valeurs publiques, et via `wrangler secret` pour les valeurs sensibles.

### Génération des types TypeScript

Les types TypeScript sont générés automatiquement par Wrangler basés sur votre configuration :

```bash
# Régénérer les types après modification de wrangler.jsonc
npx wrangler types
```

### Bindings Cloudflare

- **PTT_DB**: Base de données D1 SQLite
- **PTT_CACHE**: Namespace KV pour le cache
- **CHANNEL_OBJECTS**: Durable Objects pour temps réel
- **RATE_LIMITER**: Rate limiting

⚠️ **Important**: N'éditez jamais `worker-configuration.d.ts` manuellement. Ce fichier est généré automatiquement par `wrangler types`.

## Authentification

### Auth0 Integration

- JWT Bearer token validation
- Permission-based access control:
  - `read:api` - Lecture des canaux
  - `write:api` - Création/modification
  - `admin:api` - Administration complète

## Structure des données

### Canal PTT

```typescript
interface PTTChannel {
	uuid: string;
	name: string;
	description?: string;
	frequency?: number;
	flying_site_id?: number;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	creator_user_id: string;
	max_participants?: number;
}
```

### Participants

```typescript
interface ChannelParticipant {
	channel_uuid: string;
	user_id: string;
	joined_at: string;
	role: "participant" | "moderator" | "admin";
	is_transmitting: boolean;
	location?: GeolocationCoordinates;
}
```

## Déploiement

### Prérequis

1. Compte Cloudflare avec Workers activés
2. Configuration Auth0
3. Base de données D1 créée

### Étapes

```bash
# 1. Configuration des variables
cp .env.example .env
# Éditer .env avec vos valeurs

# 2. Migration base de données
wrangler d1 execute PTT_DB --file=./migrations/001_initial_schema.sql

# 3. Déploiement
wrangler deploy
```

### Configuration wrangler.jsonc

Le fichier `wrangler.jsonc` est déjà configuré avec:

- Database binding (PTT_DB)
- KV namespace (PTT_CACHE)
- Durable Objects (CHANNEL_OBJECTS)
- Rate limiting

## Développement

### Tests locaux

```bash
# Démarrer en mode développement
wrangler dev

# Tests avec curl
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8787/api/v1/health
```

### Structure du code

```
src/
├── index.ts                 # Point d'entrée principal
├── auth0.ts                 # Authentification Auth0
├── types/
│   ├── ptt.ts              # Types PTT
│   └── env.ts              # Types environnement
├── services/
│   └── channel-service.ts   # Logique métier
├── handlers/
│   └── api-handler.ts       # Gestionnaires API
└── durable-objects/
    └── channel-durable-object.ts # Objets durables
```

## Conformité avec l'analyse iOS

Cette implémentation respecte intégralement les spécifications de l'analyse PTT parapente:

✅ **Architecture REST API** conforme aux standards iOS  
✅ **Authentification Auth0** avec gestion des permissions  
✅ **Base de données relationnelle** avec géolocalisation  
✅ **Communication temps réel** WebSocket pour PTT  
✅ **Gestion des canaux** avec participants et modération  
✅ **Intégration sites de vol** pour contexte géographique  
✅ **Historique des transmissions** pour audit  
✅ **Optimisation performance** avec cache et Durable Objects

## Support et maintenance

- **Logs**: Disponibles via Cloudflare Workers dashboard
- **Monitoring**: Métriques intégrées Cloudflare
- **Scaling**: Automatique avec Cloudflare Workers
- **Security**: HTTPS par défaut, Auth0 enterprise

Cette implémentation fournit une base robuste et évolutive pour l'application PTT parapente iOS décrite dans votre analyse technique.

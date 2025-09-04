# PTT Web Client - Client Identification

## Problème résolu

Le système PTT permet à un utilisateur de se connecter depuis plusieurs appareils simultanément. Pour éviter les conflits et permettre une identification unique de chaque client, nous utilisons des tokens éphémères.

## Architecture

### Côté serveur (Cloudflare Workers)
- Utilise `ephemeral_push_token` comme identifiant unique des clients
- Stocke les participants avec leur `ephemeral_push_token` comme clé
- Le client iOS utilise déjà l'`ephemeral_push_token` généré par le framework PTT

### Côté client web
- Génère un token éphémère unique
- Le stocke dans localStorage pour la persistance
- L'envoie lors des appels API (join channel, WebSocket)

## Implémentation côté client web

```typescript
/**
 * Utility functions for client identification in web browsers
 */
export class WebClientIdUtils {
	/**
	 * Generate a unique ephemeral token for client identification
	 */
	static generateEphemeralToken(prefix: string = "web"): string {
		const timestamp = Date.now().toString(36);
		const random = Math.random().toString(36).substring(2, 15);
		const fingerprint = this.getBrowserFingerprint();

		return `${prefix}_${timestamp}_${random}_${fingerprint}`;
	}

	/**
	 * Generate a simple browser fingerprint for additional uniqueness
	 */
	private static getBrowserFingerprint(): string {
		try {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			ctx?.fillText('fingerprint', 10, 10);

			const fingerprint = [
				navigator.userAgent,
				navigator.language,
				screen.width + 'x' + screen.height,
				new Date().getTimezoneOffset(),
				!!window.sessionStorage,
				!!window.localStorage,
				!!window.indexedDB,
				canvas.toDataURL()
			].join('|');

			return btoa(fingerprint).substring(0, 8);
		} catch (error) {
			return Math.random().toString(36).substring(2, 8);
		}
	}

	/**
	 * Store ephemeral token in localStorage
	 */
	static storeEphemeralToken(token: string): void {
		localStorage.setItem('ptt_ephemeral_token', token);
	}

	/**
	 * Retrieve ephemeral token from localStorage
	 */
	static getStoredEphemeralToken(): string | null {
		return localStorage.getItem('ptt_ephemeral_token');
	}

	/**
	 * Get or create an ephemeral token for the current client
	 */
	static getOrCreateEphemeralToken(prefix: string = "web"): string {
		let token = this.getStoredEphemeralToken();

		if (!token) {
			token = this.generateEphemeralToken(prefix);
			this.storeEphemeralToken(token);
		}

		return token;
	}
}

/**
 * WebSocket connection utilities for PTT
 */
export class PTTWebSocketUtils {
	/**
	 * Create a WebSocket URL with proper authentication and client identification
	 */
	static createWebSocketUrl(
		baseUrl: string,
		channelUuid: string,
		userId: string,
		username: string,
		ephemeralToken: string,
		token: string
	): string {
		const url = new URL(`${baseUrl}/api/v1/channels/${channelUuid}/transmission/ws`);
		url.searchParams.set('userId', userId);
		url.searchParams.set('username', username);
		url.searchParams.set('ephemeralPushToken', ephemeralToken);
		url.searchParams.set('token', token);

		return url.toString();
	}

	/**
	 * Create a join channel request payload with ephemeral token
	 */
	static createJoinRequest(
		ephemeralToken: string,
		location?: { lat: number; lon: number },
		deviceInfo?: { os?: string; os_version?: string; app_version?: string }
	) {
		return {
			ephemeral_push_token: ephemeralToken,
			location,
			device_info: deviceInfo
		};
	}
}
```

## Utilisation dans le code client

### 1. Initialisation du client

```typescript
// Au démarrage de l'application
const ephemeralToken = WebClientIdUtils.getOrCreateEphemeralToken();

// Stocker pour utilisation ultérieure
window.pttClientId = ephemeralToken;
```

### 2. Rejoindre un canal

```typescript
const joinRequest = PTTWebSocketUtils.createJoinRequest(
	ephemeralToken,
	userLocation,
	{
		os: 'Web',
		os_version: navigator.userAgent,
		app_version: '1.0.0'
	}
);

// Envoyer la requête de join
await fetch(`/api/v1/channels/${channelUuid}/join`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(joinRequest)
});
```

### 3. Connexion WebSocket

```typescript
const wsUrl = PTTWebSocketUtils.createWebSocketUrl(
	baseUrl,
	channelUuid,
	userId,
	username,
	ephemeralToken,
	jwtToken
);

const ws = new WebSocket(wsUrl);
```

## Avantages

1. **Identification unique** : Chaque appareil/client a son propre identifiant
2. **Persistance** : Le token est stocké dans localStorage
3. **Sécurité** : Tokens éphémères difficiles à deviner
4. **Compatibilité** : Fonctionne avec iOS (qui utilise déjà les ephemeral tokens) et web
5. **Déduplication** : Évite les conflits entre appareils du même utilisateur

## Format du token

```
web_1k8n4z7_abc123def_xyz789
├───┘    ├───┘    └───┘
prefix  timestamp  fingerprint
```

- **Prefix** : "web" pour les clients web, "ios" pour iOS, etc.
- **Timestamp** : Timestamp encodé en base36
- **Random** : Chaîne aléatoire pour l'unicité
- **Fingerprint** : Empreinte du navigateur pour différencier les instances

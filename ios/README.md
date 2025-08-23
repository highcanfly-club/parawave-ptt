# ParaWave PTT - Application iOS

Application iOS de communication Push-to-Talk dédiée aux parapentistes, développée en Swift avec intégration du framework PushToTalk d'Apple.

## 🚁 Vue d'ensemble

ParaWave PTT est une application de communication vocale instantanée conçue spécifiquement pour les pratiquants de parapente. Elle utilise les dernières technologies d'Apple pour offrir une expérience PTT native et optimisée.

### Fonctionnalités principales

- **Push-to-Talk natif iOS 16+** : Utilisation du framework PushToTalk d'Apple
- **Authentification Auth0** : Connexion sécurisée avec support biométrique
- **Audio optimisé parapente** : Encodage AAC-LC avec réduction de bruit de vent
- **Géolocalisation** : Canaux automatiques basés sur le site de vol
- **Interface hybride** : SwiftUI + UIKit pour une expérience utilisateur optimale
- **Communications d'urgence** : Canal d'urgence dédié et appel 112
- **Support VHF** : Intégration des fréquences de secours locales

## 📋 Prérequis

### Environnement de développement

- Xcode 15.0+
- iOS 16.0+ (pour le framework PushToTalk)
- Swift 5.9+
- macOS 14.0+ (Sonoma)

### Permissions requises

- **Microphone** : Pour les transmissions vocales
- **Localisation** : Suggestion de canaux basée sur la position
- **Push-to-Talk** : Framework natif iOS 16+
- **Notifications** : Alertes d'urgence et statut des canaux
- **Face ID/Touch ID** : Authentification biométrique (optionnelle)

### Services externes

- **Auth0** : Service d'authentification
- **API ParaWave** : Backend de gestion des canaux et transmissions
- **Apple Push Notification Service** : Notifications push

## 🏗 Architecture

### Structure du projet

```
ParaWavePTT/
├── Models/
│   └── Models.swift              # Modèles de données (API, Auth0, PTT)
├── Services/
│   ├── Auth0KeychainManager.swift    # Gestion sécurisée des tokens
│   ├── NetworkService.swift         # Client API REST
│   ├── PTTChannelManager.swift      # Gestion des canaux PTT
│   ├── PTTAudioManager.swift        # Traitement audio AAC-LC
│   └── ParapenteStateManager.swift  # État global de l'application
├── Views/
│   ├── ContentView.swift           # Interface SwiftUI principale
│   └── MainViewController.swift    # Contrôleur UIKit hybride
├── Utils/
│   ├── ErrorManager.swift          # Gestion centralisée des erreurs
│   ├── PermissionManager.swift     # Gestion des permissions
│   └── LogManager.swift            # Système de logging
├── Config/
│   └── ConfigurationManager.swift  # Configuration centralisée
└── Localization/
    ├── LocalizableStrings.swift    # Chaînes localisées
    ├── fr.lproj/Localizable.strings # Français
    └── en.lproj/Localizable.strings # Anglais
```

### Composants principaux

#### 🔐 Auth0KeychainManager

- Stockage sécurisé des tokens dans le Keychain iOS
- Authentification biométrique optionnelle
- Gestion automatique du renouvellement des tokens

#### 🌐 NetworkService

- Client HTTP pour l'API ParaWave
- Gestion des canaux, participants et transmissions
- Retry automatique et gestion des erreurs réseau
- Support de la géolocalisation

#### 📻 PTTChannelManager

- Interface avec le framework PushToTalk d'iOS 16+
- Gestion des canaux et participants PTT
- Délégués pour les événements de transmission
- Push tokens et notifications

#### 🎵 PTTAudioManager

- Encodage/décodage AAC-LC optimisé matériellement
- Réduction du bruit de vent pour environnement aérien
- Contrôle automatique du gain
- Session audio en temps réel

#### 🧭 ParapenteStateManager

- État global de l'application avec @MainActor
- Coordination entre services
- Gestion des transitions d'état
- Récupération d'erreurs

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `Config.xcconfig` avec les variables suivantes :

```bash
// Auth0 Configuration
AUTH0_DOMAIN = parawave-ptt.eu.auth0.com
AUTH0_CLIENT_ID = your_client_id_here
AUTH0_AUDIENCE = https://api.parawave.app

// API Configuration
API_BASE_URL_PROD = https://api.parawave.app/v1
API_BASE_URL_DEV = http://localhost:3000/v1

// Feature Flags
EMERGENCY_FEATURE_ENABLED = YES
VHF_INTEGRATION_ENABLED = YES
BIOMETRIC_AUTH_SUPPORTED = YES
LOCATION_BASED_CHANNELS_ENABLED = YES
```

### Configuration Auth0

1. Créer une application "Native" dans le dashboard Auth0
2. Configurer les URLs de callback : `com.parawave.ptt://*/ios/callback`
3. Activer les permissions : `openid profile email offline_access read:channels write:channels read:transmissions write:transmissions`

### Entitlements

Le fichier `ParaWavePTT.entitlements` doit contenir :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.parawave.ptt</string>
    </array>
    <key>com.apple.developer.push-to-talk</key>
    <true/>
    <key>keychain-access-groups</key>
    <array>
        <string>$(AppIdentifierPrefix)com.parawave.ptt</string>
    </array>
</dict>
</plist>
```

## 🚀 Installation et compilation

### 1. Clone du repository

```bash
git clone https://github.com/parawave/parawave-ptt.git
cd parawave-ptt/ios
```

### 2. Configuration Xcode

```bash
open ParaWavePTT.xcodeproj
```

### 3. Configuration des signing certificates

- Sélectionner le target ParaWavePTT
- Dans "Signing & Capabilities", configurer l'équipe de développement
- Vérifier que l'entitlement Push-to-Talk est activé

### 4. Installation des dépendances

Les frameworks système sont automatiquement liés :

- Foundation
- UIKit
- SwiftUI
- PushToTalk (iOS 16+)
- AVFoundation
- CoreLocation
- Security
- UserNotifications
- Network

### 5. Compilation

```bash
# Simulation iOS
xcodebuild -project ParaWavePTT.xcodeproj -scheme ParaWavePTT -destination 'platform=iOS Simulator,name=iPhone 15 Pro' build

# Device iOS (nécessite certificat développeur)
xcodebuild -project ParaWavePTT.xcodeproj -scheme ParaWavePTT -destination generic/platform=iOS build
```

## 🧪 Tests et debugging

### Logs de debug

L'application utilise le `LogManager` pour un logging structuré :

```swift
// Exemples d'utilisation
LogManager.shared.auth("User signed in successfully")
LogManager.shared.network("API request failed", level: .error)
LogManager.shared.ptt("Channel joined: \(channelName)")
LogManager.shared.audio("Audio quality: \(quality)")
```

### Simulateur vs Device réel

| Fonctionnalité  | Simulateur   | Device réel  |
| --------------- | ------------ | ------------ |
| Auth0           | ✅           | ✅           |
| API Network     | ✅           | ✅           |
| Audio recording | ❌           | ✅           |
| Push-to-Talk    | ❌           | ✅ (iOS 16+) |
| Localisation    | ✅ (simulée) | ✅           |
| Notifications   | ✅           | ✅           |
| Biométrie       | ✅ (simulée) | ✅           |

### Tests sur device

Pour tester les fonctionnalités PTT complètes :

1. Utiliser un iPhone avec iOS 16+
2. Activer les permissions microphone et localisation
3. Tester en extérieur pour la géolocalisation
4. Valider l'audio avec des écouteurs/casque

## 🌐 Localisation

L'application supporte le français et l'anglais :

- **Français** : `fr.lproj/Localizable.strings`
- **Anglais** : `en.lproj/Localizable.strings`

Ajout d'une nouvelle langue :

1. Créer le dossier `[langue].lproj/`
2. Copier `Localizable.strings` et traduire
3. Ajouter la langue dans `Info.plist` → `CFBundleLocalizations`

## 🔒 Sécurité

### Stockage des données sensibles

- **Tokens Auth0** : Keychain iOS avec protection biométrique
- **Préférences utilisateur** : UserDefaults (non sensibles)
- **Cache réseau** : Chiffré avec clés éphémères

### Transport

- **HTTPS/TLS 1.3** pour toutes les communications API
- **Certificate pinning** pour Auth0
- **Token refresh** automatique sécurisé

### Permissions

- **Principe de moindre privilège** appliqué
- **Demande contextuelle** des permissions
- **Dégradation gracieuse** si permissions refusées

## 📈 Performance

### Optimisations audio

- **Encodage AAC-LC matériel** pour efficacité énergétique
- **Buffers adaptatifs** selon la qualité réseau
- **Compression dynamique** pour conditions venteuses

### Optimisations réseau

- **Connection pooling** HTTP/2
- **Cache intelligent** des canaux et participants
- **Reconnexion automatique** en cas de perte réseau

### Optimisations UI

- **SwiftUI lazy loading** pour les listes
- **Images optimisées** avec compression
- **Animations 60fps** avec Core Animation

## 🆘 Fonctionnalités d'urgence

### Canal d'urgence

- **Priorité maximale** sur tous les autres canaux
- **Géolocalisation automatique** transmise
- **Notifications push** à tous les utilisateurs de la zone

### Intégration 112

- **Appel direct** depuis l'interface
- **Coordonnées GPS** automatiquement préparées
- **Contexte parapente** fourni aux secours

### Backup VHF

- **Fréquences locales** affichées selon la région
- **Basculement automatique** si réseau faible
- **Guide d'utilisation** VHF intégré

## 🐛 Dépannage

### Problèmes courants

#### Push-to-Talk non disponible

```
Erreur : PTT_NOT_SUPPORTED
Solution : Vérifier iOS 16+ et device réel (pas simulateur)
```

#### Authentification échoue

```
Erreur : AUTH_FAILED
Solution : Vérifier la configuration Auth0 dans Info.plist
```

#### Permissions microphone refusées

```
Erreur : MIC_PERMISSION_DENIED
Solution : Paramètres iOS → Confidentialité → Microphone → ParaWave PTT
```

#### Géolocalisation imprécise

```
Erreur : LOCATION_ACCURACY_INSUFFICIENT
Solution : Paramètres iOS → Confidentialité → Service de localisation → Précision
```

### Logs système

```bash
# Console macOS pour voir les logs de l'app
log show --predicate 'subsystem == "com.parawave.ptt"' --last 1h

# Logs spécifiques au PTT framework
log show --predicate 'category == "PTT"' --last 30m
```

## 📞 Support

### Ressources

- **Documentation Apple PTT** : [Developer Documentation](https://developer.apple.com/documentation/pushtotalk)
- **Auth0 iOS SDK** : [Auth0 Documentation](https://auth0.com/docs/quickstart/native/ios-swift)
- **Guide parapente** : [Documentation interne]

### Contact

- **Équipe développement** : dev@parawave.app
- **Support utilisateurs** : support@parawave.app
- **Issues GitHub** : [Créer une issue](https://github.com/parawave/parawave-ptt/issues)

---

## 📄 Licence

Copyright © 2024 ParaWave. Tous droits réservés.

Cette application est développée spécifiquement pour la communauté parapente et utilise des technologies propriétaires Apple sous licence développeur.

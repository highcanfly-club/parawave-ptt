# Analyse Technique - Application iOS Push-to-Talk pour Parapentistes

## Résumé Exécutif

Ce document fournit une analyse technique complète pour le développement d'une application iOS de talkie-walkie half-duplex destinée aux parapentistes, utilisant le framework PushToTalk d'Apple pour iOS 16+. L'application servira de **complément aux radios VHF/UHF traditionnelles**, exploitant la couverture 4G/5G pour étendre les communications dans les zones où les radios analogiques sont limitées.

## Vue d'Ensemble du Projet

### Contexte d'Utilisation

Application de communication vocale pour groupes fermés de parapentistes, conçue comme **système de communication hybride** :

- **Utilisation primaire** : Complément aux radios VHF/UHF 144-149 MHz et 400-440 MHz
- **Avantages** : Portée étendue via couverture cellulaire, qualité audio numérique
- **Limitations acceptées** : Dépendance à la couverture 4G/5G, latence réseau
- **Cas d'usage spécifiques** : Cross-country, communications sol-air, coordination de sites éloignés

### Type d'Application

Application de communication half-duplex simulant les radios deux voies traditionnelles avec adaptations spécifiques au parapente

### Plateforme Cible

- iOS 16.0 et versions ultérieures
- Langage de programmation Swift
- Framework Apple PushToTalk

### Langues Supportées

- Français (France) - Primaire
- Anglais (États-Unis)
- Espagnol (Espagne)
- Italien (Italie)

### Fonctionnalités Clés

- Authentification utilisateur avec stockage sécurisé dans le trousseau
- Sélection dynamique de canaux depuis le backend
- Transmission audio temps réel via PushToTalk
- Intégration des boutons de volume physiques
- Persistance des canaux entre les redémarrages
- Bouton d'urgence appelant les urgences européennes (112)
- **Indicateur de force du signal 4G/5G**
- **Mode dégradé avec notifications en cas de perte réseau**
- **Canaux prédéfinis pour sites de vol spécifiques**
- **Intégration optionnelle avec données météo locales**
- **Gestion de groupes fermés avec invitations**

## Architecture Globale

```mermaid
graph TB
    A[Lancement App iOS] --> B[Vérification Authentification]
    B --> C{Identifiants Existent?}
    C -->|Non| D[Écran de Connexion]
    C -->|Oui| E[Authentification Backend]
    D --> F[Stockage Trousseau]
    F --> E
    E --> G[Réception Liste Canaux]
    G --> H[Interface Sélection Canal]
    H --> I[Rejoindre Canal Sélectionné]
    I --> J[Interface PTT]
    J --> K[Transmission Audio]

    L[Gestionnaire Bouton Volume] --> K
    M[Changement Canal] --> N[Quitter Canal Actuel]
    N --> I

    O[Surveillance Réseau] --> P{Connexion 4G/5G?}
    P -->|Oui| J
    P -->|Non| Q[Mode Dégradé]
    Q --> R[Notifications Offline]

    S[Localisation GPS] --> T[Canal Site Automatique]
    T --> I
```

## Exigences Techniques

### Configuration Système

- iOS 16.0+ comme version de déploiement cible
- Xcode 14.0+ pour le développement
- Habilitation framework PushToTalk
- Capacité audio en arrière-plan
- Permission d'utilisation du microphone
- **Permission de localisation pour canaux géo-localisés**
- **Surveillance de l'état du réseau cellulaire**

### Dépendances

- Foundation framework
- UIKit framework
- PushToTalk framework
- Security framework (Trousseau)
- AVFoundation framework
- Network framework
- **CoreLocation framework (géolocalisation sites de vol)**
- **CoreTelephony framework (surveillance signal cellulaire)**

## Analyse Framework : PushToTalk

### Composants Principaux

#### PTChannelManager

```swift
// Gestionnaire principal pour les opérations de canal PTT
let channelManager = PTChannelManager.shared
```

#### PTChannelDescriptor

```swift
// Objet de configuration de canal
let channelDescriptor = PTChannelDescriptor(
    name: channelName,
    image: channelImage
)
```

#### Méthodes Clés

- `requestJoinChannel(_:)` - Rejoindre un canal spécifique
- `leaveChannel(_:)` - Quitter le canal actuel
- `setActiveRemoteParticipant(_:)` - Définir le locuteur actif
- `stopTransmitting()` - Terminer la transmission

### Considérations d'Intégration

Le framework PushToTalk fonctionne comme un service au niveau système nécessitant des habilitations spécifiques et une gestion d'état minutieuse. Les sessions audio doivent être configurées correctement pour fonctionner avec les exigences du framework.

## Flux d'Application Spécialisé Parapente

```mermaid
sequenceDiagram
    participant P as Parapentiste
    participant A as App
    participant K as Trousseau
    participant B as Backend
    participant PTT as PushToTalk
    participant L as CoreLocation
    participant N as Network Monitor

    P->>A: Lancement App
    A->>K: Vérification Identifiants
    K-->>A: Retour Identifiants

    alt Pas d'Identifiants
        A->>P: Affichage Connexion
        P->>A: Saisie Identifiants
        A->>K: Stockage Identifiants
    end

    A->>B: Authentification
    B-->>A: Liste Canaux JSON

    A->>L: Demande Localisation
    L-->>A: Coordonnées GPS
    A->>B: Canaux pour Site Local
    B-->>A: Canaux Géo-Localisés

    A->>P: Affichage Sélection Canal
    P->>A: Sélection Canal
    A->>PTT: Rejoindre Canal

    loop Communication PTT
        P->>A: Appui Bouton TALK
        A->>N: Vérification Réseau
        N-->>A: État 4G/5G
        alt Réseau Disponible
            A->>PTT: Début Transmission
        else Pas de Réseau
            A->>P: Notification Hors-Ligne
        end
        P->>A: Relâchement TALK
        A->>PTT: Arrêt Transmission
    end
```

## Conception Interface Utilisateur Adaptée Parapente

### Hiérarchie des Écrans

1. **Écran de Lancement** - Expérience de lancement iOS standard
2. **Écran d'Authentification** - Saisie nom d'utilisateur/mot de passe (premier lancement uniquement)
3. **Interface Principale** - Sélection canal et contrôles PTT
4. **Écran Paramètres** - Configuration sites favoris, préférences audio
5. **Écran État Réseau** - Diagnostic couverture 4G/5G et latence

### Layout Interface Principale

```mermaid
graph TD
    A[Barre Navigation<br/>Titre App + État Réseau] --> B[Indicateur Signal 4G/5G<br/>Latence Réseau]
    B --> C[Sélecteur Canal<br/>UIPickerView avec Sites]
    C --> D[État Connexion<br/>UILabel + Participants]
    D --> E[Bouton PTT<br/>Bouton Circulaire Large]
    E --> F[Messages Statut<br/>UILabel + Feedback Audio]

    G[Bouton Paramètres<br/>Navigation Item] --> A
    H[Bouton Urgence<br/>Canal Prioritaire] --> C
```

### Spécifications Composants UI Spécialisés

#### Sélecteur de Canal Géo-Localisé

- **Composant**: UIPickerView avec sections par site de vol
- **Comportement**: Sélection unique, commutation immédiate de canal
- **Fonctionnalités**: Auto-sélection basée sur GPS, canaux favoris
- **Styling**: Apparence native iOS 16+ avec coins arrondis

#### Bouton PTT Optimisé Vol

- **Composant**: UIButton personnalisé avec design circulaire
- **Taille**: Minimum 140x140 points pour utilisation avec gants
- **États**: Normal, Pressé, Désactivé, Transmission, Hors-Ligne
- **Animation**: Transitions d'échelle et couleur avec feedback haptique
- **Ergonomie**: Accessible en vol avec une main

#### Indicateurs de Statut Spécialisés

- **Statut Réseau**: Indicateur 4G/5G avec force du signal et latence
- **Statut Transmission**: Feedback visuel et sonore pendant l'audio
- **Info Canal**: Nom canal actuel, nombre de participants, site de vol
- **Statut GPS**: Précision localisation pour canaux géo-localisés

## Intégration Backend Spécialisée

### Endpoint d'Authentification

```
GET https://ptt.highcanfly.club?user=USER&pass=PASSWORD&location=LAT,LON
```

### Format de Réponse Étendu

```json
{
  "user": "username",
  "pass": "password",
  "channels": [
    {
      "name": "Chamonix - Mont Blanc",
      "uuid": "F4D667DB-2F17-4177-8D70-914024A7A5C1",
      "type": "site_local",
      "coordinates": {
        "lat": 45.929681,
        "lon": 6.876345
      },
      "radius_km": 50,
      "frequency_vhf": "144.150",
      "description": "Canal principal site Chamonix"
    },
    {
      "name": "Urgence Alpes",
      "uuid": "A1B2C3D4-5E6F-7G8H-9I0J-K1L2M3N4O5P6",
      "type": "emergency",
      "priority": 1,
      "always_available": true
    }
  ],
  "user_groups": ["parapente_chamonix", "instructeurs"],
  "network_status": {
    "server_latency_ms": 45,
    "recommended_codec": "aac-lc",
    "bitrate_kbps": 32,
    "sample_rate": 22050
  }
}
```

### Architecture Couche Réseau Améliorée

```swift
protocol ParapenteNetworkServiceProtocol {
    func authenticate(username: String, password: String, location: CLLocation?) async throws -> ParapenteAuthResponse
    func getChannelsForLocation(location: CLLocation, radius: Double) async throws -> [ParapenteChannel]
    func joinChannel(channelUUID: String, userLocation: CLLocation?) async throws -> ChannelResponse
    func reportNetworkQuality(latency: TimeInterval, signalStrength: Int) async throws -> Void
    func sendEmergencyAlert(location: CLLocation, message: String) async throws -> Void
}

class ParapenteNetworkService: ParapenteNetworkServiceProtocol {
    private let session = URLSession.shared
    private let baseURL = "https://ptt.highcanfly.club"
    private var networkMonitor = NWPathMonitor()

    // Implémentation spécialisée parapente...
}
```

## Stratégie de Stockage des Données

### Implémentation Trousseau

```swift
import Security

class KeychainManager {
    private let service = "com.highcanfly.pttapp"

    func store(username: String, password: String) throws {
        // Implémentation du stockage sécurisé des identifiants
    }

    func retrieve() throws -> (username: String, password: String)? {
        // Implémentation de la récupération des identifiants
    }

    func delete() throws {
        // Implémentation de la suppression des identifiants
    }
}
```

### UserDefaults pour Préférences Parapente

```swift
extension UserDefaults {
    var lastSelectedChannelUUID: String? {
        get { string(forKey: "lastSelectedChannelUUID") }
        set { set(newValue, forKey: "lastSelectedChannelUUID") }
    }

    var preferredLanguage: String {
        get { string(forKey: "preferredLanguage") ?? "fr" }
        set { set(newValue, forKey: "preferredLanguage") }
    }

    // Nouvelles préférences spécialisées parapente
    var favoriteFlyingSites: [String] {
        get { stringArray(forKey: "favoriteFlyingSites") ?? [] }
        set { set(newValue, forKey: "favoriteFlyingSites") }
    }

    var autoJoinSiteChannels: Bool {
        get { bool(forKey: "autoJoinSiteChannels") }
        set { set(newValue, forKey: "autoJoinSiteChannels") }
    }

    var enableEmergencyMode: Bool {
        get { bool(forKey: "enableEmergencyMode") }
        set { set(newValue, forKey: "enableEmergencyMode") }
    }

    var vhfFrequencyBackup: String? {
        get { string(forKey: "vhfFrequencyBackup") }
        set { set(newValue, forKey: "vhfFrequencyBackup") }
    }
}
```

## Stratégie de Localisation

### Locales Supportées

- `fr-FR` (Localisation de base)
- `en-US`
- `es-ES`
- `it-IT`

### Zones de Localisation Clés

1. **Écran d'Authentification**
   - Labels nom d'utilisateur/mot de passe
   - Texte bouton connexion
   - Messages d'erreur

2. **Interface Principale**
   - Labels sélection canal
   - Texte bouton PTT ("PARLER"/"PARLA"/"HABLAR"/"TALK")
   - Messages de statut
   - Indicateurs de connexion
   - **Noms de sites de vol localisés**
   - **Messages d'urgence**
   - **Bouton d'urgence appelant les urgences européennes après un appui de 3 secondes (112)**

3. **Intégration Système**
   - Textes de notifications
   - Messages de demande de permissions
   - Alertes d'erreur
   - **Notifications push d'urgence**

### Approche d'Implémentation Parapente

```swift
// Structure Localizable.strings spécialisée
"auth.username.placeholder" = "Nom d'utilisateur";
"auth.password.placeholder" = "Mot de passe";
"auth.login.button" = "Connexion";
"main.talk.button" = "PARLER";
"main.channel.label" = "Canal";
"status.connected" = "Connecté";
"status.disconnected" = "Déconnecté";
"status.network.2g" = "GPRS Disponible";
"status.network.3g" = "3G Disponible";
"status.network.4g" = "4G Disponible";
"status.network.5g" = "5G Disponible";
"status.network.offline" = "Hors ligne - Mode VHF recommandé";
"error.network.title" = "Erreur Réseau";
"emergency.channel.name" = "URGENCE";
"site.annecy.name" = "Annecy - Forclaz";
"site.chamonix.name" = "Chamonix - Vallée Blanche";
"notification.emergency.title" = "Alerte Urgence Parapente";
"vhf.backup.frequency" = "Fréquence VHF de secours";

// Traductions anglaises
"auth.username.placeholder" = "Username"; // en
"auth.password.placeholder" = "Password"; // en
"auth.login.button" = "Login"; // en
"main.talk.button" = "TALK"; // en
"main.channel.label" = "Channel"; // en
"status.connected" = "Connected"; // en
"status.disconnected" = "Disconnected"; // en
"status.network.2g" = "GPRS Available";
"status.network.3g" = "3G Available"; // en
"status.network.4g" = "4G Available"; // en
"status.network.5g" = "5G Available"; // en
"status.network.offline" = "Offline - VHF mode recommended"; // en
"error.network.title" = "Network Error"; // en

// Traductions espagnoles
"main.talk.button" = "HABLAR"; // es
"main.channel.label" = "Canal"; // es
"status.connected" = "Conectado"; // es
"status.disconnected" = "Desconectado"; // es

// Traductions italiennes
"main.talk.button" = "PARLA"; // it
"main.channel.label" = "Canale"; // it
"status.connected" = "Connesso"; // it
"status.disconnected" = "Disconnesso"; // it
```

## Intégration Audio et Matériel Spécialisée Parapente

### Configuration Framework PushToTalk Optimisée

```swift
class ParapentePTTManager: NSObject {
    private let channelManager = PTChannelManager.shared
    private var currentChannel: PTChannelDescriptor?
    private let locationManager = CLLocationManager()
    private let networkMonitor = NWPathMonitor()

    override init() {
        super.init()
        channelManager.delegate = self
        configureAudioSessionForFlight()
        setupNetworkMonitoring()
        setupLocationServices()
    }

    private func configureAudioSessionForFlight() {
        let audioSession = AVAudioSession.sharedInstance()
        try? audioSession.setCategory(.playAndRecord,
                                    mode: .voiceChat,
                                    options: [.allowBluetooth,
                                             .defaultToSpeaker,
                                             .allowBluetoothA2DP,
                                             .allowAirPlay])

        // Configuration spéciale pour environnement bruyant (vent)
        try? audioSession.setPreferredInputGain(0.8)
        try? audioSession.setPreferredSampleRate(22050) // Optimal pour AAC-LC

        // Configuration codec AAC-LC pour iOS (optimisé hardware)
        self.configureAACEncoder()
    }

    private func configureAACEncoder() {
        // Configuration encodeur AAC-LC natif iOS
        let audioFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: 22050,
            channels: 1,
            interleaved: false
        )

        // AAC-LC 32 kbps pour PTT (balance qualité/latence/bande passante)
        // Hardware-accelerated sur tous les devices iOS depuis iPhone 5s
    }

    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            self?.handleNetworkStatusChange(path)
        }
        let queue = DispatchQueue(label: "NetworkMonitor")
        networkMonitor.start(queue: queue)
    }

    private func handleNetworkStatusChange(_ path: NWPath) {
        DispatchQueue.main.async {
            if path.status == .satisfied {
                if path.usesInterfaceType(.cellular) {
                    // Vérifier force signal 4G/5G
                    self.checkCellularSignalStrength()
                }
            } else {
                // Basculer en mode dégradé, suggérer VHF
                self.activateDegradedMode()
            }
        }
    }
}
```

### Choix Codec Audio : AAC-LC vs Opus pour iOS

#### Avantages AAC-LC sur iOS

**AAC-LC (Advanced Audio Coding - Low Complexity)** est le choix optimal pour les applications PTT iOS :

##### 1. **Accélération Hardware Native**

```swift
// Configuration AAC avec accélération hardware
let encoder = AVAudioConverter(from: inputFormat, to: aacFormat)
encoder?.channelMap = [0] // Mono pour PTT
```

- **Hardware acceleré** sur tous les appareils iOS depuis l'iPhone 5s
- **Consommation batterie réduite** comparé à Opus (software uniquement)
- **Latence minimale** grâce au DSP dédié
- **Intégration native** avec AVAudioEngine et PushToTalk framework

##### 2. **Optimisation PTT Spécifique**

```swift
// Configuration AAC optimisée pour voix PTT
struct PTTAudioConfig {
    static let sampleRate: Double = 22050    // Optimal voix humaine
    static let bitrate: Int = 32000         // 32 kbps - balance qualité/bande passante
    static let channels: Int = 1            // Mono pour PTT
    static let profile: String = "AAC-LC"   // Low Complexity pour temps réel
}
```

##### 3. **Comparaison Technique iOS**

| Critère                    | AAC-LC        | Opus                     |
| -------------------------- | ------------- | ------------------------ |
| **Hardware iOS**           | ✅ Natif      | ❌ Software uniquement   |
| **Latence**                | ~20ms         | ~40-60ms                 |
| **Batterie**               | ✅ Faible     | ❌ Consommation élevée   |
| **Intégration PushToTalk** | ✅ Native     | ⚠️ Conversion nécessaire |
| **Qualité 32kbps**         | ✅ Excellente | ⚠️ Acceptable            |
| **Stabilité réseau**       | ✅ Robuste    | ✅ Très robuste          |

##### 4. **Configuration Optimale Parapente**

```swift
class ParapentePTTAudioManager {
    private let audioFormat = AVAudioFormat(
        settings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 22050,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 32000, // 32 kbps
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
        ]
    )

    func configureForWindyEnvironment() {
        // AAC-LC avec noise gate pour environnement venteux
        let noiseGateThreshold: Float = -45.0 // dB
        let compressionRatio: Float = 4.0     // Compression pour voix PTT
    }
}
```

#### Pourquoi pas Opus sur iOS ?

##### Limitations Techniques

- **Pas d'accélération hardware** iOS
- **CPU intensif** - impact batterie significatif
- **Latence élevée** pour encode/decode software
- **Intégration complexe** avec framework PushToTalk natif
- **Overhead** conversion PCM ↔ Opus ↔ AAC pour système

##### Impact Spécifique Parapente

- **Autonomie batterie critique** en vol long (cross-country)
- **Latence inacceptable** pour communications sécurité
- **Complexité inutile** quand AAC-LC suffit amplement
- **Risque bugs** avec libs tierces dans environnement critique

### Configuration Backend Adaptée AAC

#### Streaming Audio Backend

```typescript
// Cloudflare Worker - Gestion stream AAC
interface AudioStreamConfig {
  codec: "aac-lc";
  bitrate: 32; // kbps
  sampleRate: 22050; // Hz
  channels: 1; // Mono
  bufferSize: 1024; // samples
}

class AudioStreamManager {
  async handleAACStream(audioData: ArrayBuffer, channelId: string) {
    // Relay direct AAC sans recompression
    // Optimisé pour faible latence
    await this.broadcastToChannel(channelId, audioData);
  }

  // Pas de conversion codec - relay transparent
  // Économie CPU worker + latence minimale
}
```

#### Adaptation Qualité Dynamique

```typescript
// Adaptation qualité selon conditions réseau
const audioQualityProfiles = {
  "5g": { bitrate: 48, sampleRate: 24000 }, // Haute qualité
  "4g": { bitrate: 32, sampleRate: 22050 }, // Standard PTT
  "3g": { bitrate: 24, sampleRate: 16000 }, // Dégradé
  poor: { bitrate: 16, sampleRate: 8000 }, // Mode survie
};

function adaptAACQuality(networkType: string, signalStrength: number) {
  const profile =
    audioQualityProfiles[networkType] || audioQualityProfiles["3g"];
  return {
    codec: "aac-lc",
    ...profile,
    channels: 1, // Toujours mono PTT
  };
}
```

### Intégration Bouton Volume Adaptée Vol

```swift
class FlightVolumeButtonHandler {
    private var volumeView: MPVolumeView?
    private var initialVolume: Float = 0.0
    private var isFlightMode: Bool = false

    func setupVolumeButtonDetection() {
        // Configuration spéciale pour utilisation en vol
        // Détection bouton volume haut quand au maximum
        // Désactivation accidentelle avec double-pression
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(volumeChanged),
            name: Notification.Name("AVSystemController_SystemVolumeDidChangeNotification"),
            object: nil
        )
    }

    @objc private func volumeChanged(notification: Notification) {
        guard isFlightMode else { return }

        // Logique anti-déclenchement accidentel
        // Confirmation par feedback haptique
        let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
        impactFeedback.impactOccurred()

        // Déclenchement PTT uniquement si réseau disponible
        if NetworkMonitor.shared.isConnected {
            triggerPTT()
        } else {
            showVHFSuggestion()
        }
    }

    private func triggerPTT() {
        // Déclencher la fonctionnalité PTT
    }

    private func showVHFSuggestion() {
        // Afficher suggestion basculement VHF
    }
}
```

## Gestion d'État Spécialisée Parapente

### États de l'Application

```mermaid
stateDiagram-v2
    [*] --> Lancement
    Lancement --> Authentification: Démarrage App
    Authentification --> Authentifié: Succès
    Authentification --> ConnexionRequise: Pas d'Identifiants
    ConnexionRequise --> Authentification: Connexion Utilisateur
    Authentifié --> SélectionCanal: Canaux Chargés
    SélectionCanal --> Connecté: Canal Rejoint
    Connecté --> Transmission: PTT Pressé
    Transmission --> Connecté: PTT Relâché
    Connecté --> SélectionCanal: Changement Canal
    Connecté --> ModeDégradé: Perte Réseau
    ModeDégradé --> Connecté: Réseau Restauré
    ModeDégradé --> ModeUrgence: Urgence Déclarée
    ModeUrgence --> Connecté: Urgence Résolue
    Connecté --> [*]: App Terminée
```

### Architecture Gestion d'État

```swift
enum ParapenteAppState {
    case lancement
    case authentification
    case connexionRequise
    case authentifié(channels: [ParapenteChannel])
    case connecté(channel: ParapenteChannel, participants: [User])
    case transmission(channel: ParapenteChannel, isTransmitting: Bool)
    case modeDégradé(lastChannel: ParapenteChannel, vhfFrequency: String?)
    case modeUrgence(location: CLLocation, channel: ParapenteChannel)
    case erreur(ParapenteError)
}

class ParapenteStateManager: ObservableObject {
    @Published var currentState: ParapenteAppState = .lancement
    @Published var networkStatus: NetworkStatus = .unknown
    @Published var currentLocation: CLLocation?
    @Published var nearbyFlyingSites: [FlyingSite] = []

    func transition(to newState: ParapenteAppState) {
        // Validation des transitions d'état avec logique métier parapente
        guard isValidTransition(from: currentState, to: newState) else {
            Logger.warning("Transition d'état invalide tentée")
            return
        }

        currentState = newState
        handleStateTransition(newState)
    }

    private func handleStateTransition(_ state: ParapenteAppState) {
        switch state {
        case .modeDégradé(let lastChannel, let vhfFrequency):
            showVHFBackupSuggestion(vhfFrequency)
        case .modeUrgence(let location, _):
            activateEmergencyProtocol(at: location)
        default:
            break
        }
    }
}
```

## Considérations Spécialisées Parapente

### Intégration avec Équipement VHF/UHF

#### Complémentarité Radio Traditionnelle

```swift
struct VHFIntegration {
    let backupFrequencies = [
        "144.150": "Fréquence locale Chamonix",
        "143.9875": "Fréquence cross-country",
        "161.300": "Urgence montagne"
    ]

    func suggestVHFFrequency(for location: CLLocation) -> String? {
        // Logique de suggestion basée sur la localisation
        return NearestSiteService.getVHFFrequency(for: location)
    }
}
```

#### Protocole de Basculement d'Urgence

- **Perte réseau cellulaire** : Notification automatique avec fréquence VHF recommandée
- **Urgence déclarée** : Basculement immédiat vers canal prioritaire 4G + notification VHF
- **Communication hybride** : Relais d'informations entre utilisateurs 4G et VHF

### Gestion Géo-Localisation Sites de Vol

#### Base de Données Sites

```swift
struct FlyingSite {
    let id: UUID
    let name: String
    let coordinates: CLLocationCoordinate2D
    let elevation: Double
    let radius: Double // Zone d'influence en km
    let vhfFrequency: String?
    let windDirection: WindDirection?
    let difficulty: FlightDifficulty
    let restrictions: [SiteRestriction]
}

class SiteManager {
    private let sites: [FlyingSite] = loadLocalSites()

    func nearestSite(to location: CLLocation) -> FlyingSite? {
        return sites.min(by: {
            location.distance(from: CLLocation(latitude: $0.coordinates.latitude,
                                             longitude: $0.coordinates.longitude)) <
            location.distance(from: CLLocation(latitude: $1.coordinates.latitude,
                                             longitude: $1.coordinates.longitude))
        })
    }
}
```

#### Canaux Automatiques par Zone

- **Détection automatique** : Rejoindre canal du site de vol détecté
- **Canaux régionaux** : Channels par massif montagneux (Alpes, Pyrénées, etc.)
- **Cross-country** : Canal spécialisé pour vols de distance

### Optimisations Environnement Vol

#### Gestion Conditions Météo

```swift
class WeatherIntegration {
    func checkFlyingConditions() async -> FlightConditions {
        // Intégration avec services météo
        // Alertes vent fort, orage, etc.
        return FlightConditions()
    }

    func suggestCommunicationMode(weather: WeatherConditions) -> CommunicationMode {
        switch weather.windSpeed {
        case 0..<15: return .hybridMode // 4G + VHF
        case 15..<25: return .vhfPrimary // VHF privilégié
        default: return .emergency // Conditions dangereuses
        }
    }
}

// Types de support
struct FlightConditions {
    let isFlightSafe: Bool
    let windSpeed: Double
    let visibility: Double
    let weatherWarnings: [WeatherWarning]
}

struct WeatherConditions {
    let windSpeed: Double
    let temperature: Double
    let humidity: Double
    let pressure: Double
}

enum CommunicationMode {
    case hybridMode
    case vhfPrimary
    case emergency
}

enum WeatherWarning {
    case strongWind
    case thunderstorm
    case lowVisibility
    case temperatureExtreme
}
```

#### Interface Adaptée Vol

- **Boutons plus grands** : Utilisation avec gants
- **Contraste élevé** : Lisibilité en plein soleil
- **Feedback haptique renforcé** : Confirmation tactile des actions
- **Mode une main** : Interface optimisée pour utilisation en vol

### Fonctionnalités Sécurité Avancées

#### Système d'Urgence Intégré

```swift
class EmergencySystem {
    func declareEmergency(location: CLLocation, type: EmergencyType) {
        // Notification immédiate tous canaux
        // Géolocalisation précise
        // Alerte services de secours si configuré
        // Basculement canal urgence prioritaire
    }

    func trackFlightPath() {
        // Enregistrement trace GPS pour SAR (Search and Rescue)
        // Points de passage automatiques
        // Détection atterrissage d'urgence
    }
}

// Types de support
enum EmergencyType {
    case medicalEmergency
    case equipmentFailure
    case weatherEmergency
    case navigationLost
    case landingEmergency
}
```

#### Mode Vol Automatique

- **Détection décollage** : Activation automatique via accéléromètre
- **Canal site automatique** : Sélection basée GPS
- **Économie batterie** : Optimisations pour vols longs
- **Mode avion adapté** : Maintien GPS + désactivation cellulaire sélective

## Considérations de Sécurité

### Protection des Données

- Stockage trousseau pour identifiants sensibles
- Certificate pinning pour connexions HTTPS
- Validation d'entrée pour toutes données utilisateur
- Protocoles de transmission sécurisés
- **Chiffrement géolocalisation utilisateurs**
- **Anonymisation données de vol**

### Conformité Vie Privée

- Demandes permission microphone avec explications claires
- Transparence utilisation des données
- Approche collecte minimale de données
- Consentement utilisateur pour traitement arrière-plan
- **Consentement géolocalisation explicite**
- **Option désactivation tracking GPS**

### Bonnes Pratiques Parapente

- Pas de journalisation des identifiants
- Communications réseau chiffrées
- Stockage sécurisé des identifiants
- Audits de sécurité réguliers
- **Chiffrement traces de vol**
- **Isolation données urgence/normales**
- **Validation groupes fermés authentifiés**

## Optimisation des Performances

### Gestion Mémoire

- Gestion appropriée du cycle de vie des objets
- Optimisation des buffers audio
- Mise en cache des requêtes réseau
- Optimisation des ressources images
- **Optimisation cartes et données géographiques**
- **Cache sites de vol locaux**

### Efficacité Batterie

- Limitations traitement arrière-plan
- Gestion efficace session audio
- Regroupement requêtes réseau
- Surveillance utilisation CPU
- **Optimisation GPS intermittent**
- **Mode économie d'énergie en vol**

### Optimisation Réseau Parapente

- Pooling de connexions
- Gestion timeout des requêtes
- Planification capacité hors-ligne
- Stratégies de retry d'erreur
- **Adaptation qualité audio selon signal**
- **Compression adaptative selon altitude**
- **Priorité trafic urgence**

## Stratégie de Test Spécialisée

### Tests Unitaires

- Tests couche réseau avec services mock
- Tests gestionnaire trousseau
- Validation gestion d'état
- Tests fonctions utilitaires
- **Tests calculs géographiques et distances**
- **Tests intégration données météo**
- **Validation algorithmes auto-sélection canal**

### Tests d'Intégration Parapente

- Intégration framework PushToTalk
- Intégration API backend
- Intégration système audio
- Intégration bouton matériel
- **Tests GPS et géolocalisation sites**
- **Intégration services météo**
- **Tests basculement mode dégradé**

### Tests Interface Utilisateur

- Automatisation flux utilisateur
- Conformité accessibilité
- **Tests utilisabilité avec gants**
- **Validation contraste plein soleil**
- **Tests ergonomie vol une main**

### Tests Terrain Parapente

- **Tests conditions réelles de vol**
- **Validation couverture réseau sites**
- **Tests intégration équipement VHF**
- **Validation ergonomie cockpit parapente**
- **Tests longue durée (cross-country)**
- **Simulation conditions météo dégradées**

### Tests Performance Environnement

- **Tests altitude élevée (jusqu'à 4000m)**
- **Validation par températures extrêmes (-10°C à +40°C)**
- **Tests résistance vibrations et turbulences**
- **Validation étanchéité (projection d'eau)**

## Considérations de Déploiement

### Exigences App Store

- Demande d'habilitation PushToTalk
- Mises à jour politique de confidentialité
- Description app en plusieurs langues
- Localisation des captures d'écran
- **Documentation intégration VHF comme complément**
- **Clarification usage groupes fermés**

### Tests Bêta Parapente

- Distribution TestFlight
- **Focus tests pilotes expérimentés**
- **Tests dans différents massifs montagneux**
- Surveillance des performances
- Collecte retours utilisateurs
- **Tests croisés avec équipement radio existant**

### Surveillance Production

- Intégration rapport de crash
- Suivi métriques de performance
- Analytiques comportement utilisateur
- Surveillance service backend
- **Monitoring couverture réseau par site**
- **Alertes qualité audio dégradée**
- **Statistiques usage hybride 4G/VHF**

## Estimation Calendrier de Développement

### Phase 1 : Fondations (3-4 semaines)

- Configuration et setup du projet
- Implémentation UI de base
- Flux d'authentification
- Intégration trousseau
- **Intégration CoreLocation et géolocalisation**
- **Base de données sites de vol**

### Phase 2 : Fonctionnalités Cœur (4-5 semaines)

- Intégration PushToTalk
- Gestion des canaux
- Communication backend
- Configuration session audio
- **Logique sélection automatique canaux**
- **Système de surveillance réseau**

### Phase 3 : Spécialisations Parapente (3-4 semaines)

- Intégration bouton volume
- **Mode dégradé et basculement VHF**
- **Système d'urgence**
- **Optimisations interface vol**
- Gestion des erreurs avancée

### Phase 4 : Finition & Intégration (3-4 semaines)

- Implémentation localisation
- Raffinements UI
- **Tests terrain avec pilotes**
- **Documentation utilisation hybride**

### Phase 5 : Tests & Déploiement (3-4 semaines)

- Tests complets
- **Coordination tests bêta terrain**
- Soumission App Store
- Configuration surveillance production
- **Formation utilisateurs VHF/4G hybride**

## Évaluation des Risques

### Risques Techniques

- **Changements Framework PushToTalk** : Apple peut modifier le comportement du framework
- **Fiabilité Réseau** : Préoccupations disponibilité service backend et couverture 4G/5G
- **Compatibilité Matériel** : Variations comportement bouton volume
- **Compatibilité Versions iOS** : Impact futures mises à jour iOS
- **Couverture Réseau Sites de Vol** : Zones blanches 4G en montagne
- **Interférences GPS** : Précision localisation en conditions météo difficiles

### Stratégies d'Atténuation

- Surveillance régulière documentation framework
- Implémentation robuste gestion d'erreurs
- Contrôles UI de secours pour intégration matériel
- Matrice de tests complète des appareils
- **Système de fallback VHF documenté**
- **Base de données offline sites de vol**
- **Mode dégradé avec notifications claires**
- **Intégration optionnelle balises GPS externes**

### Risques Opérationnels Parapente

- **Dépendance excessive 4G** : Abandon complet radio VHF
- **Fausse sécurité** : Surestimation fiabilité réseau cellulaire
- **Formation utilisateurs** : Mauvaise compréhension usage hybride
- **Coordination groupes** : Fragmentation entre utilisateurs 4G/VHF

### Mesures Préventives

- **Formation obligatoire usage hybride**
- **Documentation claire limitations 4G**
- **Promotion de la complémentarité VHF/4G**
- **Tests réguliers procédures d'urgence**

## Annexe Technique - Exemples de Code pour Développeurs C/TypeScript

_Cette section fournit des exemples de code en anglais adaptés aux développeurs familiers avec le C système et TypeScript/React/TailwindCSS._

### Core Architecture Patterns - iOS vs Web/System Comparison

#### 1. State Management - iOS SwiftUI vs React TypeScript

**iOS Swift (Current Implementation)**

```swift
// iOS State Manager with Combine
class ParapenteStateManager: ObservableObject {
    @Published var currentState: ParapenteAppState = .launching
    @Published var networkStatus: NetworkStatus = .unknown
    @Published var currentLocation: CLLocation?

    func transition(to newState: ParapenteAppState) {
        guard isValidTransition(from: currentState, to: newState) else {
            Logger.warning("Invalid state transition attempted")
            return
        }
        currentState = newState
        handleStateTransition(newState)
    }
}
```

**TypeScript React Equivalent (for Web Developers)**

```typescript
// React TypeScript State Manager with Context
interface ParapenteState {
  currentState: ParapenteAppState;
  networkStatus: NetworkStatus;
  currentLocation: GeolocationPosition | null;
}

type ParapenteAppState =
  | "launching"
  | "authenticating"
  | "authenticated"
  | "connected"
  | "transmitting"
  | "degradedMode"
  | "emergency";

const ParapenteContext = createContext<{
  state: ParapenteState;
  dispatch: (action: ParapenteAction) => void;
} | null>(null);

function parapenteReducer(
  state: ParapenteState,
  action: ParapenteAction
): ParapenteState {
  switch (action.type) {
    case "TRANSITION_STATE":
      if (!isValidTransition(state.currentState, action.payload)) {
        console.warn("Invalid state transition attempted");
        return state;
      }
      return { ...state, currentState: action.payload };
    case "UPDATE_NETWORK_STATUS":
      return { ...state, networkStatus: action.payload };
    default:
      return state;
  }
}
```

#### 2. Network Layer - iOS URLSession vs Fetch API

**iOS Swift Network Service**

```swift
// iOS Network Service with async/await
class ParapenteNetworkService: ParapenteNetworkServiceProtocol {
    private let session = URLSession.shared
    private let baseURL = "https://ptt.highcanfly.club"

    func authenticate(username: String, password: String, location: CLLocation?) async throws -> ParapenteAuthResponse {
        var components = URLComponents(string: "\(baseURL)/auth")!
        components.queryItems = [
            URLQueryItem(name: "user", value: username),
            URLQueryItem(name: "pass", value: password)
        ]

        if let location = location {
            components.queryItems?.append(URLQueryItem(name: "location", value: "\(location.coordinate.latitude),\(location.coordinate.longitude)"))
        }

        let (data, response) = try await session.data(from: components.url!)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw NetworkError.authenticationFailed
        }

        return try JSONDecoder().decode(ParapenteAuthResponse.self, from: data)
    }
}
```

**TypeScript Fetch Equivalent**

```typescript
// TypeScript Network Service with fetch
interface ParapenteNetworkService {
  authenticate(
    username: string,
    password: string,
    location?: GeolocationCoordinates
  ): Promise<ParapenteAuthResponse>;
}

class ParapenteNetworkServiceImpl implements ParapenteNetworkService {
  private readonly baseURL = "https://ptt.highcanfly.club";

  async authenticate(
    username: string,
    password: string,
    location?: GeolocationCoordinates
  ): Promise<ParapenteAuthResponse> {
    const params = new URLSearchParams({
      user: username,
      pass: password,
    });

    if (location) {
      params.append("location", `${location.latitude},${location.longitude}`);
    }

    const response = await fetch(`${this.baseURL}/auth?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ParapentePTT-Web/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    return response.json() as Promise<ParapenteAuthResponse>;
  }
}
```

#### 3. Audio Management - AVAudioSession vs Web Audio API

**iOS Swift Audio Configuration**

```swift
// iOS Audio Session Configuration for PTT
private func configureAudioSessionForFlight() {
    let audioSession = AVAudioSession.sharedInstance()
    try? audioSession.setCategory(.playAndRecord,
                                mode: .voiceChat,
                                options: [.allowBluetooth,
                                         .defaultToSpeaker,
                                         .allowBluetoothA2DP])

    // Optimized for windy environment (paragliding)
    try? audioSession.setPreferredInputGain(0.8)
    try? audioSession.setPreferredSampleRate(22050) // Quality/bandwidth balance
}

func startTransmission() {
    guard let channelManager = PTChannelManager.shared else { return }
    channelManager.requestTransmission { result in
        switch result {
        case .success:
            self.isTransmitting = true
        case .failure(let error):
            print("Transmission failed: \(error)")
        }
    }
}
```

**Web Audio API Equivalent (TypeScript)**

```typescript
// Web Audio API for PTT functionality
class WebPTTAudioManager {
  private audioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private isTransmitting = false;

  constructor() {
    this.audioContext = new AudioContext();
  }

  async configureAudioForFlight(): Promise<void> {
    try {
      // Request microphone with optimized constraints for outdoor use
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true, // Important for wind noise
          autoGainControl: true,
          sampleRate: 22050, // Balance quality/bandwidth like iOS
          channelCount: 1, // Mono for PTT
        },
      });

      // Configure audio processing for windy environment
      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.8; // Equivalent to iOS setPreferredInputGain

      source.connect(gainNode);
    } catch (error) {
      console.error("Audio configuration failed:", error);
      throw new Error("Microphone access required for PTT functionality");
    }
  }

  async startTransmission(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error("Audio not configured");
    }

    try {
      // WebRTC or WebSocket implementation for real-time audio
      this.isTransmitting = true;
      console.log("Transmission started");

      // Implementation would connect to backend PTT service
      // using WebRTC or WebSocket for real-time audio streaming
    } catch (error) {
      this.isTransmitting = false;
      throw error;
    }
  }

  stopTransmission(): void {
    this.isTransmitting = false;
    console.log("Transmission stopped");
  }
}
```

#### 4. UI Components - SwiftUI vs React with TailwindCSS

**iOS SwiftUI PTT Button**

```swift
// SwiftUI PTT Button optimized for flight use
struct PTTButton: View {
    @Binding var isTransmitting: Bool
    @Binding var isNetworkAvailable: Bool
    let onPTTPressed: () -> Void
    let onPTTReleased: () -> Void

    var body: some View {
        Button(action: {}) {
            ZStack {
                Circle()
                    .fill(buttonColor)
                    .frame(width: 140, height: 140) // Large for glove use
                    .scaleEffect(isTransmitting ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 0.2), value: isTransmitting)

                Text(isTransmitting ? "TALKING" : "TALK")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
            }
        }
        .onLongPressGesture(
            minimumDuration: 0,
            maximumDistance: .infinity,
            pressing: { pressing in
                if pressing {
                    onPTTPressed()
                } else {
                    onPTTReleased()
                }
            },
            perform: {}
        )
        .disabled(!isNetworkAvailable)
    }

    private var buttonColor: Color {
        if !isNetworkAvailable {
            return .gray
        }
        return isTransmitting ? .red : .green
    }
}
```

**React TypeScript Component with TailwindCSS**

```typescript
// React PTT Button Component with TailwindCSS
interface PTTButtonProps {
  isTransmitting: boolean;
  isNetworkAvailable: boolean;
  onPTTPressed: () => void;
  onPTTReleased: () => void;
}

const PTTButton: React.FC<PTTButtonProps> = ({
  isTransmitting,
  isNetworkAvailable,
  onPTTPressed,
  onPTTReleased,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = useCallback(() => {
    if (!isNetworkAvailable) return;
    setIsPressed(true);
    onPTTPressed();
  }, [isNetworkAvailable, onPTTPressed]);

  const handleMouseUp = useCallback(() => {
    if (!isNetworkAvailable) return;
    setIsPressed(false);
    onPTTReleased();
  }, [isNetworkAvailable, onPTTReleased]);

  // Touch events for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      handleMouseDown();
    },
    [handleMouseDown]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      handleMouseUp();
    },
    [handleMouseUp]
  );

  return (
    <button
      className={cn(
        // Base styles - large button for glove use (equivalent to 140x140 points)
        "w-36 h-36 rounded-full font-bold text-white text-lg",
        "transition-all duration-200 ease-in-out",
        "focus:outline-none focus:ring-4 focus:ring-opacity-50",

        // State-based styling
        {
          // Network available states
          "bg-green-500 hover:bg-green-600 focus:ring-green-300":
            isNetworkAvailable && !isTransmitting,
          "bg-red-500 scale-110 focus:ring-red-300":
            isNetworkAvailable && isTransmitting,

          // Network unavailable state
          "bg-gray-400 cursor-not-allowed": !isNetworkAvailable,

          // Pressed state animation
          "scale-105": isPressed,
        }
      )}
      disabled={!isNetworkAvailable}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Release if mouse leaves button
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      // Prevent context menu on long press
      onContextMenu={(e) => e.preventDefault()}
    >
      {isTransmitting ? "TALKING" : "TALK"}
    </button>
  );
};

// Utility function for conditional classes (similar to clsx)
function cn(
  ...classes: (string | Record<string, boolean> | undefined)[]
): string {
  return classes
    .filter(Boolean)
    .map((cls) => {
      if (typeof cls === "string") return cls;
      if (typeof cls === "object") {
        return Object.entries(cls)
          .filter(([, condition]) => condition)
          .map(([className]) => className)
          .join(" ");
      }
      return "";
    })
    .join(" ")
    .trim();
}
```

#### 5. Memory Management - iOS ARC vs TypeScript/C Patterns

**iOS Swift Memory Management**

```swift
// iOS automatic reference counting with weak references
class PTTConnectionManager {
    weak var delegate: PTTConnectionDelegate?
    private var networkMonitor: NWPathMonitor?
    private var locationManager: CLLocationManager?

    deinit {
        // Cleanup resources automatically handled by ARC
        networkMonitor?.cancel()
        locationManager?.stopUpdatingLocation()
    }

    func setupNetworkMonitoring() {
        networkMonitor = NWPathMonitor()
        networkMonitor?.pathUpdateHandler = { [weak self] path in
            // Weak reference prevents retain cycles
            self?.handleNetworkChange(path)
        }
    }
}
```

**C-Style Manual Memory Management Equivalent**

```c
// C System Programming - Manual Resource Management
typedef struct {
    network_monitor_t* network_monitor;
    location_manager_t* location_manager;
    ptt_delegate_t* delegate; // Non-owning pointer
    atomic_int ref_count;
} ptt_connection_manager_t;

// Constructor with reference counting
ptt_connection_manager_t* ptt_connection_manager_create(void) {
    ptt_connection_manager_t* manager = malloc(sizeof(ptt_connection_manager_t));
    if (!manager) return NULL;

    manager->network_monitor = NULL;
    manager->location_manager = NULL;
    manager->delegate = NULL;
    atomic_init(&manager->ref_count, 1);

    return manager;
}

// Reference counting for memory safety
void ptt_connection_manager_retain(ptt_connection_manager_t* manager) {
    if (manager) {
        atomic_fetch_add(&manager->ref_count, 1);
    }
}

void ptt_connection_manager_release(ptt_connection_manager_t* manager) {
    if (!manager) return;

    if (atomic_fetch_sub(&manager->ref_count, 1) == 1) {
        // Last reference - cleanup resources
        if (manager->network_monitor) {
            network_monitor_cancel(manager->network_monitor);
            network_monitor_destroy(manager->network_monitor);
        }

        if (manager->location_manager) {
            location_manager_stop(manager->location_manager);
            location_manager_destroy(manager->location_manager);
        }

        free(manager);
    }
}
```

**TypeScript Resource Management with Custom Hooks**

```typescript
// TypeScript React - Custom hooks for resource management
interface PTTConnectionManager {
  networkStatus: NetworkStatus;
  location: GeolocationPosition | null;
  cleanup: () => void;
}

// Custom hook managing PTT connection lifecycle
function usePTTConnection(): PTTConnectionManager {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("unknown");
  const [location, setLocation] = useState<GeolocationPosition | null>(null);

  useEffect(() => {
    // Setup network monitoring
    const networkMonitor = new NetworkStatusMonitor();
    const locationWatcher = navigator.geolocation.watchPosition(
      setLocation,
      (error) => console.error("Location error:", error),
      { enableHighAccuracy: true, timeout: 5000 }
    );

    networkMonitor.onStatusChange = setNetworkStatus;
    networkMonitor.start();

    // Cleanup function (equivalent to iOS deinit)
    return () => {
      networkMonitor.stop();
      navigator.geolocation.clearWatch(locationWatcher);
    };
  }, []);

  const cleanup = useCallback(() => {
    // Manual cleanup if needed
    setNetworkStatus("unknown");
    setLocation(null);
  }, []);

  return { networkStatus, location, cleanup };
}

// Usage in component
const PTTApp: React.FC = () => {
  const { networkStatus, location } = usePTTConnection();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* App content */}
    </div>
  );
};
```

### Performance Considerations for Cross-Platform Understanding

#### Memory Usage Patterns

- **iOS**: ARC handles most memory management automatically, similar to garbage collection but deterministic
- **C**: Manual malloc/free with reference counting for shared resources
- **TypeScript/React**: Garbage collected, but need to manage event listeners and subscriptions

#### Real-time Audio Constraints

- **iOS**: Uses system-level PushToTalk framework with optimized audio pipeline
- **Web**: Limited to WebRTC or WebSocket streaming with higher latency
- **C**: Direct access to audio drivers, lowest latency possible

#### Battery Optimization Strategies

- **iOS**: Background app refresh limitations, CoreLocation optimization
- **Web**: Page visibility API, worker threads for background processing
- **C**: Direct power management APIs, custom scheduling

Cette section permet aux développeurs C et TypeScript de comprendre les concepts iOS en les reliant à leurs domaines d'expertise familiers.

### Points Clés de Réussite

Le succès dépend d'une attention particulière à :

- **Gestion session audio optimisée** pour environnement bruyant (vent)
- **Synchronisation d'état robuste** avec gestion mode dégradé
- **Conception UX adaptée vol** (gants, une main, plein soleil)
- **Intégration géolocalisation intelligente** pour sélection automatique canaux
- **Formation utilisateurs** sur l'usage complémentaire VHF/4G

### Architecture Modulaire Évolutive

L'architecture modulaire proposée permet :

- Développement itératif avec validation terrain continue
- Extension future des fonctionnalités (météo, traces GPS, etc.)
- Maintien qualité code et standards de performance
- Intégration progressive avec écosystème parapente existant

### Valeur Ajoutée Spécialisée

L'application apporte une **réelle valeur ajoutée** au monde du parapente :

- **Extension portée communication** au-delà des limitations VHF/UHF
- **Qualité audio numérique** supérieure aux radios analogiques
- **Géolocalisation intégrée** pour coordination groupes dispersés
- **Système d'urgence évolué** avec localisation précise
- **Communication inter-sites** pour cross-country et compétitions

### Vision Hybride Innovante

Cette approche **hybride VHF/4G** est innovante car elle :

- Reconnaît les forces et faiblesses de chaque technologie
- Propose une solution pragmatique pour parapentistes
- Maintient la sécurité par redondance des systèmes
- Prépare l'évolution vers communications numériques tout en conservant la robustesse analogique

La combinaison des fonctionnalités modernes de Swift, du framework PushToTalk d'Apple, et d'une conception UI réfléchie délivrera une expérience de talkie-walkie professionnelle qui répond aux attentes des développeurs pour un code propre et aux attentes des parapentistes pour une fonctionnalité fiable et adaptée à leur environnement exigeant.

---

## Architecture Backend - Cloudflare Workers avec Durable Objects

### Vue d'Ensemble Backend

L'architecture backend utilise **Cloudflare Workers** (plan gratuit) avec **Durable Objects** pour créer une solution scalable et économique. Chaque canal PTT est géré par un objet durable distinct contenant sa propre base de données SQLite, permettant un état partagé en temps réel entre les utilisateurs.

```mermaid
graph TB
    A[Client iOS] --> B[Cloudflare Edge]
    B --> C[Worker Principal]
    C --> D{Routing}
    D -->|Auth| E[Auth Handler]
    D -->|Canal| F[Channel Router]
    D -->|WebSocket| G[WebSocket Handler]

    F --> H[Durable Object<br/>Canal A]
    F --> I[Durable Object<br/>Canal B]
    F --> J[Durable Object<br/>Canal N]

    H --> K[SQLite DB<br/>Canal A]
    I --> L[SQLite DB<br/>Canal B]
    J --> M[SQLite DB<br/>Canal N]

    N[KV Store] --> C
    O[R2 Storage] --> C

    P[External APIs<br/>Météo/GPS] --> C
```

### Configuration Cloudflare Workers

#### wrangler.toml

```toml
name = "ptt-parapente-backend"
main = "src/index.ts"
compatibility_date = "2024-08-01"
node_compat = true

# Variables d'environnement
[env.production.vars]
ENVIRONMENT = "production"
JWT_SECRET = "your-jwt-secret"
MAX_CHANNELS_PER_USER = "10"
MAX_PARTICIPANTS_PER_CHANNEL = "50"
WEATHER_API_KEY = "your-weather-api-key"

# Durable Objects
[[durable_objects.bindings]]
name = "CHANNEL_OBJECTS"
class_name = "ChannelObject"

[[durable_objects.bindings]]
name = "USER_SESSION_OBJECTS"
class_name = "UserSessionObject"

# KV Storage pour cache
[[kv_namespaces]]
binding = "PTT_KV"
id = "your-kv-namespace-id"

# R2 pour stockage audio (optionnel)
[[r2_buckets]]
binding = "PTT_AUDIO_STORAGE"
bucket_name = "ptt-audio-recordings"

# Limites plan gratuit
[limits]
cpu_ms = 10000
memory_mb = 128
```

### Implémentation Durable Object - Canal PTT

#### src/durable-objects/ChannelObject.ts

```typescript
interface ChannelState {
  id: string;
  name: string;
  type: "site_local" | "emergency" | "general";
  coordinates?: { lat: number; lon: number };
  participants: Map<string, ParticipantInfo>;
  currentTransmitter: string | null;
  transmissionStartTime: number | null;
  maxParticipants: number;
  isActive: boolean;
  vhfFrequency?: string;
}

interface ParticipantInfo {
  userId: string;
  username: string;
  joinTime: number;
  lastSeen: number;
  location?: { lat: number; lon: number };
  connectionQuality: "poor" | "fair" | "good" | "excellent";
  isTransmitting: boolean;
}

export class ChannelObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private channelState: ChannelState;
  private db: D1Database;
  private websocketConnections: Map<string, WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.websocketConnections = new Map();

    // Initialisation état canal depuis storage persistant
    this.initializeChannelState();

    // Initialisation base SQLite embarquée
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    // Utilisation D1 (SQLite) pour chaque canal
    this.db = this.env.DB;

    // Création schéma si nécessaire
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS channel_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        message_type TEXT NOT NULL, -- 'audio_start', 'audio_end', 'text', 'emergency'
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        location_lat REAL,
        location_lon REAL
      );

      CREATE TABLE IF NOT EXISTS channel_participants (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        location_lat REAL,
        location_lon REAL,
        connection_quality TEXT DEFAULT 'unknown'
      );

      CREATE TABLE IF NOT EXISTS transmission_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration_seconds INTEGER,
        quality_score REAL -- 0.0 à 1.0
      );

      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON channel_messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_participants_last_seen ON channel_participants(last_seen);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case "/join":
          return this.handleJoinChannel(request);
        case "/leave":
          return this.handleLeaveChannel(request);
        case "/ptt-start":
          return this.handleStartTransmission(request);
        case "/ptt-end":
          return this.handleEndTransmission(request);
        case "/websocket":
          return this.handleWebSocketUpgrade(request);
        case "/participants":
          return this.handleGetParticipants(request);
        case "/history":
          return this.handleGetHistory(request);
        default:
          return new Response("Not Found", { status: 404 });
      }
    } catch (error) {
      console.error("ChannelObject error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  private async handleJoinChannel(request: Request): Promise<Response> {
    const { userId, username, location } = await request.json();

    // Vérification limite participants
    if (
      this.channelState.participants.size >= this.channelState.maxParticipants
    ) {
      return new Response(
        JSON.stringify({
          error: "Channel full",
          maxParticipants: this.channelState.maxParticipants,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Ajout participant
    const participant: ParticipantInfo = {
      userId,
      username,
      joinTime: Date.now(),
      lastSeen: Date.now(),
      location,
      connectionQuality: "good", // À évaluer dynamiquement
      isTransmitting: false,
    };

    this.channelState.participants.set(userId, participant);

    // Persistance en base
    await this.db
      .prepare(
        `
      INSERT OR REPLACE INTO channel_participants 
      (user_id, username, join_time, last_seen, location_lat, location_lon)
      VALUES (?, ?, datetime('now'), datetime('now'), ?, ?)
    `
      )
      .bind(userId, username, location?.lat || null, location?.lon || null)
      .run();

    // Log événement
    await this.logChannelEvent(userId, username, "user_joined", { location });

    // Notification autres participants
    this.broadcastToParticipants({
      type: "participant_joined",
      participant,
      totalParticipants: this.channelState.participants.size,
    });

    // Sauvegarde état persistant
    await this.persistChannelState();

    return new Response(
      JSON.stringify({
        success: true,
        channelId: this.channelState.id,
        participantCount: this.channelState.participants.size,
        vhfBackupFrequency: this.channelState.vhfFrequency,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  private async handleStartTransmission(request: Request): Promise<Response> {
    const { userId, location, quality } = await request.json();

    const participant = this.channelState.participants.get(userId);
    if (!participant) {
      return new Response("Participant not found", { status: 404 });
    }

    // Vérification pas de transmission en cours
    if (
      this.channelState.currentTransmitter &&
      this.channelState.currentTransmitter !== userId
    ) {
      return new Response(
        JSON.stringify({
          error: "Channel busy",
          currentTransmitter: this.channelState.participants.get(
            this.channelState.currentTransmitter
          )?.username,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Début transmission
    this.channelState.currentTransmitter = userId;
    this.channelState.transmissionStartTime = Date.now();
    participant.isTransmitting = true;
    participant.lastSeen = Date.now();
    if (location) participant.location = location;

    // Log début transmission
    await this.db
      .prepare(
        `
      INSERT INTO transmission_history 
      (user_id, start_time) 
      VALUES (?, datetime('now'))
    `
      )
      .bind(userId)
      .run();

    // Log événement
    await this.logChannelEvent(userId, participant.username, "audio_start", {
      location,
      quality,
    });

    // Notification participants
    this.broadcastToParticipants({
      type: "transmission_started",
      transmitter: {
        userId,
        username: participant.username,
        location: participant.location,
      },
    });

    await this.persistChannelState();

    return new Response(
      JSON.stringify({
        success: true,
        transmissionId: `${userId}_${Date.now()}`,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  private async handleEndTransmission(request: Request): Promise<Response> {
    const { userId, quality } = await request.json();

    const participant = this.channelState.participants.get(userId);
    if (!participant) {
      return new Response("Participant not found", { status: 404 });
    }

    if (this.channelState.currentTransmitter !== userId) {
      return new Response("Not currently transmitting", { status: 400 });
    }

    // Calcul durée transmission
    const duration = this.channelState.transmissionStartTime
      ? Date.now() - this.channelState.transmissionStartTime
      : 0;

    // Fin transmission
    this.channelState.currentTransmitter = null;
    this.channelState.transmissionStartTime = null;
    participant.isTransmitting = false;
    participant.lastSeen = Date.now();

    // Mise à jour historique transmission
    await this.db
      .prepare(
        `
      UPDATE transmission_history 
      SET end_time = datetime('now'), 
          duration_seconds = ?,
          quality_score = ?
      WHERE user_id = ? 
        AND end_time IS NULL 
      ORDER BY start_time DESC 
      LIMIT 1
    `
      )
      .bind(Math.round(duration / 1000), quality || 0.8, userId)
      .run();

    // Log événement
    await this.logChannelEvent(userId, participant.username, "audio_end", {
      duration: Math.round(duration / 1000),
      quality,
    });

    // Notification participants
    this.broadcastToParticipants({
      type: "transmission_ended",
      transmitter: {
        userId,
        username: participant.username,
      },
      duration: Math.round(duration / 1000),
    });

    await this.persistChannelState();

    return new Response(
      JSON.stringify({
        success: true,
        duration: Math.round(duration / 1000),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId || !this.channelState.participants.has(userId)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Configuration WebSocket pour temps réel
    server.accept();
    this.websocketConnections.set(userId, server);

    server.addEventListener("message", (event) => {
      this.handleWebSocketMessage(userId, event.data);
    });

    server.addEventListener("close", () => {
      this.websocketConnections.delete(userId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleWebSocketMessage(userId: string, message: any) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case "heartbeat":
          this.handleHeartbeat(userId);
          break;
        case "location_update":
          this.handleLocationUpdate(userId, data.location);
          break;
        case "quality_report":
          this.handleQualityReport(userId, data.quality);
          break;
        case "emergency":
          this.handleEmergency(userId, data);
          break;
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
    }
  }

  private async handleHeartbeat(userId: string) {
    const participant = this.channelState.participants.get(userId);
    if (participant) {
      participant.lastSeen = Date.now();

      // Mise à jour base
      await this.db
        .prepare(
          `
        UPDATE channel_participants 
        SET last_seen = datetime('now') 
        WHERE user_id = ?
      `
        )
        .bind(userId)
        .run();
    }
  }

  private broadcastToParticipants(message: any) {
    const messageStr = JSON.stringify(message);

    for (const [userId, ws] of this.websocketConnections) {
      try {
        if (ws.readyState === WebSocket.READY_STATE_OPEN) {
          ws.send(messageStr);
        }
      } catch (error) {
        console.error(`Failed to send to ${userId}:`, error);
        this.websocketConnections.delete(userId);
      }
    }
  }

  private async logChannelEvent(
    userId: string,
    username: string,
    type: string,
    metadata: any = {}
  ) {
    await this.db
      .prepare(
        `
      INSERT INTO channel_messages 
      (user_id, username, message_type, content, location_lat, location_lon)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
        userId,
        username,
        type,
        JSON.stringify(metadata),
        metadata.location?.lat || null,
        metadata.location?.lon || null
      )
      .run();
  }

  private async persistChannelState() {
    // Sauvegarde état en Durable Object storage
    await this.state.storage.put("channelState", this.channelState);
  }

  // Nettoyage périodique participants inactifs
  private async cleanupInactiveParticipants() {
    const now = Date.now();
    const timeoutMs = 5 * 60 * 1000; // 5 minutes

    for (const [userId, participant] of this.channelState.participants) {
      if (now - participant.lastSeen > timeoutMs) {
        this.channelState.participants.delete(userId);
        this.websocketConnections.delete(userId);

        // Notification déconnexion
        this.broadcastToParticipants({
          type: "participant_left",
          userId,
          username: participant.username,
          reason: "timeout",
        });

        // Log événement
        await this.logChannelEvent(userId, participant.username, "user_left", {
          reason: "timeout",
        });
      }
    }

    await this.persistChannelState();
  }
}
```

### Worker Principal

#### src/index.ts

```typescript
import { ChannelObject } from "./durable-objects/ChannelObject";
import { handleAuth } from "./handlers/auth";
import { handleChannels } from "./handlers/channels";
import { validateRequest } from "./utils/validators";

export { ChannelObject };

interface Env {
  CHANNEL_OBJECTS: DurableObjectNamespace<ChannelObject>;
  PTT_KV: KVNamespace;
  PTT_AUDIO_STORAGE: R2Bucket;
  DB: D1Database;
  JWT_SECRET: string;
  WEATHER_API_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers pour iOS
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // En production: domaines spécifiques
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-User-Agent",
      "Access-Control-Max-Age": "86400",
    };

    // Gestion preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Authentification et validation
      if (path !== "/auth" && !path.startsWith("/health")) {
        const authResult = await validateRequest(request, env);
        if (!authResult.valid) {
          return new Response(JSON.stringify({ error: authResult.error }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        request.userId = authResult.userId;
      }

      // Routing principal
      switch (true) {
        case path === "/auth":
          return handleAuth(request, env, corsHeaders);

        case path.startsWith("/channels"):
          return handleChannels(request, env, corsHeaders);

        case path.startsWith("/channel/"):
          return handleChannelOperations(request, env, corsHeaders);

        case path === "/sites":
          return handleFlyingSites(request, env, corsHeaders);

        case path === "/weather":
          return handleWeather(request, env, corsHeaders);

        case path === "/health":
          return new Response(
            JSON.stringify({
              status: "healthy",
              timestamp: new Date().toISOString(),
              version: "1.0.0",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );

        default:
          return new Response("Not Found", {
            status: 404,
            headers: corsHeaders,
          });
      }
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};

async function handleChannelOperations(
  request: Request,
  env: Env,
  corsHeaders: any
): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/");
  const channelId = pathParts[2];

  if (!channelId) {
    return new Response("Channel ID required", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Obtention instance Durable Object pour ce canal
  const channelObjectId = env.CHANNEL_OBJECTS.idFromName(channelId);
  const channelObject = env.CHANNEL_OBJECTS.get(channelObjectId);

  // Forward de la requête vers le Durable Object
  const channelUrl = new URL(request.url);
  channelUrl.pathname = channelUrl.pathname.replace(
    `/channel/${channelId}`,
    ""
  );

  const channelRequest = new Request(channelUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const response = await channelObject.fetch(channelRequest);

  // Ajout CORS headers à la réponse
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: { ...Object.fromEntries(response.headers), ...corsHeaders },
  });

  return newResponse;
}

async function handleFlyingSites(
  request: Request,
  env: Env,
  corsHeaders: any
): Promise<Response> {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");
  const radius = url.searchParams.get("radius") || "50";

  if (!lat || !lon) {
    return new Response(
      JSON.stringify({
        error: "Latitude and longitude required",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Sites de vol prédéfinis (en production: base de données)
  const flyingSites = [
    {
      id: "chamonix-planpraz",
      name: "Chamonix - Plan Praz",
      coordinates: { lat: 45.929681, lon: 6.876345 },
      elevation: 2000,
      difficulty: "intermediate",
      vhfFrequency: "144.150",
      channels: [
        {
          name: "Chamonix Local",
          uuid: "F4D667DB-2F17-4177-8D70-914024A7A5C1",
          type: "site_local",
        },
      ],
    },
    {
      id: "annecy-forclaz",
      name: "Annecy - Col de la Forclaz",
      coordinates: { lat: 45.773056, lon: 6.196389 },
      elevation: 1245,
      difficulty: "beginner",
      vhfFrequency: "143.9875",
      channels: [
        {
          name: "Annecy Débutants",
          uuid: "A1B2C3D4-5E6F-7G8H-9I0J-K1L2M3N4O5P6",
          type: "site_local",
        },
      ],
    },
  ];

  // Filtrage par distance (formule haversine simplifiée)
  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);
  const maxRadius = parseFloat(radius);

  const nearbySites = flyingSites.filter((site) => {
    const distance = calculateDistance(
      userLat,
      userLon,
      site.coordinates.lat,
      site.coordinates.lon
    );
    return distance <= maxRadius;
  });

  return new Response(
    JSON.stringify({
      sites: nearbySites,
      userLocation: { lat: userLat, lon: userLon },
      searchRadius: maxRadius,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Utilitaire calcul distance géographique
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### Handlers Spécialisés

#### src/handlers/auth.ts

```typescript
import { sign, verify } from "@tsndr/cloudflare-worker-jwt";

interface AuthRequest {
  user: string;
  pass: string;
  location?: { lat: number; lon: number };
}

export async function handleAuth(
  request: Request,
  env: Env,
  corsHeaders: any
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    let authData: AuthRequest;

    if (request.method === "GET") {
      // Format iOS: GET /auth?user=USER&pass=PASS&location=LAT,LON
      const url = new URL(request.url);
      const user = url.searchParams.get("user");
      const pass = url.searchParams.get("pass");
      const locationStr = url.searchParams.get("location");

      let location;
      if (locationStr) {
        const [lat, lon] = locationStr.split(",").map(Number);
        location = { lat, lon };
      }

      authData = { user: user!, pass: pass!, location };
    } else {
      // POST JSON
      authData = await request.json();
    }

    if (!authData.user || !authData.pass) {
      return new Response(
        JSON.stringify({
          error: "Username and password required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Authentification utilisateur
    const authResult = await authenticateUser(
      authData.user,
      authData.pass,
      env
    );
    if (!authResult.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid credentials",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Génération JWT
    const token = await sign(
      {
        userId: authResult.userId,
        username: authData.user,
        groups: authResult.groups,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24h
      },
      env.JWT_SECRET
    );

    // Récupération canaux pour localisation utilisateur
    const channels = await getChannelsForUser(
      authResult.userId,
      authData.location,
      authResult.groups,
      env
    );

    // Réponse compatible format iOS attendu
    const response = {
      user: authData.user,
      pass: authData.pass, // Retourné pour compatibilité iOS
      token, // JWT pour authentification future
      channels,
      user_groups: authResult.groups,
      network_status: {
        server_latency_ms: 45, // Mesure réelle en production
        recommended_codec: "aac-lc",
        bitrate_kbps: 32,
        sample_rate: 22050,
        server_region: "europe-west1",
      },
      server_info: {
        version: "1.0.0",
        max_transmission_duration: 120, // secondes
        heartbeat_interval: 30, // secondes
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auth error:", error);
    return new Response(
      JSON.stringify({
        error: "Authentication service unavailable",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function authenticateUser(username: string, password: string, env: Env) {
  // En production: vérification base de données utilisateurs
  // Ici: simple vérification demo

  // Hash du mot de passe (utiliser bcrypt en production)
  const passwordHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password + "salt_paragliding_2024")
  );

  // Utilisateurs demo
  const users = {
    pilot1: {
      passwordHash: Array.from(new Uint8Array(passwordHash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      groups: ["parapente_chamonix", "pilots"],
      userId: "user_001",
    },
    instructor1: {
      passwordHash: Array.from(new Uint8Array(passwordHash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      groups: ["instructeurs", "pilots", "emergency_responders"],
      userId: "user_002",
    },
  };

  const user = users[username as keyof typeof users];
  if (!user) {
    return { success: false };
  }

  // En production: vérification hash sécurisé
  return {
    success: true,
    userId: user.userId,
    groups: user.groups,
  };
}

async function getChannelsForUser(
  userId: string,
  location: { lat: number; lon: number } | undefined,
  groups: string[],
  env: Env
) {
  const channels = [];

  // Canal d'urgence toujours disponible
  channels.push({
    name: "Urgence Alpes",
    uuid: "EMERGENCY-ALPINE-001",
    type: "emergency",
    priority: 1,
    always_available: true,
    description: "Canal urgence montagne - contact PGHM",
  });

  // Canaux basés sur géolocalisation
  if (location) {
    const nearbySites = await getNearbyFlyingSites(
      location.lat,
      location.lon,
      env
    );

    for (const site of nearbySites) {
      channels.push({
        name: site.name,
        uuid: site.channelUuid,
        type: "site_local",
        coordinates: site.coordinates,
        radius_km: site.radius,
        frequency_vhf: site.vhfFrequency,
        description: `Canal principal ${site.name}`,
        elevation: site.elevation,
        difficulty: site.difficulty,
      });
    }
  }

  // Canaux basés sur groupes utilisateur
  if (groups.includes("instructeurs")) {
    channels.push({
      name: "Instructeurs Région",
      uuid: "INSTRUCTORS-REGION-001",
      type: "professional",
      priority: 2,
      description: "Canal réservé instructeurs certifiés",
    });
  }

  if (groups.includes("competition")) {
    channels.push({
      name: "Compétition Cross-Country",
      uuid: "COMPETITION-XC-001",
      type: "competition",
      priority: 3,
      description: "Canal compétition vol de distance",
    });
  }

  return channels;
}

async function getNearbyFlyingSites(lat: number, lon: number, env: Env) {
  // Implémentation similaire à handleFlyingSites
  // Retourne sites avec leurs canaux associés

  const sites = [
    {
      name: "Chamonix - Mont Blanc",
      channelUuid: "F4D667DB-2F17-4177-8D70-914024A7A5C1",
      coordinates: { lat: 45.929681, lon: 6.876345 },
      radius: 50,
      vhfFrequency: "144.150",
      elevation: 2000,
      difficulty: "intermediate",
    },
    // ... autres sites
  ];

  return sites.filter((site) => {
    const distance = calculateDistance(
      lat,
      lon,
      site.coordinates.lat,
      site.coordinates.lon
    );
    return distance <= site.radius;
  });
}
```

### Optimisations Plan Gratuit Cloudflare

#### Gestion Limites Ressources

```typescript
// Middleware monitoring usage
class ResourceMonitor {
  private cpuStartTime: number;
  private memoryUsage: number;

  constructor() {
    this.cpuStartTime = Date.now();
    this.memoryUsage = 0;
  }

  checkCpuLimit(): boolean {
    const elapsed = Date.now() - this.cpuStartTime;
    return elapsed < 9000; // 9s sur 10s limite
  }

  optimizeForMemory<T>(data: T[]): T[] {
    // Pagination automatique si trop de données
    return data.length > 100 ? data.slice(0, 100) : data;
  }

  async limitedDatabaseQuery(query: string, maxResults: number = 50) {
    // Limitation requêtes pour rester dans les quotas
    return await db.prepare(query + ` LIMIT ${maxResults}`).all();
  }
}

// Cache intelligent KV
class SmartCache {
  constructor(private kv: KVNamespace) {}

  async get(key: string, ttl: number = 300) {
    const cached = await this.kv.get(key, "json");
    if (cached && cached.timestamp + ttl * 1000 > Date.now()) {
      return cached.data;
    }
    return null;
  }

  async set(key: string, data: any, ttl: number = 300) {
    await this.kv.put(
      key,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      }),
      { expirationTtl: ttl }
    );
  }
}
```

### Intégration APNs Push-to-Talk pour iOS

Le framework PushToTalk d'Apple nécessite des notifications push spécialisées pour déclencher l'interface PTT système. Voici l'implémentation complète côté Cloudflare Workers.

#### Configuration Variables Environnement APNs

Ajout au `wrangler.toml` :

```toml
# Configuration APNs pour PushToTalk
[env.production.vars]
APN_KEY_ID = "your-apn-key-id"
APN_TEAM_ID = "your-apple-team-id"
BUNDLE_ID = "com.highcanfly.pttapp"

# Secrets (à définir avec wrangler secret put)
# APN_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

#### Implémentation Service APNs Complet

```typescript
// src/services/apns.ts
import { sign } from "@tsndr/cloudflare-worker-jwt";

interface APNsPayload {
  aps: {
    pushtotalk: {
      "target-channel": string;
      "initiator-name": string;
      "transmission-type": "start" | "end" | "emergency";
    };
    "content-available": 1;
    "mutable-content": 1;
  };
  channelInfo: {
    uuid: string;
    name: string;
    participantCount: number;
    vhfBackupFreq?: string;
  };
  location?: {
    lat: number;
    lon: number;
  };
}

class APNsService {
  constructor(private env: Env) {}

  /**
   * Génération JWT pour authentification APNs
   */
  private async generateAPNsJWT(): Promise<string> {
    const header = {
      alg: "ES256",
      kid: this.env.APN_KEY_ID,
    };

    const payload = {
      iss: this.env.APN_TEAM_ID,
      iat: Math.floor(Date.now() / 1000),
    };

    // En production: utiliser vraie clé privée P-256
    return await sign(payload, this.env.APN_PRIVATE_KEY, {
      algorithm: "ES256",
    });
  }

  /**
   * Envoi notification PTT à un device spécifique
   */
  async sendPushToTalkNotification(
    deviceToken: string,
    channelId: string,
    initiatorName: string,
    transmissionType: "start" | "end" | "emergency",
    channelInfo: any,
    location?: { lat: number; lon: number }
  ): Promise<void> {
    try {
      const jwt = await this.generateAPNsJWT();
      const url = `https://api.push.apple.com/3/device/${deviceToken}`;

      const payload: APNsPayload = {
        aps: {
          pushtotalk: {
            "target-channel": channelId,
            "initiator-name": initiatorName,
            "transmission-type": transmissionType,
          },
          "content-available": 1,
          "mutable-content": 1,
        },
        channelInfo: {
          uuid: channelInfo.uuid,
          name: channelInfo.name,
          participantCount: channelInfo.participantCount,
          vhfBackupFreq: channelInfo.vhfFrequency,
        },
      };

      if (location) {
        payload.location = location;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "apns-topic": `${this.env.BUNDLE_ID}.voip-ptt`,
          "apns-push-type": "pushtotalk",
          authorization: `bearer ${jwt}`,
          "apns-priority": transmissionType === "emergency" ? "10" : "5",
          "apns-expiration": "0", // Notification immédiate
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`APNs error ${response.status}:`, errorBody);
        throw new Error(
          `APNs notification failed: ${response.status} - ${errorBody}`
        );
      }

      console.log(`APNs notification sent successfully to ${deviceToken}`);
    } catch (error) {
      console.error("APNs service error:", error);
      throw error;
    }
  }

  /**
   * Envoi notification d'urgence prioritaire
   */
  async sendEmergencyAlert(
    deviceTokens: string[],
    emergencyInfo: {
      location: { lat: number; lon: number };
      message: string;
      reporterName: string;
    }
  ): Promise<void> {
    const emergencyPayload = {
      aps: {
        alert: {
          title: "🆘 URGENCE PARAPENTE",
          body: `${emergencyInfo.reporterName}: ${emergencyInfo.message}`,
          sound: "emergency.caf",
        },
        "content-available": 1,
        "mutable-content": 1,
      },
      emergency: {
        location: emergencyInfo.location,
        reporter: emergencyInfo.reporterName,
        message: emergencyInfo.message,
        timestamp: Date.now(),
      },
    };

    // Envoi parallèle à tous les devices
    const notifications = deviceTokens.map((token) =>
      this.sendNotification(token, emergencyPayload, "emergency")
    );

    await Promise.allSettled(notifications);
  }

  /**
   * Méthode générique envoi notification
   */
  private async sendNotification(
    deviceToken: string,
    payload: any,
    type: "pushtotalk" | "emergency" | "background"
  ): Promise<void> {
    const jwt = await this.generateAPNsJWT();
    const url = `https://api.push.apple.com/3/device/${deviceToken}`;

    await fetch(url, {
      method: "POST",
      headers: {
        "apns-topic": this.env.BUNDLE_ID,
        "apns-push-type": type === "pushtotalk" ? "pushtotalk" : "alert",
        authorization: `bearer ${jwt}`,
        "apns-priority": type === "emergency" ? "10" : "5",
      },
      body: JSON.stringify(payload),
    });
  }
}

export { APNsService };
```

#### Intégration dans Durable Object Channel

Modification de `ChannelObject.ts` pour inclure les notifications APNs :

```typescript
// Ajout dans la classe ChannelObject
private apnsService: APNsService;

constructor(state: DurableObjectState, env: Env) {
  // ... initialisation existante
  this.apnsService = new APNsService(env);
}

private async handleStartTransmission(request: Request): Promise<Response> {
  const { userId, location, quality } = await request.json();

  // ... logique PTT existante

  // Notification APNs à tous les participants
  await this.notifyParticipantsViaAPNs('start', userId, participant.username);

  return new Response(JSON.stringify({
    success: true,
    transmissionId: `${userId}_${Date.now()}`
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Notification APNs pour événements PTT
 */
private async notifyParticipantsViaAPNs(
  type: 'start' | 'end' | 'emergency',
  initiatorId: string,
  initiatorName: string
): Promise<void> {
  const initiator = this.channelState.participants.get(initiatorId);

  for (const [participantId, participant] of this.channelState.participants) {
    if (participantId === initiatorId) continue; // Pas d'auto-notification

    // Récupération device token depuis base (à implémenter)
    const deviceToken = await this.getDeviceToken(participantId);
    if (!deviceToken) continue;

    try {
      await this.apnsService.sendPushToTalkNotification(
        deviceToken,
        this.channelState.id,
        initiatorName,
        type,
        {
          uuid: this.channelState.id,
          name: this.channelState.name,
          participantCount: this.channelState.participants.size,
          vhfFrequency: this.channelState.vhfFrequency
        },
        initiator?.location
      );
    } catch (error) {
      console.error(`Failed to notify ${participantId}:`, error);
    }
  }
}

/**
 * Gestion urgences avec notification APNs prioritaire
 */
private async handleEmergency(userId: string, emergencyData: any): Promise<void> {
  const participant = this.channelState.participants.get(userId);
  if (!participant) return;

  // Log urgence
  await this.logChannelEvent(userId, participant.username, 'emergency', emergencyData);

  // Notification WebSocket immédiate
  this.broadcastToParticipants({
    type: 'emergency_alert',
    reporter: participant.username,
    location: emergencyData.location,
    message: emergencyData.message,
    timestamp: Date.now()
  });

  // Notification APNs à tous les participants du canal + canaux d'urgence
  const allDeviceTokens = await this.getAllEmergencyDeviceTokens();

  await this.apnsService.sendEmergencyAlert(allDeviceTokens, {
    location: emergencyData.location,
    message: emergencyData.message,
    reporterName: participant.username
  });
}
```

#### Configuration iOS pour Réception APNs PTT

Côté iOS, l'application doit être configurée pour recevoir ces notifications spécialisées :

```swift
// AppDelegate.swift
import PushToTalk
import UserNotifications

class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        // Configuration notifications PTT
        UNUserNotificationCenter.current().delegate = self

        // Demande permissions notifications
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }

        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        // Envoi token au backend Cloudflare
        Task {
            await ParapenteNetworkService.shared.registerDeviceToken(tokenString)
        }
    }

    // Réception notification PTT en arrière-plan
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {

        let userInfo = response.notification.request.content.userInfo

        if let pttInfo = userInfo["aps"] as? [String: Any],
           let pushtotalk = pttInfo["pushtotalk"] as? [String: Any] {

            let channelId = pushtotalk["target-channel"] as? String ?? ""
            let initiatorName = pushtotalk["initiator-name"] as? String ?? ""
            let transmissionType = pushtotalk["transmission-type"] as? String ?? ""

            // Activation interface PTT système
            handlePushToTalkNotification(
                channelId: channelId,
                initiatorName: initiatorName,
                transmissionType: transmissionType
            )
        }

        completionHandler()
    }

    private func handlePushToTalkNotification(channelId: String, initiatorName: String, transmissionType: String) {
        // Intégration avec PTChannelManager
        // Activation UI PTT système iOS
    }
}
```

### Cas d'Usage APNs Spécialisés Parapente

#### 1. Transmission PTT Standard

```typescript
// Déclencher notification lors début transmission
await apnsService.sendPushToTalkNotification(
  deviceToken,
  "CHAMONIX-001",
  "Pierre_Pilot",
  "start",
  channelInfo,
  { lat: 45.929681, lon: 6.876345 }
);
```

#### 2. Alerte d'Urgence

```typescript
// Notification urgence avec géolocalisation
await apnsService.sendEmergencyAlert(allDeviceTokens, {
  location: { lat: 45.929681, lon: 6.876345 },
  message: "Atterrissage d'urgence - besoin assistance",
  reporterName: "Pierre_Pilot",
});
```

#### 3. Notification Changement Canal

```typescript
// Notification automatique changement site
await apnsService.sendNotification(deviceToken, {
  aps: {
    alert: "Nouveau site détecté: Chamonix - Rejoindre canal local?",
    "content-available": 1,
  },
  site_change: {
    new_site: "chamonix-planpraz",
    channel_uuid: "F4D667DB-2F17-4177-8D70-914024A7A5C1",
    vhf_frequency: "144.150",
  },
});
```

Cette intégration APNs permet une **expérience PTT native iOS** avec notifications push spécialisées pour activation automatique de l'interface système, essentielle pour une application PTT professionnelle destinée aux parapentistes.

## Structure Workspace VS Code Multi-Projets

### Architecture Monorepo Organisé

Le projet complet utilise un **workspace VS Code multi-dossiers** pour organiser efficacement le backend Cloudflare Workers, l'application iOS et la documentation dans un environnement de développement cohérent.

```
ptt-parapente-workspace/
├── .vscode/
│   ├── settings.json              # Configuration workspace commune
│   ├── launch.json                # Configuration debug multi-projets
│   ├── tasks.json                 # Tâches build/deploy automatisées
│   └── extensions.json            # Extensions recommandées
├── apps/backend-admin/            # Cloudflare Worker
│   ├── src/
│   │   ├── index.ts               # Worker principal
│   │   ├── durable-objects/
│   │   │   ├── ChannelObject.ts   # Objet durable canal PTT
│   │   │   └── UserSessionObject.ts
│   │   ├── handlers/
│   │   │   ├── auth.ts            # Authentification
│   │   │   ├── channels.ts        # Gestion canaux
│   │   │   ├── admin.ts           # API administration
│   │   │   └── websocket.ts       # WebSocket temps réel
│   │   ├── services/
│   │   │   ├── apns.ts           # Service notifications Apple
│   │   │   ├── database.ts       # Abstraction D1 SQLite
│   │   │   ├── geolocation.ts    # Services géolocalisation
│   │   │   └── admin-auth.ts     # Authentification admin Auth0
│   │   ├── types/
│   │   │   ├── channel.ts        # Types canaux PTT
│   │   │   ├── user.ts           # Types utilisateur
│   │   │   ├── admin.ts          # Types administration
│   │   │   └── ptt.ts            # Types Push-to-Talk
│   │   └── utils/
│   │       ├── crypto.ts         # Utilitaires chiffrement
│   │       ├── logger.ts         # Logging structuré
│   │       └── validators.ts     # Validation données
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_apns_tokens.sql
│   │   └── 003_admin_tables.sql
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── auth.test.ts
│   │   │   ├── channels.test.ts
│   │   │   └── admin.test.ts
│   │   └── integration/
│   │       └── e2e.test.ts
│   ├── wrangler.toml              # Configuration Cloudflare
│   ├── package.json               # Dépendances TypeScript
│   ├── tsconfig.json              # Configuration TypeScript
│   └── README.md                  # Documentation backend
├── ios/                          # Application iOS
│   ├── PTTParapente.xcodeproj/    # Projet Xcode
│   ├── PTTParapente/
│   │   ├── App/
│   │   │   ├── AppDelegate.swift
│   │   │   ├── SceneDelegate.swift
│   │   │   └── Info.plist
│   │   ├── Core/
│   │   │   ├── PTT/
│   │   │   │   ├── PTTManager.swift
│   │   │   │   └── ChannelManager.swift
│   │   │   ├── Network/
│   │   │   │   ├── NetworkService.swift
│   │   │   │   └── APIEndpoints.swift
│   │   │   └── Location/
│   │   │       ├── LocationManager.swift
│   │   │       └── SiteDetection.swift
│   │   ├── Features/
│   │   │   ├── Authentication/
│   │   │   │   ├── LoginView.swift
│   │   │   │   └── LoginViewModel.swift
│   │   │   ├── Main/
│   │   │   │   ├── MainView.swift
│   │   │   │   ├── MainViewModel.swift
│   │   │   │   └── PTTButton.swift
│   │   │   ├── Channels/
│   │   │   │   ├── ChannelListView.swift
│   │   │   │   └── ChannelSelectionView.swift
│   │   │   └── Settings/
│   │   │       ├── SettingsView.swift
│   │   │       └── UserPreferences.swift
│   │   ├── UI/
│   │   │   ├── Components/
│   │   │   │   ├── NetworkStatusView.swift
│   │   │   │   └── EmergencyButton.swift
│   │   │   └── Styles/
│   │   │       ├── Colors.swift
│   │   │       └── Typography.swift
│   │   ├── Utilities/
│   │   │   ├── KeychainManager.swift
│   │   │   ├── Logger.swift
│   │   │   └── Extensions/
│   │   │       ├── String+Extensions.swift
│   │   │       └── CLLocation+Extensions.swift
│   │   └── Resources/
│   │       ├── Assets.xcassets
│   │       ├── Localizable.strings    # Français
│   │       ├── Localizable.strings.en # Anglais
│   │       ├── Localizable.strings.es # Espagnol
│   │       └── Localizable.strings.it # Italien
│   ├── PTTParapenteTests/
│   │   ├── Core/
│   │   │   ├── PTTManagerTests.swift
│   │   │   └── NetworkServiceTests.swift
│   │   ├── Features/
│   │   │   └── AuthenticationTests.swift
│   │   └── Mock/
│   │       ├── MockNetworkService.swift
│   │       └── MockLocationManager.swift
│   ├── PTTParapenteUITests/
│   │   ├── AuthenticationUITests.swift
│   │   ├── MainFlowUITests.swift
│   │   └── PTTInteractionTests.swift
│   └── README.md                  # Documentation iOS
├── apps/backend-admin/           # Application Administration Web (basé sur [template](https://github.com/sctg-development/vite-react-heroui-auth0-template))
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── manifest.json
│   ├── src/
│   │   ├── authentication/   # Système Auth0 (de [template](https://github.com/sctg-development/vite-react-heroui-auth0-template))
│   │   │   ├── auth-components.tsx
│   │   │   ├── auth-root.tsx
│   │   │   ├── index.ts
│   │   │   └── providers/
│   │   │       ├── auth-provider.ts
│   │   │       ├── auth0-provider.tsx
│   │   │       └── use-auth.tsx
│   │   ├── components/       # Composants UI HeroUI
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Layout.tsx
│   │   │   ├── common/
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   ├── ConfirmDialog.tsx
│   │   │   │   └── StatusBadge.tsx
│   │   │   ├── maps/
│   │   │   │   ├── ParapenteMap.tsx      # Carte interactive
│   │   │   │   ├── SiteMarker.tsx        # Marqueurs sites
│   │   │   │   │   └── ChannelOverlay.tsx    # Overlay canaux
│   │   │   ├── channels/
│   │   │   │   ├── ChannelList.tsx       # Liste canaux
│   │   │   │   ├── ChannelForm.tsx       # Form création/édition
│   │   │   │   ├── ChannelCard.tsx       # Card canal
│   │   │   │   └── ChannelStats.tsx      # Statistiques canal
│   │   │   ├── users/
│   │   │   │   ├── UserList.tsx          # Liste utilisateurs
│   │   │   │   ├── UserForm.tsx          # Form utilisateur
│   │   │   │   ├── UserCard.tsx          # Card utilisateur
│   │   │   │   └── UserRoles.tsx         # Gestion rôles
│   │   │   │   ├── sites/
│   │   │   │   ├── SiteList.tsx          # Liste sites vol
│   │   │   │   ├── SiteForm.tsx          # Form site
│   │   │   │   ├── SiteCard.tsx          # Card site
│   │   │   │   └── SiteWeather.tsx       # Météo site
│   │   │   └── analytics/
│   │   │       ├── Dashboard.tsx         # Dashboard principal
│   │   │       ├── RealtimeStats.tsx     # Stats temps réel
│   │   │       ├── UsageCharts.tsx       # Graphiques usage
│   │   │       └── EmergencyAlerts.tsx   # Alertes urgence
│   │   ├── pages/            # Pages principales
│   │   │   ├── Dashboard.tsx           # Page accueil admin
│   │   │   ├── Channels.tsx            # Gestion canaux
│   │   │   ├── Users.tsx               # Gestion utilisateurs
│   │   │   ├── Sites.tsx               # Gestion sites vol
│   │   │   ├── Map.tsx                 # Vue carte globale
│   │   │   ├── Analytics.tsx           # Analytics/monitoring
│   │   │   ├── Settings.tsx            # Configuration système
│   │   │   └── Emergency.tsx           # Console urgences
│   │   ├── hooks/            # Hooks personnalisés
│   │   │   ├── useChannels.ts          # Hook gestion canaux
│   │   │   ├── useUsers.ts             # Hook gestion users
│   │   │   ├── useSites.ts             # Hook sites vol
│   │   │   ├── useRealtimeData.ts      # Hook données temps réel
│   │   │   └── useMapData.ts           # Hook données carte
│   │   ├── services/         # Services API
│   │   │   ├── api.ts                  # Client API backend
│   │   │   ├── channels.ts             # Service canaux
│   │   │   ├── users.ts                # Service utilisateurs
│   │   │   ├── sites.ts                # Service sites
│   │   │   ├── analytics.ts            # Service analytics
│   │   │   └── websocket.ts            # WebSocket temps réel
│   │   ├── types/            # Types TypeScript
│   │   │   ├── api.ts                  # Types API
│   │   │   ├── channel.ts              # Types canaux
│   │   │   ├── user.ts                 # Types utilisateur
│   │   │   ├── site.ts                 # Types sites
│   │   │   └── analytics.ts            # Types analytics
│   │   ├── utils/            # Utilitaires
│   │   │   ├── formatters.ts           # Formatage données
│   │   │   ├── validators.ts           # Validation forms
│   │   │   ├── constants.ts            # Constantes
│   │   │   └── helpers.ts              # Fonctions helper
│   │   ├── config/           # Configuration (de [template](https://github.com/sctg-development/vite-react-heroui-auth0-template))
│   │   │   ├── site.ts                 # Config site
│   │   │   └── env.ts                  # Variables env
│   │   ├── locales/          # Localisation i18n
│   │   │   └── base/
│   │   │       ├── fr-FR.json          # Français
│   │   │       ├── en-US.json          # Anglais
│   │   │       ├── es-ES.json          # Espagnol
│   │   │       └── it-IT.json          # Italien
│   │   ├── styles/           # Styles CSS
│   │   │   ├── globals.css             # Styles globaux
│   │   │   └── components.css          # Styles composants
│   │   ├── App.tsx           # Composant principal
│   │   ├── main.tsx          # Point d'entrée
│   │   ├── provider.tsx      # HeroUI provider
│   │   └── i18n.ts           # Configuration i18n
│   ├── package.json          # Dépendances React
│   ├── tsconfig.json         # Config TypeScript
│   ├── tailwind.config.js    # Config TailwindCSS v4
│   ├── vite.config.ts        # Config Vite
├── docs/                         # Documentation projet
│   ├── architecture/
│   │   ├── backend-architecture.md
│   │   ├── ios-architecture.md
│   │   ├── admin-architecture.md      # Architecture app admin
│   │   └── api-specification.md
│   ├── deployment/
│   │   ├── cloudflare-setup.md
│   │   ├── ios-distribution.md
│   │   ├── admin-deployment.md        # Déploiement admin
│   │   └── monitoring.md
│   ├── user-guides/
│   │   ├── pilot-manual.md
│   │   ├── instructor-guide.md
│   │   ├── admin-manual.md            # Guide administrateur
│   │   └── emergency-procedures.md
│   ├── technical/
│   │   ├── apns-integration.md
│   │   ├── audio-codecs.md
│   │   ├── auth0-integration.md       # Intégration Auth0
│   │   └── security-guidelines.md
│   └── assets/
│       ├── diagrams/
│       │   ├── architecture.mermaid
│       │   └── user-flows.mermaid
│       └── screenshots/
│           ├── ios-app/
│           └── admin-panel/
├── scripts/                      # Scripts automatisation
│   ├── deploy/
│   │   ├── deploy-backend.sh
│   │   ├── deploy-ios-testflight.sh
│   │   └── setup-environment.sh
│   ├── development/
│   │   ├── start-dev-server.sh
│   │   ├── run-ios-simulator.sh
│   │   └── sync-localizations.sh
│   └── testing/
│       ├── run-backend-tests.sh
│       ├── run-ios-tests.sh
│       └── e2e-test-suite.sh
├── .env.example                  # Variables d'environnement template
├── .gitignore                    # Exclusions Git communes
├── ptt-workspace.code-workspace  # Configuration VS Code workspace
├── package.json                  # Scripts workspace global
└── README.md                     # Documentation projet principal
```

### Configuration VS Code Workspace

#### ptt-workspace.code-workspace

```json
{
  "folders": [
    {
      "name": "Backend (Cloudflare Workers)",
      "path": "./backend"
    },
    {
      "name": "iOS App",
      "path": "./ios"
    },
    {
      "name": "Admin Frontend (React)",
      "path": "./admin/client"
    },
    {
      "name": "Admin API Worker",
      "path": "./admin/api-worker"
    },
    {
      "name": "Documentation",
      "path": "./docs"
    },
    {
      "name": "Scripts",
      "path": "./scripts"
    }
  ],
  "settings": {
    "typescript.preferences.includePackageJsonAutoImports": "auto",
    "typescript.suggest.autoImports": true,
    "typescript.validate.enable": true,
    "swift.path": "/usr/bin/swift",
    "sourcekit-lsp.serverPath": "/usr/bin/sourcekit-lsp",
    "files.associations": {
      "*.swift": "swift",
      "*.ts": "typescript",
      "wrangler.toml": "toml"
    },
    "search.exclude": {
      "**/node_modules": true,
      "**/DerivedData": true,
      "**/.build": true,
      "**/dist": true
    }
  },
  "tasks": {
    "version": "2.0.0",
    "tasks": [
      {
        "label": "Start Backend Dev",
        "type": "shell",
        "command": "cd backend && npm run dev",
        "group": "build",
        "presentation": {
          "echo": true,
          "reveal": "always",
          "panel": "new"
        }
      },
      {
        "label": "Start Admin Frontend",
        "type": "shell",
        "command": "cd admin/client && npm run dev:env",
        "group": "build",
        "presentation": {
          "echo": true,
          "reveal": "always",
          "panel": "new"
        }
      },
      {
        "label": "Start Admin API Worker",
        "type": "shell",
        "command": "cd admin/api-worker && npm run dev",
        "group": "build",
        "presentation": {
          "echo": true,
          "reveal": "always",
          "panel": "new"
        }
      },
      {
        "label": "Build iOS Debug",
        "type": "shell",
        "command": "cd ios && xcodebuild -scheme PTTParapente -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 15'",
        "group": "build"
      },
      {
        "label": "Build Admin Production",
        "type": "shell",
        "command": "cd admin/client && npm run build",
        "group": "build"
      },
      {
        "label": "Deploy Backend Production",
        "type": "shell",
        "command": "./scripts/deploy/deploy-backend.sh production",
        "group": "build"
      },
      {
        "label": "Sync Localizations",
        "type": "shell",
        "command": "./scripts/development/sync-localizations.sh",
        "group": "build"
      }
    ]
  },
  "launch": {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "Debug Backend (Wrangler)",
        "type": "node",
        "request": "launch",
        "program": "${workspaceFolder}/backend/node_modules/.bin/wrangler",
        "args": ["dev", "--local"],
        "cwd": "${workspaceFolder}/backend",
        "console": "integratedTerminal"
      }
    ]
  },
  "extensions": {
    "recommendations": [
      "ms-vscode.vscode-typescript-next",
      "sswg.swift-lang",
      "ms-vscode.vscode-json",
      "redhat.vscode-yaml",
      "tamasfe.even-better-toml",
      "ms-vscode.vscode-markdown",
      "bierner.markdown-mermaid",
      "ms-vscode.vscode-git-graph",
      "ms-vscode.vscode-eslint",
      "esbenp.prettier-vscode"
    ]
  }
}
```

#### .vscode/settings.json (Workspace-specific)

```json
{
  "files.exclude": {
    "**/node_modules": true,
    "**/DerivedData": true,
    "**/.build": true,
    "**/dist": true,
    "ios/**/*.xcuserstate": true
  },
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "swift.formatting.indentSwitchCase": true,
  "markdown.preview.breaks": true,
  "mermaid.theme": "default"
}
```

#### .vscode/tasks.json (Tâches Intégrées)

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Full Project Build",
      "dependsOrder": "sequence",
      "dependsOn": [
        "Backend: Install & Build",
        "iOS: Build Debug",
        "Docs: Generate"
      ],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Backend: Install & Build",
      "type": "shell",
      "command": "npm install && npm run build",
      "options": {
        "cwd": "${workspaceFolder}/backend"
      },
      "group": "build"
    },
    {
      "label": "Backend: Start Dev Server",
      "type": "shell",
      "command": "npm run dev",
      "options": {
        "cwd": "${workspaceFolder}/backend"
      },
      "group": "test",
      "isBackground": true
    },
    {
      "label": "iOS: Build Debug",
      "type": "shell",
      "command": "xcodebuild -scheme PTTParapente -configuration Debug build-for-testing",
      "options": {
        "cwd": "${workspaceFolder}/ios"
      },
      "group": "build"
    },
    {
      "label": "iOS: Run Tests",
      "type": "shell",
      "command": "xcodebuild -scheme PTTParapente -configuration Debug test-without-building -destination 'platform=iOS Simulator,name=iPhone 15'",
      "options": {
        "cwd": "${workspaceFolder}/ios"
      },
      "group": "test"
    },
    {
      "label": "Deploy: Staging",
      "type": "shell",
      "command": "./scripts/deploy/deploy-backend.sh staging",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "group": "build"
    },
    {
      "label": "Deploy: Production",
      "type": "shell",
      "command": "./scripts/deploy/deploy-backend.sh production",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "group": "build"
    },
    {
      "label": "Docs: Generate",
      "type": "shell",
      "command": "npm run docs:build",
      "group": "build"
    }
  ]
}
```

### Scripts Automatisation Développement

#### scripts/development/start-dev-env.sh

```bash
#!/bin/bash
# Script de démarrage environnement développement complet

echo "🚀 Démarrage environnement de développement PTT Parapente..."

# Vérification prérequis
if ! command -v node &> /dev/null; then
    echo "❌ Node.js requis"
    exit 1
fi

if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode requis pour développement iOS"
    exit 1
fi

# Backend Cloudflare Workers
echo "📦 Installation dépendances backend..."
cd backend && npm install

echo "🔄 Démarrage serveur de développement backend..."
npm run dev &
BACKEND_PID=$!

# iOS Simulator
echo "📱 Lancement iOS Simulator..."
cd ../ios
xcrun simctl boot "iPhone 15" 2>/dev/null || true
open -a Simulator

# Documentation
echo "📚 Serveur documentation..."
cd ../docs
if [ -f "package.json" ]; then
    npm install
    npm run serve &
    DOCS_PID=$!
fi

echo "✅ Environnement démarré!"
echo "   - Backend: http://localhost:8787"
echo "   - iOS: Simulator iPhone 15"
echo "   - Docs: http://localhost:3000"
echo ""
echo "Arrêt avec Ctrl+C"

# Nettoyage à l'arrêt
trap "kill $BACKEND_PID $DOCS_PID 2>/dev/null; exit" INT
wait
```

#### scripts/deploy/deploy-backend.sh

```bash
#!/bin/bash
# Script déploiement backend Cloudflare

ENVIRONMENT=${1:-staging}

echo "🚀 Déploiement backend vers $ENVIRONMENT..."

cd backend

# Vérification environnement
if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  Déploiement PRODUCTION - Confirmation requise"
    read -p "Continuer? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Déploiement annulé"
        exit 1
    fi
fi

# Build et tests
echo "🔨 Build TypeScript..."
npm run build

echo "🧪 Tests backend..."
npm run test

if [ $? -ne 0 ]; then
    echo "❌ Tests échoués - déploiement arrêté"
    exit 1
fi

# Migrations base de données
echo "💾 Migrations base de données..."
wrangler d1 execute PTT_DB --file migrations/001_initial_schema.sql --env $ENVIRONMENT
wrangler d1 execute PTT_DB --file migrations/002_add_apns_tokens.sql --env $ENVIRONMENT

# Déploiement
echo "📤 Déploiement Cloudflare Workers..."
wrangler deploy --env $ENVIRONMENT

echo "✅ Déploiement $ENVIRONMENT terminé!"
echo "🌐 URL: https://ptt-parapente-$ENVIRONMENT.your-domain.workers.dev"
```

### Extensions VS Code Recommandées

#### .vscode/extensions.json

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "sswg.swift-lang",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "tamasfe.even-better-toml",
    "ms-vscode.vscode-markdown",
    "bierner.markdown-mermaid",
    "ms-vscode.vscode-git-graph",
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-github-issue-notebooks"
  ],
  "unwantedRecommendations": ["ms-vscode.vscode-typescript"]
}
```

### Package.json Workspace Global

#### package.json (racine)

```json
{
  "name": "ptt-parapente-workspace",
  "version": "1.0.0",
  "description": "Workspace PTT Parapente - Backend Cloudflare + iOS App",
  "scripts": {
    "install:all": "cd backend && npm install && cd ../docs && npm install",
    "build:backend": "cd backend && npm run build",
    "build:docs": "cd docs && npm run build",
    "test:backend": "cd backend && npm run test",
    "test:ios": "./scripts/testing/run-ios-tests.sh",
    "dev:backend": "cd backend && npm run dev",
    "dev:start": "./scripts/development/start-dev-env.sh",
    "deploy:staging": "./scripts/deploy/deploy-backend.sh staging",
    "deploy:production": "./scripts/deploy/deploy-backend.sh production",
    "docs:serve": "cd docs && npm run serve",
    "lint": "cd backend && npm run lint",
    "format": "cd backend && npm run format"
  },
  "workspaces": ["backend", "docs"],
  "devDependencies": {
    "concurrently": "^8.2.0",
    "cross-env": "^7.0.3"
  }
}
```

### Avantages Structure Workspace

#### **Développement Intégré**

- **Vue unifiée** : Tous les composants du projet dans une interface
- **Navigation rapide** : Switching instantané backend ↔ iOS ↔ docs
- **Debug intégré** : Points d'arrêt backend + logs iOS dans VS Code
- **Tâches automatisées** : Build/test/deploy en un clic

#### **Collaboration Équipe**

- **Configuration partagée** : Settings et extensions standardisés
- **Scripts communs** : Procédures développement documentées
- **Documentation intégrée** : Docs techniques accessibles pendant dev
- **Git intégré** : Historique unifié multi-projets

#### **Productivité**

- **Commandes unifiées** : `npm run dev:start` lance tout l'environnement
- **IntelliSense croisé** : Autocomplétion types backend dans iOS
- **Debugging efficace** : Timeline unifiée requêtes backend ↔ iOS
- **Déploiement simplifié** : Staging et production automatisés

Cette structure workspace VS Code optimise le **développement full-stack** de votre application PTT parapente en unifiant backend Cloudflare Workers, application iOS native, **interface d'administration web moderne** et documentation technique dans un environnement de développement professionnel et productif.

## Application d'Administration Web (React + HeroUI + Auth0)

### Vue d'Ensemble - Interface Admin Moderne

L'application d'administration utilise votre **template Vite + React 19 + TailwindCSS v4 + HeroUI 2.8 + Auth0** pour créer une interface de gestion complète du système PTT Parapente.

```mermaid
graph TB
    A[Admin React App] --> B[Auth0 Authentication]
    B --> C[Admin Dashboard]
    C --> D[Gestion Canaux]
    C --> E[Gestion Utilisateurs]
    C --> F[Carte Interactive]
    C --> G[Analytics Temps Réel]
    C --> H[Console Urgences]

    I[Admin API Worker] --> J[Backend PTT]
    A --> I
    I --> K[Base D1 SQLite]

    L[WebSocket Real-time] --> A
    M[Notifications Push] --> A
```

### Fonctionnalités Administration Complètes

#### **1. Dashboard Principal**

```tsx
// admin/client/src/pages/Dashboard.tsx - Dashboard responsive HeroUI
import { Card, CardHeader, CardBody } from "@nextui-org/react";
import { RealtimeStats } from "@/components/analytics/RealtimeStats";

export const Dashboard = () => {
  const { user } = useAuth(); // Auth0 authentication
  const { stats } = useRealtimeData(); // WebSocket data

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 p-6">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
        <CardHeader>Canaux Actifs</CardHeader>
        <CardBody>
          <div className="text-3xl font-bold text-blue-600">
            {stats.activeChannels}
          </div>
          <div className="text-sm text-blue-500">
            +{stats.newChannels} aujourd'hui
          </div>
        </CardBody>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-green-100">
        <CardHeader>Utilisateurs Connectés</CardHeader>
        <CardBody>
          <div className="text-3xl font-bold text-green-600">
            {stats.onlineUsers}
          </div>
          <div className="text-sm text-green-500">
            En vol: {stats.flyingUsers}
          </div>
        </CardBody>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
        <CardHeader>Transmissions PTT</CardHeader>
        <CardBody>
          <div className="text-3xl font-bold text-orange-600">
            {stats.todayTransmissions}
          </div>
          <div className="text-sm text-orange-500">
            Durée moyenne: {stats.avgDuration}s
          </div>
        </CardBody>
      </Card>

      <Card className="bg-gradient-to-br from-red-50 to-red-100">
        <CardHeader>Alertes Urgence</CardHeader>
        <CardBody>
          <div className="text-3xl font-bold text-red-600">
            {stats.emergencyAlerts}
          </div>
          <div className="text-sm text-red-500">
            Dernière: {stats.lastEmergency}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
```

#### **2. Gestion des Canaux PTT**

```tsx
// admin/client/src/components/channels/ChannelForm.tsx - Form HeroUI validation
import { Modal, Button, Input, Select, Textarea } from "@nextui-org/react";
import { useForm } from "react-hook-form";

interface ChannelFormData {
  name: string;
  type: "site_local" | "emergency" | "general";
  coordinates?: { lat: number; lon: number };
  vhfFrequency?: string;
  maxParticipants: number;
  description: string;
}

export const ChannelForm = ({ isOpen, onClose, channel }: ChannelFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChannelFormData>();
  const { createChannel, updateChannel } = useChannels();

  const onSubmit = async (data: ChannelFormData) => {
    try {
      if (channel?.uuid) {
        await updateChannel(channel.uuid, data);
      } else {
        await createChannel(data);
      }
      onClose();
    } catch (error) {
      console.error("Erreur sauvegarde canal:", error);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
        <Input
          label="Nom du Canal"
          placeholder="Ex: Chamonix - Mont Blanc"
          {...register("name", { required: "Le nom est requis" })}
          errorMessage={errors.name?.message}
        />

        <Select
          label="Type de Canal"
          {...register("type", { required: "Le type est requis" })}
        >
          <SelectItem key="site_local" value="site_local">
            Site Local
          </SelectItem>
          <SelectItem key="emergency" value="emergency">
            Urgence
          </SelectItem>
          <SelectItem key="general" value="general">
            Général
          </SelectItem>
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            label="Latitude"
            placeholder="45.929681"
            step="any"
            {...register("coordinates.lat")}
          />
          <Input
            type="number"
            label="Longitude"
            placeholder="6.876345"
            step="any"
            {...register("coordinates.lon")}
          />
        </div>

        <Input
          label="Fréquence VHF (optionnelle)"
          placeholder="144.150 MHz"
          {...register("vhfFrequency")}
        />

        <Input
          type="number"
          label="Participants Maximum"
          defaultValue="50"
          {...register("maxParticipants", { required: true, min: 1, max: 100 })}
        />

        <Textarea
          label="Description"
          placeholder="Description du canal..."
          {...register("description")}
        />

        <div className="flex justify-end gap-2">
          <Button variant="flat" onPress={onClose}>
            Annuler
          </Button>
          <Button type="submit" color="primary">
            {channel ? "Modifier" : "Créer"} Canal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
```

#### **3. Carte Interactive Sites de Vol**

```tsx
// admin/client/src/components/maps/ParapenteMap.tsx - Intégration Mapbox/Leaflet
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Card, Chip, Button } from "@nextui-org/react";
import { useSites } from "@/hooks/useSites";

export const ParapenteMap = () => {
  const { sites, channels } = useSites();
  const [selectedSite, setSelectedSite] = useState<FlyingSite | null>(null);

  return (
    <div className="h-[600px] w-full relative">
      <MapContainer
        center={[45.8326, 6.8652]} // Centre Alpes françaises
        zoom={8}
        className="h-full w-full rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          attribution="Carte: OpenTopoMap"
        />

        {sites.map((site) => (
          <Marker
            key={site.id}
            position={[site.coordinates.lat, site.coordinates.lon]}
            eventHandlers={{
              click: () => setSelectedSite(site),
            }}
          >
            <Popup>
              <div className="p-2 min-w-[250px]">
                <h3 className="font-bold text-lg">{site.name}</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" color="primary">
                      {site.elevation}m
                    </Chip>
                    <Chip
                      size="sm"
                      color={
                        site.difficulty === "beginner"
                          ? "success"
                          : site.difficulty === "intermediate"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {site.difficulty}
                    </Chip>
                  </div>

                  {site.vhfFrequency && (
                    <div className="text-sm text-gray-600">
                      VHF: {site.vhfFrequency} MHz
                    </div>
                  )}

                  <div className="text-sm">
                    <strong>Canaux associés:</strong>
                    <div className="mt-1 space-y-1">
                      {site.channels?.map((channel) => (
                        <div
                          key={channel.uuid}
                          className="flex items-center justify-between"
                        >
                          <span className="text-xs">{channel.name}</span>
                          <Chip size="sm" variant="flat">
                            {channels.find((c) => c.uuid === channel.uuid)
                              ?.participantCount || 0}{" "}
                            users
                          </Chip>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    color="primary"
                    className="w-full mt-2"
                    onPress={() => setSelectedSite(site)}
                  >
                    Voir Détails
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Panel détails site sélectionné */}
      {selectedSite && (
        <Card className="absolute top-4 right-4 w-80 max-h-96 overflow-y-auto">
          <CardHeader>
            <h2 className="text-xl font-bold">{selectedSite.name}</h2>
          </CardHeader>
          <CardBody>{/* Détails complets du site */}</CardBody>
        </Card>
      )}
    </div>
  );
};
```

#### **4. Analytics et Monitoring Temps Réel**

```tsx
// admin/client/src/components/analytics/RealtimeStats.tsx - Graphiques temps réel
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardHeader, CardBody } from "@nextui-org/react";
import { useRealtimeData } from "@/hooks/useRealtimeData";

export const RealtimeStats = () => {
  const {
    transmissionHistory,
    networkQuality,
    activeChannelsData,
    emergencyAlerts,
  } = useRealtimeData(); // WebSocket data

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Transmissions PTT en temps réel */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">
            Transmissions PTT (Dernière Heure)
          </h3>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={transmissionHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0070f3"
                strokeWidth={2}
                dot={{ fill: "#0070f3" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      {/* Qualité réseau par canal */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Qualité Réseau par Canal</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {networkQuality.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-sm text-gray-500">
                    {channel.participantCount} participants
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm">{channel.avgLatency}ms</div>
                  <Chip
                    size="sm"
                    color={
                      channel.quality === "excellent"
                        ? "success"
                        : channel.quality === "good"
                          ? "primary"
                          : channel.quality === "fair"
                            ? "warning"
                            : "danger"
                    }
                  >
                    {channel.quality}
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
```

### Configuration Auth0 Administration

#### Variables Environnement Admin

```bash
# admin/client/.env - Application d'Administration
VITE_APP_TITLE="PTT Parapente - Admin"
VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-admin-client-id
VITE_AUTH0_AUDIENCE=https://ptt-admin-api.example.com
VITE_AUTH0_SCOPE="openid profile email read:admin write:admin manage:channels manage:users"

VITE_API_BASE_URL=https://ptt-backend.your-domain.workers.dev
VITE_ADMIN_API_BASE_URL=https://ptt-admin.your-domain.workers.dev/api
VITE_WS_URL=wss://ptt-backend.your-domain.workers.dev/ws

# Permissions spécifiques admin
VITE_READ_PERMISSION=read:admin
VITE_WRITE_PERMISSION=write:admin
VITE_CHANNEL_MANAGE_PERMISSION=manage:channels
VITE_USER_MANAGE_PERMISSION=manage:users
VITE_EMERGENCY_PERMISSION=emergency:handle

# Configuration carte
VITE_MAPBOX_TOKEN=your-mapbox-token
```

#### Rôles et Permissions Auth0

```json
// Configuration Auth0 - Rôles Admin
{
  "roles": [
    {
      "name": "Super Admin",
      "description": "Accès complet système PTT",
      "permissions": [
        "read:admin",
        "write:admin",
        "manage:channels",
        "manage:users",
        "emergency:handle",
        "system:configure"
      ]
    },
    {
      "name": "Channel Manager",
      "description": "Gestion canaux et sites",
      "permissions": ["read:admin", "manage:channels", "emergency:handle"]
    },
    {
      "name": "User Manager",
      "description": "Gestion utilisateurs",
      "permissions": ["read:admin", "manage:users"]
    },
    {
      "name": "Emergency Operator",
      "description": "Console urgences",
      "permissions": ["read:admin", "emergency:handle"]
    }
  ]
}
```

### API Worker Administration

#### Handler Administration Sécurisé

```typescript
// admin/api-worker/src/handlers/channels.ts
import { validateAuth0Token } from "../utils/auth0";

interface AdminRequest extends Request {
  user?: Auth0User;
}

export async function handleChannelsCRUD(
  request: AdminRequest,
  env: Env
): Promise<Response> {
  // Validation Auth0 + permissions
  const authResult = await validateAuth0Token(request, env);
  if (!authResult.valid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = authResult.user;
  const method = request.method;
  const url = new URL(request.url);

  switch (method) {
    case "GET":
      // Lecture canaux (permission: read:admin)
      if (!user.permissions.includes("read:admin")) {
        return new Response("Forbidden", { status: 403 });
      }
      return await getChannels(env);

    case "POST":
      // Création canal (permission: manage:channels)
      if (!user.permissions.includes("manage:channels")) {
        return new Response("Forbidden", { status: 403 });
      }
      return await createChannel(request, env);

    case "PUT":
      // Modification canal
      if (!user.permissions.includes("manage:channels")) {
        return new Response("Forbidden", { status: 403 });
      }
      const channelId = url.pathname.split("/").pop();
      return await updateChannel(channelId, request, env);

    case "DELETE":
      // Suppression canal (Super Admin uniquement)
      if (!user.permissions.includes("system:configure")) {
        return new Response("Forbidden", { status: 403 });
      }
      const deleteChannelId = url.pathname.split("/").pop();
      return await deleteChannel(deleteChannelId, env);

    default:
      return new Response("Method Not Allowed", { status: 405 });
  }
}

async function getChannels(env: Env) {
  // Récupération tous canaux avec stats
  const channels = await env.DB.prepare(
    `
    SELECT 
      c.*,
      COUNT(p.user_id) as current_participants,
      AVG(p.connection_quality) as avg_quality,
      MAX(m.timestamp) as last_activity
    FROM channels c
    LEFT JOIN channel_participants p ON c.uuid = p.channel_uuid  
    LEFT JOIN channel_messages m ON c.uuid = m.channel_uuid
    GROUP BY c.uuid
    ORDER BY c.name
  `
  ).all();

  return new Response(
    JSON.stringify({
      channels: channels.results,
      totalCount: channels.results.length,
      timestamp: Date.now(),
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

#### Configuration wrangler.toml Admin API

```toml
# admin/api-worker/wrangler.toml
name = "ptt-admin-api"
main = "src/index.ts"
compatibility_date = "2024-01-15"

[env.development]
name = "ptt-admin-api-dev"

[env.staging]
name = "ptt-admin-api-staging"

[env.production]
name = "ptt-admin-api-prod"

# Bindings base de données commune
[[env.development.d1_databases]]
binding = "DB"
database_name = "ptt-parapente-dev"
database_id = "your-d1-database-dev-id"

[[env.production.d1_databases]]
binding = "DB"
database_name = "ptt-parapente-prod"
database_id = "your-d1-database-prod-id"

# Variables Auth0 admin
[env.development.vars]
AUTH0_DOMAIN = "your-domain.auth0.com"
AUTH0_ADMIN_AUDIENCE = "https://ptt-admin-api.example.com"

[env.production.vars]
AUTH0_DOMAIN = "your-domain.auth0.com"
AUTH0_ADMIN_AUDIENCE = "https://ptt-admin-api.example.com"

# Secrets (à définir via wrangler secret)
# AUTH0_ADMIN_SECRET (JWK Set URL ou secret partagé)
```

### Structure Finale Admin

#### Arborescence Complète

```
admin/
├── client/                          # Application React admin
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/               # Composants Auth0
│   │   │   ├── channels/           # Gestion canaux
│   │   │   ├── users/              # Gestion utilisateurs
│   │   │   ├── maps/               # Carte interactive
│   │   │   ├── analytics/          # Graphiques temps réel
│   │   │   └── emergency/          # Console urgences
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx       # Dashboard principal
│   │   │   ├── Channels.tsx        # Liste/CRUD canaux
│   │   │   ├── Users.tsx           # Gestion utilisateurs
│   │   │   ├── Analytics.tsx       # Analytics avancées
│   │   │   └── Emergency.tsx       # Console urgences
│   │   ├── hooks/
│   │   │   ├── useAuth.ts          # Auth0 authentication
│   │   │   ├── useChannels.ts      # CRUD canaux
│   │   │   ├── useRealtimeData.ts  # WebSocket data
│   │   │   └── useSites.ts         # Sites de vol
│   │   ├── types/
│   │   │   └── admin.ts            # Types TypeScript admin
│   │   └── utils/
│   │       ├── api.ts              # API client
│   │       └── auth0-config.ts     # Configuration Auth0
│   ├── package.json                # Dépendances React 19 + HeroUI
│   ├── vite.config.ts              # Configuration Vite
│   ├── tailwind.config.ts          # TailwindCSS v4
│   └── .env.example                # Variables environnement
│
├── api-worker/                      # API Worker Cloudflare
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── channels.ts         # CRUD canaux
│   │   │   ├── users.ts            # Gestion utilisateurs
│   │   │   ├── analytics.ts        # Endpoints analytics
│   │   │   └── emergency.ts        # Gestion urgences
│   │   ├── utils/
│   │   │   ├── auth0.ts            # Validation tokens Auth0
│   │   │   └── permissions.ts      # Gestion permissions
│   │   └── index.ts                # Router principal
│   ├── package.json                # Dépendances Worker
│   └── wrangler.toml               # Configuration Cloudflare
│
└── shared/                          # Types partagés
    └── types.ts                     # Interfaces communes
```

### Déploiement et Monitoring

#### Configuration Production

```bash
# Commandes déploiement
wrangler deploy --env production
wrangler tail --env production  # Logs temps réel
wrangler d1 execute PTT_DB --file migrations/001_initial_schema.sql
wrangler kv:namespace create PTT_KV --env production
```

#### Monitoring Santé Service

```typescript
// Endpoint santé avec métriques
app.get("/health", async (request, env) => {
  const checks = {
    database: await checkDatabaseHealth(env.DB),
    kv: await checkKVHealth(env.PTT_KV),
    durableObjects: await checkDurableObjectsHealth(env.CHANNEL_OBJECTS),
  };

  const isHealthy = Object.values(checks).every(
    (check) => check.status === "ok"
  );

  return new Response(
    JSON.stringify({
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      version: "1.0.0",
      region: process.env.CF_RAY?.split("-")[1] || "unknown",
    }),
    {
      status: isHealthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    }
  );
});
```

### Avantages Architecture Backend

#### Scalabilité Automatique

- **Auto-scaling** : Cloudflare Workers s'adaptent automatiquement à la charge
- **Edge Computing** : Latence minimisée par déploiement global
- **Isolation par Canal** : Chaque canal PTT est un Durable Object indépendant
- **Persistence SQLite** : État partagé temps réel entre utilisateurs

#### Économique Plan Gratuit

- **100,000 requêtes/jour** : Suffisant pour groupes parapentistes
- **Durable Objects gratuits** : 1 GB stockage + calcul inclus
- **KV Store** : Cache efficace pour données statiques
- **D1 SQLite** : 5 GB base de données gratuite

#### Robustesse Parapente

- **Tolérance Pannes** : Redondance automatique Cloudflare
- **Géo-Distribution** : Serveurs proches utilisateurs montagne
- **Faible Latence** : Critical pour communications PTT temps réel
- **Surveillance Automatique** : Alertes et métriques intégrées

Cette architecture backend Cloudflare Workers avec Durable Objects offre une **solution robuste, scalable et économique** parfaitement adaptée aux besoins spécialisés de communication PTT pour parapentistes, tout en respectant les contraintes du plan gratuit et en fournissant les performances temps réel nécessaires pour une utilisation sécuritaire en montagne.

---

## Conclusion

Cette application iOS Push-to-Talk pour parapentistes représente un projet techniquement ambitieux mais réalisable, tirant parti des derniers frameworks d'Apple pour créer un **système de communication hybride complémentaire aux radios VHF/UHF traditionnelles**.

### Points Clés de Réussite

Le succès dépend d'une attention particulière à :

- **Gestion session audio optimisée** pour environnement bruyant (vent)
- **Synchronisation d'état robuste** avec gestion mode dégradé
- **Conception UX adaptée vol** (gants, une main, plein soleil)
- **Intégration géolocalisation intelligente** pour sélection automatique canaux
- **Formation utilisateurs** sur l'usage complémentaire VHF/4G

### Architecture Modulaire Évolutive

L'architecture modulaire proposée permet :

- Développement itératif avec validation terrain continue
- Extension future des fonctionnalités (météo, traces GPS, etc.)
- Maintien qualité code et standards de performance
- Intégration progressive avec écosystème parapente existant

### Valeur Ajoutée Spécialisée

L'application apporte une **réelle valeur ajoutée** au monde du parapente :

- **Extension portée communication** au-delà des limitations VHF/UHF
- **Qualité audio numérique** supérieure aux radios analogiques
- **Géolocalisation intégrée** pour coordination groupes dispersés
- **Système d'urgence évolué** avec localisation précise
- **Communication inter-sites** pour cross-country et compétitions

### Vision Hybride Innovante

Cette approche **hybride VHF/4G** est innovante car elle :

- Reconnaît les forces et faiblesses de chaque technologie
- Propose une solution pragmatique pour parapentistes
- Maintient la sécurité par redondance des systèmes
- Prépare l'évolution vers communications numériques tout en conservant la robustesse analogique

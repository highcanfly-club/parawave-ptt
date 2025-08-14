# Créer une application Push to Talk

Construisez une application de type talkie-walkie avec des contrôles d'interface utilisateur système.

## Vue d'ensemble

Le framework Push to Talk (PTT) facilite la communication avec un groupe d'individus presque instantanément en appuyant sur un bouton. Le framework fournit à votre application des contrôles d'interface utilisateur système, ainsi que la gestion des événements de canal. Gérez les notifications push et les événements comme le début ou la fin de la transmission audio, et lorsqu'une personne rejoint ou quitte un canal.

PTT fournit l'interface, et vous fournissez le service de communication backend. Sa flexibilité le rend compatible avec vos solutions de communication de bout en bout existantes et votre infrastructure backend. Utilisez PTT pour intégrer des accessoires Bluetooth qui déclenchent l'enregistrement et la transmission audio.

### Configurer votre projet Xcode

Pour commencer à utiliser le framework PTT, configurez Xcode avec les étapes suivantes :

1. Choisissez votre projet de niveau supérieur dans le navigateur de projet Xcode.

2. Pour la cible de votre projet, choisissez Signing & Capabilities.

3. Choisissez Editor > Add Capability, sélectionnez Background Modes, et sélectionnez Push to Talk dans la liste des modes.

4. Choisissez Editor > Add Capability et sélectionnez Push to Talk.

5. Choisissez Editor > Add Capability et sélectionnez Push Notifications.

6. Cliquez sur Info, développez la section Custom iOS Target Properties, survolez une ligne avec votre pointeur et cliquez sur le bouton Ajouter (+). Entrez le nom de clé `NSMicrophoneUsageDescription` et une valeur de chaîne qui explique pourquoi l'application demande l'accès au microphone de l'appareil.

### Rejoindre un canal

Un canal représente et décrit la session PTT au système. Les applications interagissent avec les canaux via un `PTChannelManager`, qui est l'interface principale pour rejoindre des canaux et effectuer des actions comme transmettre et recevoir de l'audio. Plusieurs appels à `channelManager(delegate:restorationDelegate:completionHandler:)` renvoient la même instance partagée par le système, donc stockez le gestionnaire de canal dans une variable d'instance.

```swift
// Créer une instance de gestionnaire de canal.
channelManager = try await PTChannelManager.channelManager(delegate: self,
                                                           restorationDelegate: self)
```

Initialisez le gestionnaire de canal dès que possible au démarrage pour vous assurer que le framework puisse restaurer les canaux existants et délivrer les notifications push à l'application.

Un `PTChannelDescriptor` décrit le canal au système afin qu'il puisse présenter des détails — comme le nom et l'image du canal — dans l'interface utilisateur du système.

```swift
// Créer un descripteur qu'une application utilise pour rejoindre un canal.
let channelImage = UIImage(named: "ChannelImage")
channelDescriptor = PTChannelDescriptor(name: "The channel name",
                                        image: channelImage)
```

Le framework utilise des ressources système partagées, donc un seul canal PTT peut être actif sur le système à la fois. Pour rejoindre un canal, appelez `requestJoinChannel(channelUUID:descriptor:)`. Le système utilise le même identifiant unique lors de l'interaction avec le gestionnaire tout au long de la vie du canal, donc lors de la jonction à un canal, stockez le descripteur et l'UUID pour une utilisation ultérieure.

```swift
// Rejoindre un canal avec un identifiant unique et un descripteur.
channelManager.requestJoinChannel(channelUUID: channelUUID,
                                  descriptor: channelDescriptor)
```

**Important** : Une personne ne peut rejoindre un canal que lorsqu'une application PTT s'exécute au premier plan — avec une interaction utilisateur explicite — donc les applications doivent fournir des boutons pour permettre à une personne de rejoindre et de quitter un canal.

Après l'initialisation du gestionnaire de canal, le framework fournit un jeton d'appareil APNs éphémère dans `channelManager(_:receivedEphemeralPushToken:)`. Obtenez le jeton push de longueur variable et envoyez-le au serveur de l'application. Le jeton n'est pas actif jusqu'à ce qu'une personne rejoigne le canal. S'ils quittent le canal, attendez qu'ils rejoignent à nouveau pour reprendre les notifications.

Rejoindre un canal peut échouer lorsqu'un autre canal est déjà actif. En cas d'échec, le framework appelle la méthode déléguée `channelManager(_:failedToJoinChannel:error:)` et contient un `PTChannelError.Code`.

### Restaurer un canal actif

Lorsque le système termine une application ou qu'une personne redémarre l'appareil, l'application doit restaurer les canaux actifs. Fournissez un descripteur de canal pour mettre à jour le système dans le `PTChannelRestorationDelegate`. Le système n'appelle la méthode déléguée de restauration que lorsqu'il est incapable d'utiliser les données qu'il met en cache pour restaurer un canal.

```swift
// Restaurer un canal actif après le relancement.
func channelDescriptor(restoredChannelUUID channelUUID: UUID) -> PTChannelDescriptor {
    let descriptor = // Obtenir un descripteur mis en cache pour l'identifiant unique du canal.
    return descriptor
}
```

Pour garder le système réactif, revenez de `channelDescriptor(restoredChannelUUID:)` dès que possible. N'effectuez pas de tâches longues ou bloquantes — comme des requêtes réseau — pour récupérer un descripteur.

### Définir le mode de transmission du canal

Après avoir rejoint un canal, définissez le mode de transmission du canal pour indiquer quand l'utilisateur peut transmettre de l'audio. Le mode de transmission par défaut est `PTTransmissionMode.halfDuplex`, indiquant qu'un seul participant peut envoyer ou recevoir de l'audio à la fois. Le système empêche une personne de transmettre de l'audio pendant qu'elle reçoit de l'audio d'un participant distant.

Utilisez `PTTransmissionMode.fullDuplex` pour permettre à une personne de transmettre et de recevoir de l'audio simultanément. En mode full-duplex, le système permet à une personne de commencer à transmettre même si elle reçoit de l'audio.

```swift
try await channelManager.setTransmissionMode(.fullDuplex,
                                             channelUUID: channelUUID)
```

Définissez le mode de transmission sur `PTTransmissionMode.listenOnly` pour empêcher un participant de transmettre de l'audio.

### Signaler l'état du service

S'il y a des perturbations du service de plateforme, signalez l'état du service via le gestionnaire de canal. Par exemple, s'il y a une panne de réseau, signalez que la connexion est `PTServiceStatus.connecting`.

```swift
await channelManager.setServiceStatus(.connecting,
                                      channelUUID: channelUUID)
```

Lorsque le réseau est dans un état restauré, définissez l'état du service sur `PTServiceStatus.ready`.

### Transmettre de l'audio

Le framework offre de la flexibilité dans la façon dont les applications gèrent la transmission audio et permet la compatibilité avec d'autres plateformes. Les applications implémentent leur propre processus d'encodage et de streaming audio pour transmettre de l'audio entre les utilisateurs. Démarrez les transmissions PTT depuis l'interface utilisateur système ou en appelant `requestBeginTransmitting(channelUUID:)`. Commencez la transmission lorsque l'application s'exécute au premier plan ou suite à un changement de caractéristique d'un appareil Core Bluetooth.

Le système interprète automatiquement les événements de lecture ou de pause des casques filaires et des appareils CarPlay lorsque le système a un canal PTT actif. Les événements entraînent des événements de début ou de fin de transmission dans le framework PTT.

Pour commencer une transmission, appelez `requestBeginTransmitting(channelUUID:)` avec un identifiant de canal unique.

```swift
// Commencer à transmettre vers un canal.
channelManager.requestBeginTransmitting(channelUUID: channelUUID)
```

Lorsque la demande de commencer à transmettre réussit, le framework appelle `channelManager(_:channelUUID:didBeginTransmittingFrom:)`. Le framework appelle également cette méthode si la transmission commence depuis l'interface utilisateur système.

```swift
// La transmission commence depuis la source de demande.
func channelManager(_ channelManager: PTChannelManager,
                    channelUUID: UUID,
                    didBeginTransmittingFrom source: PTChannelTransmitRequestSource) {
    // Commencer à se reconnecter à l'infrastructure backend des services PTT de l'application
    // et signaler que l'utilisateur commence à transmettre.
}
```

Avant d'enregistrer et de transmettre de l'audio, attendez que le framework appelle `channelManager(_:didActivate:)`. Le framework appelle la méthode lorsque la session audio est active. Cela permet d'enregistrer de l'audio même si l'application est en arrière-plan. Le framework n'appelle pas la méthode si le mode de transmission du canal est `PTTransmissionMode.fullDuplex` et a déjà une session audio active, car l'application reçoit de l'audio d'un participant distant lorsqu'une transmission commence.

```swift
// La session audio est dans un état actif et prête à être utilisée.
func channelManager(_ channelManager: PTChannelManager,
                    didActivate audioSession: AVAudioSession) {
    // Configurer la session audio et commencer l'enregistrement.
}
```

**Important** : Laissez le système activer et désactiver la session audio pour garantir qu'elle a la priorité appropriée dans le système.

Le système fournit des effets sonores intégrés pour indiquer que le microphone est dans un état activé ou désactivé. Ne fournissez pas d'effets sonores pour ces événements. Le framework ne prend pas en charge les effets sonores personnalisés.

Si le système ne peut pas commencer la transmission — par exemple, si une personne a un appel cellulaire actif — le framework appelle `channelManager(_:failedToBeginTransmittingInChannel:error:)`.

Lorsque la transmission se termine, le framework appelle `channelManager(_:channelUUID:didEndTransmittingFrom:)` et `channelManager(_:didDeactivate:)`. Le système renvoie ensuite l'application à un état suspendu si elle s'exécute en arrière-plan. Utilisez `beginBackgroundTask(expirationHandler:)` pour demander du temps d'exécution supplémentaire pour mettre à jour le serveur de l'application.

### Recevoir de l'audio

Le framework introduit un nouveau type APNs pour les applications PTT. Lorsque le serveur d'une application a un nouvel audio à recevoir pour une personne, il envoie une notification PTT en utilisant le jeton push de l'appareil que l'application reçoit lors de la jonction à un canal. Un jeton n'est actif que pour la durée de vie d'un canal, donc une application reçoit un nouveau jeton chaque fois qu'elle rejoint un nouveau canal.

Définissez le type de push APNs sur `pushtotalk` dans l'en-tête de la requête, et l'en-tête de sujet sur l'identifiant de bundle de l'application avec le suffixe `.voip-ptt`. La charge utile peut contenir des clés personnalisées, comme le nom d'un locuteur actif ou une indication que la session s'est terminée. Définissez la priorité APNs sur `10` pour demander une livraison immédiate, et définissez une expiration de `0` pour empêcher le système de délivrer des pushs plus anciens.

```shell
curl -v \
    -d '{"activeSpeaker":"The name of the active speaker"}' \
    -H "apns-push-type: pushtotalk" \
    -H "apns-topic: <The app bundle id>.voip-ptt" \
    -H "apns-priority: 10" \
    -H "apns-expiration: 0" \
    --http2 \
    --cert <The certificate key name>.pem \
    https://api.sandbox.push.apple.com/3/device/<token>
```

Lorsque le serveur de l'application envoie une notification PTT, le système démarre l'application en arrière-plan et appelle `incomingPushResult(channelManager:channelUUID:pushPayload:)`. Lorsqu'une application reçoit une charge utile push, elle construit un type de résultat push pour indiquer quelle action effectuer.

```swift
func incomingPushResult(channelManager: PTChannelManager,
                        channelUUID: UUID,
                        pushPayload: [String: Any]) -> PTPushResult {
    guard let activeSpeaker = pushPayload["activeSpeaker"] as? String else {
        // Signaler qu'il n'y a pas de locuteur actif, donc quitter le canal.
        return .leaveChannel
    }

    let activeSpeakerImage = // Obtenir l'image mise en cache pour le locuteur actif.
    let participant = PTParticipant(name: activeSpeaker,
                                    image: activeSpeakerImage)
    // Signaler les informations du participant actif au système.
    return .activeRemoteParticipant(participant)
}
```

Retournez un `PTPushResult` dès que possible et ne bloquez pas le thread. Effectuez des tâches réseau — comme télécharger l'image d'un locuteur ou configurer une connexion réseau de streaming vers un serveur — sur un thread séparé.

Après avoir défini `activeRemoteParticipant(_:)`, le système active la session audio de l'application et appelle la méthode `channelManager(_:didActivate:)`. Lorsque la session audio de l'application est dans un état actif, commencez à lire l'audio qu'elle reçoit du serveur de l'application.

Si le mode de transmission du canal PTT est `PTTransmissionMode.halfDuplex`, et que le participant local transmet lorsque l'application reçoit une notification PTT, retourner un participant actif entraîne une erreur. Terminez la transmission du participant local en appelant `stopTransmitting(channelUUID:)` avant de retourner un participant distant actif. Le système regroupe ces opérations — sans désactiver la session audio — afin qu'une application puisse immédiatement commencer à lire l'audio qu'elle reçoit d'un participant distant.

Lorsqu'une application est au premier plan, elle peut recevoir et mettre en file d'attente des messages pour la lecture tout en lisant des messages qu'elle a précédemment reçus.

Lorsqu'un participant distant termine de parler, définissez `setActiveRemoteParticipant(_:channelUUID:completionHandler:)` sur `nil` pour indiquer que l'application ne reçoit plus d'audio sur le canal et que le système peut désactiver la session audio. Cette action met à jour l'interface utilisateur du système et permet à l'utilisateur de transmettre à nouveau.

### Réduire la latence réseau et gérer les interruptions audio

Pour réduire les étapes nécessaires pour établir une connexion TLS sécurisée et améliorer la vitesse de connexion initiale, utilisez le framework Network et implémentez `QUIC`. Pour plus d'informations sur `QUIC`, voir QUIC Options.

Le système donne la priorité aux communications des appels cellulaires, FaceTime et VoIP, donc les applications PTT doivent répondre en conséquence et gérer les échecs avec élégance. Surveillez et répondez aux notifications `AVAudioSession`, telles que les interruptions de session, les changements de route et les échecs. Pour plus d'informations sur la gestion des interruptions, voir Handling audio interruptions.

### Gérer plusieurs conversations Push to Talk

Pour prendre en charge des conversations simultanées, rejoignez un seul canal et mettez à jour le descripteur de canal pour refléter la conversation active. Appelez `setChannelDescriptor(_:channelUUID:completionHandler:)` pour mettre à jour l'interface utilisateur du système lorsque la conversation active change.

Lorsqu'une application est en train de recevoir de l'audio, utilisez `setActiveRemoteParticipant(_:channelUUID:completionHandler:)` pour mettre à jour l'interface utilisateur du système avec de nouveaux détails sur le participant lorsque le locuteur de la conversation change. Cela élimine le besoin d'envoyer une nouvelle notification APNs.

## Voir aussi

### Éléments essentiels

**class PTChannelManager**
Un objet qui représente un gestionnaire de canal push-to-talk.

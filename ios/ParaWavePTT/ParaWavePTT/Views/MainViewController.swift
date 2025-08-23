import UIKit
import SwiftUI
import PushToTalk
import AVFoundation

//
// Copyright © 2025 Ronan Le Meillat
// Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// See: https://www.gnu.org/licenses/agpl-3.0.en.html
//
// Main controller for the hybrid UIKit/SwiftUI user interface
class MainViewController: UIViewController {
    
    // MARK: - Properties
    
    private var hostingController: UIHostingController<ContentView>?
    private var pttButton: PTTButton?
    private var volumeButtonHandler: VolumeButtonHandler?
    
    // Managers
    private let stateManager = ParapenteStateManager()
    private let networkService = ParapenteNetworkService()
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupVolumeButtons()
        setupNotifications()
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
    // Initialize services
        Task {
            await stateManager.initialize(networkService: networkService)
        }
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Embed the SwiftUI view
        let contentView = ContentView()
        hostingController = UIHostingController(rootView: contentView)
        
        guard let hostingController = hostingController else { return }
        
        addChild(hostingController)
        view.addSubview(hostingController.view)
        
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        
        hostingController.didMove(toParent: self)
        
    // Add physical PTT button if necessary
        setupPTTButton()
    }
    
    private func setupPTTButton() {
        // Custom PTT button for cases where the native framework is insufficient
        pttButton = PTTButton(frame: CGRect(x: 0, y: 0, width: 100, height: 100))
        pttButton?.center = CGPoint(x: view.bounds.midX, y: view.bounds.maxY - 150)
        pttButton?.delegate = self
    pttButton?.isHidden = true // Hidden by default, used only if needed
        
        if let pttButton = pttButton {
            view.addSubview(pttButton)
        }
    }
    
    private func setupVolumeButtons() {
    // Configure volume buttons for PTT
        volumeButtonHandler = VolumeButtonHandler()
        volumeButtonHandler?.delegate = self
    }
    
    private func setupNotifications() {
    // Observe application state changes
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
    // Observe audio interruptions
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioInterruption),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }
    
    // MARK: - Notification Handlers
    
    @objc private func appDidEnterBackground() {
        stateManager.handleAppDidEnterBackground()
    }
    
    @objc private func appWillEnterForeground() {
        stateManager.handleAppWillEnterForeground()
    }
    
    @objc private func handleAudioInterruption(notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }
        
        switch type {
        case .began:
            // Interruption began - stop transmission
            Task {
                await stateManager.stopTransmission()
            }
        case .ended:
            // Interruption ended - resume if appropriate
            if let optionsValue = info[AVAudioSessionInterruptionOptionKey] as? UInt {
                let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
                if options.contains(.shouldResume) {
                        // Resume audio if appropriate
                }
            }
        @unknown default:
            break
        }
    }
}

// MARK: - PTTButtonDelegate

extension MainViewController: PTTButtonDelegate {
    
    func pttButtonPressed() {
        print("PTT button pressed")
        
        Task {
            await stateManager.startTransmission()
        }
    }
    
    func pttButtonReleased() {
        print("PTT button released")
        
        Task {
            await stateManager.stopTransmission()
        }
    }
}

// MARK: - VolumeButtonHandlerDelegate

extension MainViewController: VolumeButtonHandlerDelegate {
    
    func volumeUpPressed() {
    // Use the volume up button for PTT in alternate mode
        pttButtonPressed()
    }
    
    func volumeUpReleased() {
        pttButtonReleased()
    }
    
    func volumeDownPressed() {
    // The volume down button can be used for alternative functions
    // For example, switch channel quickly
    print("Volume down pressed - alternative function")
    }
    
    func volumeDownReleased() {
        print("Volume down released")
    }
}

// MARK: - Custom PTT Button

protocol PTTButtonDelegate: AnyObject {
    func pttButtonPressed()
    func pttButtonReleased()
}

class PTTButton: UIButton {
    
    weak var delegate: PTTButtonDelegate?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupButton()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupButton()
    }
    
    private func setupButton() {
    // Visual configuration
        backgroundColor = .systemBlue
        layer.cornerRadius = frame.width / 2
        
        setTitle("PTT", for: .normal)
        setTitleColor(.white, for: .normal)
        titleLabel?.font = .boldSystemFont(ofSize: 18)
        
    // Shadow
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOffset = CGSize(width: 0, height: 2)
        layer.shadowOpacity = 0.3
        layer.shadowRadius = 4
        
    // Touch event handling
        addTarget(self, action: #selector(buttonPressed), for: .touchDown)
        addTarget(self, action: #selector(buttonReleased), for: [.touchUpInside, .touchUpOutside, .touchCancel])
    }
    
    @objc private func buttonPressed() {
    // Visual animation
        UIView.animate(withDuration: 0.1) {
            self.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
            self.backgroundColor = .systemBlue.withAlphaComponent(0.8)
        }
        
    // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
        
        delegate?.pttButtonPressed()
    }
    
    @objc private func buttonReleased() {
    // Release animation
        UIView.animate(withDuration: 0.1) {
            self.transform = .identity
            self.backgroundColor = .systemBlue
        }
        
        delegate?.pttButtonReleased()
    }
}

// MARK: - Volume Button Handler

protocol VolumeButtonHandlerDelegate: AnyObject {
    func volumeUpPressed()
    func volumeUpReleased()
    func volumeDownPressed()
    func volumeDownReleased()
}

class VolumeButtonHandler: NSObject {
    
    weak var delegate: VolumeButtonHandlerDelegate?
    
    private var volumeView: MPVolumeView?
    private var isMonitoringVolume = false
    private var currentVolume: Float = 0.5
    
    override init() {
        super.init()
        setupVolumeMonitoring()
    }
    
    private func setupVolumeMonitoring() {
    // Create an invisible volume view to intercept hardware buttons
        volumeView = MPVolumeView(frame: CGRect(x: -1000, y: -1000, width: 1, height: 1))
        volumeView?.showsVolumeSlider = false
        volumeView?.showsRouteButton = false
        volumeView?.isUserInteractionEnabled = false
        
        if let volumeView = volumeView {
            // Add it to a window so it becomes active
            if let keyWindow = UIApplication.shared.windows.first {
                keyWindow.addSubview(volumeView)
            }
        }
        
    // Observe system volume changes
        do {
            try AVAudioSession.sharedInstance().setActive(true)
            currentVolume = AVAudioSession.sharedInstance().outputVolume
        } catch {
            print("Error configuring audio session for volume buttons: \(error)")
        }
        
        // Observer les changements de volume système
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(volumeChanged),
            name: NSNotification.Name(rawValue: "AVSystemController_SystemVolumeDidChangeNotification"),
            object: nil
        )
    }
    
    @objc private func volumeChanged(notification: NSNotification) {
        guard let userInfo = notification.userInfo,
              let volumeChangeType = userInfo["AVSystemController_AudioVolumeChangeReasonNotificationParameter"] as? String else {
            return
        }
        
        let newVolume = AVAudioSession.sharedInstance().outputVolume
        
    // Detect if this is a physical button press
        if volumeChangeType == "ExplicitVolumeChange" {
            if newVolume > currentVolume {
                delegate?.volumeUpPressed()
                
                // Schedule release after a short delay
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    self.delegate?.volumeUpReleased()
                }
            } else if newVolume < currentVolume {
                delegate?.volumeDownPressed()
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    self.delegate?.volumeDownReleased()
                }
            }
        }
        
        currentVolume = newVolume
    }
    
        deinit {
        volumeView?.removeFromSuperview()
        NotificationCenter.default.removeObserver(self)
    }
}

// MARK: - Extensions

extension MainViewController {
    
    /// Configure the UI for different application states
    func updateUIForState(_ state: ParapenteAppState) {
        DispatchQueue.main.async {
            switch state {
            case .transmissionActive:
                self.pttButton?.isHidden = false
                self.pttButton?.backgroundColor = .systemRed
                self.pttButton?.setTitle("ACTIVE", for: .normal)
                
            case .canalRejoint:
                self.pttButton?.isHidden = false
                self.pttButton?.backgroundColor = .systemBlue
                self.pttButton?.setTitle("PTT", for: .normal)
                
            default:
                self.pttButton?.isHidden = true
            }
        }
    }
    
    /// Show a system alert
    func showAlert(title: String, message: String, completion: (() -> Void)? = nil) {
        DispatchQueue.main.async {
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                completion?()
            })
            
            self.present(alert, animated: true)
        }
    }
    
    /// Configure appearance for different modes (day/night, flight, etc.)
    func configureAppearanceForFlightMode(_ enabled: Bool) {
        if enabled {
            // Flight mode - UI optimized for outdoor visibility
            overrideUserInterfaceStyle = .light  // Forcer le mode clair pour la visibilité
            view.backgroundColor = .white
            
            // Increase screen brightness
            UIScreen.main.brightness = min(UIScreen.main.brightness + 0.2, 1.0)
            
        } else {
            // Mode normal
            overrideUserInterfaceStyle = .unspecified
            view.backgroundColor = .systemBackground
        }
    }
}

// MARK: - Debug Extensions

#if DEBUG
extension MainViewController {
    
    /// Méthodes de debug pour le développement
    func debugAddTestButtons() {
        let testStackView = UIStackView()
        testStackView.axis = .horizontal
        testStackView.spacing = 10
        testStackView.translatesAutoresizingMaskIntoConstraints = false
        
        // Bouton de test d'authentification
        let authButton = UIButton(type: .system)
        authButton.setTitle("Test Auth", for: .normal)
        authButton.addTarget(self, action: #selector(debugTestAuth), for: .touchUpInside)
        
        // Bouton de test d'erreur
        let errorButton = UIButton(type: .system)
        errorButton.setTitle("Test Error", for: .normal)
        errorButton.addTarget(self, action: #selector(debugTestError), for: .touchUpInside)
        
        testStackView.addArrangedSubview(authButton)
        testStackView.addArrangedSubview(errorButton)
        
        view.addSubview(testStackView)
        NSLayoutConstraint.activate([
            testStackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            testStackView.centerXAnchor.constraint(equalTo: view.centerXAnchor)
        ])
    }
    
    @objc private func debugTestAuth() {
        stateManager.debugSimulateSuccessfulAuth()
    }
    
    @objc private func debugTestError() {
        stateManager.debugSimulateError()
    }
}
#endif

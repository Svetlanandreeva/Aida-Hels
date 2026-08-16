import Foundation
import React

/// React Native bridge used by the Expo/RN shell. The web build never imports
/// HealthKit; on iOS this bridge calls the same coordinator used by a native UI.
@objc(AidaHealthKitBridge)
final class AidaHealthKitBridge: NSObject, RCTBridgeModule {
    @MainActor private lazy var coordinator = AidaHealthSyncCoordinator()

    static func moduleName() -> String! { "AidaHealthKit" }
    static func requiresMainQueueSetup() -> Bool { true }

    @objc(connect:bearerToken:resolver:rejecter:)
    func connect(
        _ profileId: String,
        bearerToken: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            do {
                try await coordinator.connect(profileId: profileId, bearerToken: bearerToken)
                resolve(["connected": true, "lastSyncAt": coordinator.lastSyncAt?.timeIntervalSince1970 as Any])
            } catch {
                reject("healthkit_connect_failed", String(describing: error), error)
            }
        }
    }

    @objc(sync:bearerToken:resolver:rejecter:)
    func sync(
        _ profileId: String,
        bearerToken: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            do {
                try await coordinator.sync(profileId: profileId, bearerToken: bearerToken)
                resolve(["ok": true, "lastSyncAt": coordinator.lastSyncAt?.timeIntervalSince1970 as Any])
            } catch {
                reject("healthkit_sync_failed", String(describing: error), error)
            }
        }
    }

    @objc(disconnect:rejecter:)
    func disconnect(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            coordinator.disconnect()
            resolve(["connected": false])
        }
    }
}

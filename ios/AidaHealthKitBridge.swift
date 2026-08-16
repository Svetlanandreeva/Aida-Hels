import Foundation
import HealthKit
import React

/// React Native bridge used by the Expo/RN shell. The web build never imports
/// HealthKit; on iOS this bridge calls the same coordinator used by a native UI.
@objc(AidaHealthKitBridge)
final class AidaHealthKitBridge: NSObject, RCTBridgeModule {
    @MainActor private lazy var coordinator = AidaHealthSyncCoordinator()
    private let healthStore = HKHealthStore()

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

    @objc(requestMedicationAccess:rejecter:)
    func requestMedicationAccess(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard HKHealthStore.isHealthDataAvailable() else {
            reject("healthkit_unavailable", "Apple Health is not available on this device", nil)
            return
        }
        guard #available(iOS 26.0, *) else {
            reject("medications_api_unavailable", "Apple Health medication import requires iOS 26 or newer", nil)
            return
        }

        let type = HKObjectType.userAnnotatedMedicationType()
        healthStore.requestPerObjectReadAuthorization(for: type, predicate: nil) { success, error in
            if let error {
                reject("medications_authorization_failed", error.localizedDescription, error)
                return
            }
            resolve(["granted": success])
        }
    }

    @objc(listMedications:rejecter:)
    func listMedications(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard HKHealthStore.isHealthDataAvailable() else {
            reject("healthkit_unavailable", "Apple Health is not available on this device", nil)
            return
        }
        guard #available(iOS 26.0, *) else {
            reject("medications_api_unavailable", "Apple Health medication import requires iOS 26 or newer", nil)
            return
        }

        Task {
            do {
                let descriptor = HKUserAnnotatedMedicationQueryDescriptor(predicate: nil, limit: nil)
                let medications = try await descriptor.result(for: healthStore)
                let payload: [[String: Any]] = medications.map { item in
                    let concept = item.medication
                    let codings = concept.relatedCodings
                        .sorted { lhs, rhs in
                            if lhs.system == rhs.system { return lhs.code < rhs.code }
                            return lhs.system < rhs.system
                        }
                        .map { coding in
                            [
                                "system": coding.system,
                                "code": coding.code,
                                "version": coding.version as Any,
                            ] as [String: Any]
                        }
                    let rxNorm = concept.relatedCodings.first { coding in
                        coding.system.lowercased().contains("rxnorm")
                    }?.code
                    let codingKey = codings
                        .compactMap { row -> String? in
                            guard let system = row["system"] as? String, let code = row["code"] as? String else { return nil }
                            return "\(system)|\(code)"
                        }
                        .joined(separator: ";")
                    let externalId = codingKey.isEmpty
                        ? "apple-health:\(concept.displayText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())"
                        : "apple-health:\(codingKey)"

                    return [
                        "external_id": externalId,
                        "display_text": concept.displayText,
                        "nickname": item.nickname as Any,
                        "is_archived": item.isArchived,
                        "has_schedule": item.hasSchedule,
                        "general_form": String(describing: concept.generalForm),
                        "rxnorm_code": rxNorm as Any,
                        "codings": codings,
                    ]
                }
                resolve(payload)
            } catch {
                reject("medications_query_failed", error.localizedDescription, error)
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

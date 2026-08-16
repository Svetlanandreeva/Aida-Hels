import Foundation
import UIKit

/// Coordinates HealthKit authorization, initial import and observer-driven sync.
/// The hosting iOS app owns the Aida bearer token/profile selection and provides
/// them here after normal Aida authentication.
@MainActor
final class AidaHealthSyncCoordinator: ObservableObject {
    private let healthKit: HealthKitManager
    private let client: AppleHealthSyncClient
    private let defaults: UserDefaults

    @Published private(set) var connected = false
    @Published private(set) var syncing = false
    @Published private(set) var lastSyncAt: Date?
    @Published private(set) var lastError: String?

    init(
        baseURL: URL = URL(string: "https://aidaassistent.ru")!,
        healthKit: HealthKitManager = HealthKitManager(),
        defaults: UserDefaults = .standard
    ) {
        self.healthKit = healthKit
        self.client = AppleHealthSyncClient(baseURL: baseURL)
        self.defaults = defaults
    }

    func connect(profileId: String, bearerToken: String) async throws {
        try await healthKit.requestAuthorization()
        try await healthKit.enableBackgroundDelivery()
        connected = true

        try await sync(profileId: profileId, bearerToken: bearerToken, fallbackDays: 7)

        healthKit.startObservingChanges { [weak self] in
            guard let self else { return }
            try? await self.sync(profileId: profileId, bearerToken: bearerToken, fallbackDays: 1)
        }
    }

    func sync(profileId: String, bearerToken: String, fallbackDays: Int = 1) async throws {
        guard !syncing else { return }
        syncing = true
        lastError = nil
        defer { syncing = false }

        let since = lastSuccessfulSync(profileId: profileId)
            ?? Calendar.current.date(byAdding: .day, value: -fallbackDays, to: Date())
            ?? Date().addingTimeInterval(-86_400)

        do {
            let samples = try await healthKit.readRecentSamples(since: since)
            _ = try await client.sync(
                profileId: profileId,
                bearerToken: bearerToken,
                samples: samples,
                deviceName: UIDevice.current.name,
                deviceModel: UIDevice.current.model,
                osVersion: UIDevice.current.systemVersion
            )
            let now = Date()
            saveSuccessfulSync(now, profileId: profileId)
            lastSyncAt = now
            connected = true
        } catch {
            lastError = String(describing: error)
            throw error
        }
    }

    func disconnect() {
        healthKit.stopObservingChanges()
        connected = false
    }

    private func syncKey(profileId: String) -> String {
        "aida.appleHealth.lastSync.\(profileId)"
    }

    private func lastSuccessfulSync(profileId: String) -> Date? {
        defaults.object(forKey: syncKey(profileId: profileId)) as? Date
    }

    private func saveSuccessfulSync(_ date: Date, profileId: String) {
        defaults.set(date, forKey: syncKey(profileId: profileId))
    }
}

import Foundation
import UIKit

/// Coordinates HealthKit authorization, initial import and observer-driven sync.
/// The hosting iOS app owns the Aida bearer token/profile selection and provides
/// them here after normal Aida authentication.
@MainActor
final class AidaHealthSyncCoordinator: ObservableObject {
    private let healthKit: HealthKitManager
    private let client: AppleHealthSyncClient
    private let circadianClient: CircadianCandidateClient
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
        self.circadianClient = CircadianCandidateClient(baseURL: baseURL)
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
            try await stageSleepCandidates(
                profileId: profileId,
                bearerToken: bearerToken,
                samples: samples
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

    /// HealthKit may expose one night as several sleep-stage samples. We group
    /// adjacent stages into a single sleep session and stage only the session
    /// boundaries. They are CandidateRecords until a user confirms/corrects them.
    private func stageSleepCandidates(
        profileId: String,
        bearerToken: String,
        samples: [AidaHealthSample]
    ) async throws {
        let sleep = samples
            .filter { $0.metric == "sleep_stage" }
            .sorted { $0.startAt < $1.startAt }
        guard !sleep.isEmpty else { return }

        var sessions: [[AidaHealthSample]] = []
        var current: [AidaHealthSample] = []
        let maxStageGap: TimeInterval = 2 * 60 * 60

        for sample in sleep {
            if let last = current.last, sample.startAt.timeIntervalSince(last.endAt) > maxStageGap {
                sessions.append(current)
                current = []
            }
            current.append(sample)
        }
        if !current.isEmpty { sessions.append(current) }

        for session in sessions {
            guard let first = session.first, let last = session.last else { continue }
            let sourceBase = "\(first.externalId):\(last.externalId)"
            let sourceNames = Array(Set(session.compactMap(\.sourceName))).sorted().joined(separator: ",")
            let devices = Array(Set(session.compactMap(\.deviceName))).sorted().joined(separator: ",")
            let metadata = [
                "source_name": sourceNames,
                "device_name": devices,
                "stage_count": String(session.count),
            ].filter { !$0.value.isEmpty }

            try await circadianClient.stage(
                profileId: profileId,
                bearerToken: bearerToken,
                provider: "apple_health",
                sourceRecordId: "\(sourceBase):bedtime",
                kind: "bedtime",
                date: first.startAt,
                metadata: metadata
            )
            try await circadianClient.stage(
                profileId: profileId,
                bearerToken: bearerToken,
                provider: "apple_health",
                sourceRecordId: "\(sourceBase):wake",
                kind: "wake",
                date: last.endAt,
                metadata: metadata
            )
        }
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

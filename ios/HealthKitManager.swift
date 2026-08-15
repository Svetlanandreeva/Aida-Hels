import Foundation
import HealthKit

struct AidaHealthSample: Codable {
    let externalId: String
    let metric: String
    let value: Double
    let unit: String
    let startAt: Date
    let endAt: Date
    let sourceName: String?
    let deviceName: String?

    enum CodingKeys: String, CodingKey {
        case externalId = "external_id"
        case metric, value, unit
        case startAt = "start_at"
        case endAt = "end_at"
        case sourceName = "source_name"
        case deviceName = "device_name"
    }
}

@MainActor
final class HealthKitManager: ObservableObject {
    private let store = HKHealthStore()

    @Published private(set) var isAuthorized = false

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = []

        let identifiers: [HKQuantityTypeIdentifier] = [
            .heartRate,
            .restingHeartRate,
            .heartRateVariabilitySDNN,
            .stepCount,
            .activeEnergyBurned,
            .walkingHeartRateAverage,
        ]

        for identifier in identifiers {
            if let type = HKObjectType.quantityType(forIdentifier: identifier) {
                types.insert(type)
            }
        }

        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(sleep)
        }

        return types
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitError.notAvailable
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
        isAuthorized = true
    }

    func readRecentSamples(since: Date) async throws -> [AidaHealthSample] {
        var result: [AidaHealthSample] = []

        result += try await readQuantity(.heartRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "heart_rate", since: since)
        result += try await readQuantity(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "resting_heart_rate", since: since)
        result += try await readQuantity(.heartRateVariabilitySDNN, unit: .secondUnit(with: .milli), metric: "hrv_sdnn", since: since)
        result += try await readQuantity(.stepCount, unit: .count(), metric: "steps", since: since)
        result += try await readQuantity(.activeEnergyBurned, unit: .kilocalorie(), metric: "active_energy", since: since)
        result += try await readQuantity(.walkingHeartRateAverage, unit: HKUnit.count().unitDivided(by: .minute()), metric: "walking_heart_rate_average", since: since)
        result += try await readSleep(since: since)

        return result.sorted { $0.startAt < $1.startAt }
    }

    private func readQuantity(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        metric: String,
        since: Date
    ) async throws -> [AidaHealthSample] {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: type, predicate: predicate)],
            sortDescriptors: [SortDescriptor(\HKQuantitySample.startDate)]
        )
        let samples = try await descriptor.result(for: store)

        return samples.map { sample in
            AidaHealthSample(
                externalId: sample.uuid.uuidString,
                metric: metric,
                value: sample.quantity.doubleValue(for: unit),
                unit: unit.unitString,
                startAt: sample.startDate,
                endAt: sample.endDate,
                sourceName: sample.sourceRevision.source.name,
                deviceName: sample.device?.name
            )
        }
    }

    private func readSleep(since: Date) async throws -> [AidaHealthSample] {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: type, predicate: predicate)],
            sortDescriptors: [SortDescriptor(\HKCategorySample.startDate)]
        )
        let samples = try await descriptor.result(for: store)

        return samples.map { sample in
            AidaHealthSample(
                externalId: sample.uuid.uuidString,
                metric: "sleep_stage",
                value: Double(sample.value),
                unit: "HKCategoryValueSleepAnalysis",
                startAt: sample.startDate,
                endAt: sample.endDate,
                sourceName: sample.sourceRevision.source.name,
                deviceName: sample.device?.name
            )
        }
    }
}

enum HealthKitError: Error {
    case notAvailable
}

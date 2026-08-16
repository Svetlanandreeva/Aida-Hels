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
    private var observerQueries: [HKObserverQuery] = []

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
            .oxygenSaturation,
            .respiratoryRate,
            .vo2Max,
            .bodyMass,
            .bodyFatPercentage,
        ]

        for identifier in identifiers {
            if let type = HKObjectType.quantityType(forIdentifier: identifier) {
                types.insert(type)
            }
        }

        if #available(iOS 16.0, *), let wristTemperature = HKObjectType.quantityType(forIdentifier: .appleSleepingWristTemperature) {
            types.insert(wristTemperature)
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

    func enableBackgroundDelivery() async throws {
        for type in readTypes.compactMap({ $0 as? HKSampleType }) {
            try await withCheckedThrowingContinuation { continuation in
                store.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                    if let error { continuation.resume(throwing: error) }
                    else if success { continuation.resume(returning: ()) }
                    else { continuation.resume(throwing: HealthKitError.backgroundDeliveryFailed) }
                }
            }
        }
    }

    func startObservingChanges(onChange: @escaping @Sendable () async -> Void) {
        stopObservingChanges()
        for type in readTypes.compactMap({ $0 as? HKSampleType }) {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                guard error == nil else { completion(); return }
                Task {
                    await onChange()
                    completion()
                }
            }
            observerQueries.append(query)
            store.execute(query)
        }
    }

    func stopObservingChanges() {
        observerQueries.forEach(store.stop)
        observerQueries.removeAll()
    }

    func readRecentSamples(since: Date) async throws -> [AidaHealthSample] {
        var result: [AidaHealthSample] = []
        let bpm = HKUnit.count().unitDivided(by: .minute())

        result += try await readQuantity(.heartRate, unit: bpm, metric: "heart_rate", since: since)
        result += try await readQuantity(.restingHeartRate, unit: bpm, metric: "resting_heart_rate", since: since)
        result += try await readQuantity(.heartRateVariabilitySDNN, unit: .secondUnit(with: .milli), metric: "hrv_sdnn", since: since)
        result += try await readQuantity(.stepCount, unit: .count(), metric: "steps", since: since)
        result += try await readQuantity(.activeEnergyBurned, unit: .kilocalorie(), metric: "active_energy", since: since)
        result += try await readQuantity(.walkingHeartRateAverage, unit: bpm, metric: "walking_heart_rate_average", since: since)
        result += try await readQuantity(.oxygenSaturation, unit: .percent(), metric: "spo2", since: since, scale: 100, unitLabel: "%")
        result += try await readQuantity(.respiratoryRate, unit: bpm, metric: "respiratory_rate", since: since)
        result += try await readQuantity(.bodyMass, unit: .gramUnit(with: .kilo), metric: "weight", since: since)
        result += try await readQuantity(.bodyFatPercentage, unit: .percent(), metric: "body_fat_percentage", since: since, scale: 100, unitLabel: "%")

        let vo2Unit = HKUnit.literUnit(with: .milli)
            .unitDivided(by: .gramUnit(with: .kilo))
            .unitDivided(by: .minute())
        result += try await readQuantity(.vo2Max, unit: vo2Unit, metric: "vo2_max", since: since, unitLabel: "mL/kg/min")

        if #available(iOS 16.0, *) {
            result += try await readQuantity(.appleSleepingWristTemperature, unit: .degreeCelsius(), metric: "wrist_temperature", since: since, unitLabel: "°C")
        }

        result += try await readSleep(since: since)
        return result.sorted { $0.startAt < $1.startAt }
    }

    private func readQuantity(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        metric: String,
        since: Date,
        scale: Double = 1,
        unitLabel: String? = nil
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
                value: sample.quantity.doubleValue(for: unit) * scale,
                unit: unitLabel ?? unit.unitString,
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
    case backgroundDeliveryFailed
}

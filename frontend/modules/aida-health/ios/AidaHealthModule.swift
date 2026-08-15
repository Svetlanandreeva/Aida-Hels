import ExpoModulesCore
import Foundation
import HealthKit

public class AidaHealthModule: Module {
  private let store = HKHealthStore()
  private let isoFormatter = ISO8601DateFormatter()

  public func definition() -> ModuleDefinition {
    Name("AidaHealth")

    Function("isAvailable") {
      return HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("requestAuthorization") { () async throws -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw NSError(
          domain: "AidaHealth",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Apple Health is not available on this device."]
        )
      }

      try await self.store.requestAuthorization(toShare: [], read: self.readTypes())
      return true
    }

    AsyncFunction("readRecentSamples") { (days: Int) async throws -> [[String: Any]] in
      guard HKHealthStore.isHealthDataAvailable() else { return [] }
      let safeDays = min(max(days, 1), 30)
      let since = Calendar.current.date(byAdding: .day, value: -safeDays, to: Date()) ?? Date().addingTimeInterval(-604800)
      var output: [[String: Any]] = []

      output += try await self.readQuantity(.heartRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "heart_rate", unitLabel: "bpm", since: since)
      output += try await self.readQuantity(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "resting_heart_rate", unitLabel: "bpm", since: since)
      output += try await self.readQuantity(.heartRateVariabilitySDNN, unit: .secondUnit(with: .milli), metric: "hrv_sdnn", unitLabel: "ms", since: since)
      output += try await self.readQuantity(.stepCount, unit: .count(), metric: "steps", unitLabel: "count", since: since)
      output += try await self.readQuantity(.activeEnergyBurned, unit: .kilocalorie(), metric: "active_energy", unitLabel: "kcal", since: since)
      output += try await self.readQuantity(.walkingHeartRateAverage, unit: HKUnit.count().unitDivided(by: .minute()), metric: "walking_heart_rate_average", unitLabel: "bpm", since: since)
      output += try await self.readQuantity(.respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "respiratory_rate", unitLabel: "breaths/min", since: since)
      output += try await self.readQuantity(.oxygenSaturation, unit: .percent(), metric: "oxygen_saturation", unitLabel: "%", since: since, multiplier: 100)
      output += try await self.readQuantity(.vo2Max, unit: HKUnit(from: "ml/kg*min"), metric: "vo2_max", unitLabel: "mL/kg/min", since: since)
      output += try await self.readSleep(since: since)

      return output.sorted {
        String(describing: $0["start_at"] ?? "") < String(describing: $1["start_at"] ?? "")
      }
    }
  }

  private func readTypes() -> Set<HKObjectType> {
    var types: Set<HKObjectType> = []
    let quantities: [HKQuantityTypeIdentifier] = [
      .heartRate,
      .restingHeartRate,
      .heartRateVariabilitySDNN,
      .stepCount,
      .activeEnergyBurned,
      .walkingHeartRateAverage,
      .respiratoryRate,
      .oxygenSaturation,
      .vo2Max,
    ]

    for identifier in quantities {
      if let type = HKObjectType.quantityType(forIdentifier: identifier) {
        types.insert(type)
      }
    }
    if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
      types.insert(sleep)
    }
    return types
  }

  private func readQuantity(
    _ identifier: HKQuantityTypeIdentifier,
    unit: HKUnit,
    metric: String,
    unitLabel: String,
    since: Date,
    multiplier: Double = 1
  ) async throws -> [[String: Any]] {
    guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return [] }
    let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
    let descriptor = HKSampleQueryDescriptor(
      predicates: [.quantitySample(type: type, predicate: predicate)],
      sortDescriptors: [SortDescriptor(\HKQuantitySample.startDate)]
    )
    let samples = try await descriptor.result(for: store)

    return samples.map { sample in
      var row: [String: Any] = [
        "external_id": sample.uuid.uuidString,
        "metric": metric,
        "value": sample.quantity.doubleValue(for: unit) * multiplier,
        "unit": unitLabel,
        "start_at": isoFormatter.string(from: sample.startDate),
        "end_at": isoFormatter.string(from: sample.endDate),
        "source_name": sample.sourceRevision.source.name,
      ]
      if let deviceName = sample.device?.name { row["device_name"] = deviceName }
      return row
    }
  }

  private func readSleep(since: Date) async throws -> [[String: Any]] {
    guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [] }
    let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
    let descriptor = HKSampleQueryDescriptor(
      predicates: [.categorySample(type: type, predicate: predicate)],
      sortDescriptors: [SortDescriptor(\HKCategorySample.startDate)]
    )
    let samples = try await descriptor.result(for: store)

    return samples.map { sample in
      var row: [String: Any] = [
        "external_id": sample.uuid.uuidString,
        "metric": "sleep_stage",
        "value": Double(sample.value),
        "unit": "HKCategoryValueSleepAnalysis",
        "start_at": isoFormatter.string(from: sample.startDate),
        "end_at": isoFormatter.string(from: sample.endDate),
        "source_name": sample.sourceRevision.source.name,
        "metadata": ["category_value": sample.value],
      ]
      if let deviceName = sample.device?.name { row["device_name"] = deviceName }
      return row
    }
  }
}

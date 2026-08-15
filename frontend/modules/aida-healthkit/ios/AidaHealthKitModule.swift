import ExpoModulesCore
import Foundation
import HealthKit

public final class AidaHealthKitModule: Module {
  private let store = HKHealthStore()

  public func definition() -> ModuleDefinition {
    Name("AidaHealthKit")

    AsyncFunction("isAvailable") { () -> Bool in
      HKHealthStore.isHealthDataAvailable()
    }

    AsyncFunction("requestAuthorization") { () async throws -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw AidaHealthKitError.unavailable
      }
      try await self.store.requestAuthorization(toShare: [], read: self.readTypes())
      return true
    }

    AsyncFunction("readRecentSamples") { (sinceMs: Double) async throws -> [[String: Any?]] in
      guard HKHealthStore.isHealthDataAvailable() else {
        throw AidaHealthKitError.unavailable
      }
      let since = Date(timeIntervalSince1970: sinceMs / 1000.0)
      var result: [[String: Any?]] = []

      result += try await self.readQuantity(.heartRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "heart_rate", since: since)
      result += try await self.readQuantity(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "resting_heart_rate", since: since)
      result += try await self.readQuantity(.heartRateVariabilitySDNN, unit: .secondUnit(with: .milli), metric: "hrv_sdnn", since: since)
      result += try await self.readQuantity(.stepCount, unit: .count(), metric: "steps", since: since)
      result += try await self.readQuantity(.activeEnergyBurned, unit: .kilocalorie(), metric: "active_energy", since: since)
      result += try await self.readQuantity(.walkingHeartRateAverage, unit: HKUnit.count().unitDivided(by: .minute()), metric: "walking_heart_rate_average", since: since)
      result += try await self.readQuantity(.oxygenSaturation, unit: .percent(), metric: "oxygen_saturation", since: since)
      result += try await self.readQuantity(.respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()), metric: "respiratory_rate", since: since)
      result += try await self.readQuantity(.bodyTemperature, unit: .degreeCelsius(), metric: "body_temperature", since: since)
      result += try await self.readSleep(since: since)

      return result.sorted {
        (($0["start_at_ms"] as? Double) ?? 0) < (($1["start_at_ms"] as? Double) ?? 0)
      }
    }
  }

  private func readTypes() -> Set<HKObjectType> {
    var types = Set<HKObjectType>()
    let quantities: [HKQuantityTypeIdentifier] = [
      .heartRate,
      .restingHeartRate,
      .heartRateVariabilitySDNN,
      .stepCount,
      .activeEnergyBurned,
      .walkingHeartRateAverage,
      .oxygenSaturation,
      .respiratoryRate,
      .bodyTemperature,
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
    since: Date
  ) async throws -> [[String: Any?]] {
    guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { return [] }
    let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
    let descriptor = HKSampleQueryDescriptor(
      predicates: [.quantitySample(type: type, predicate: predicate)],
      sortDescriptors: [SortDescriptor(\HKQuantitySample.startDate)]
    )
    let samples = try await descriptor.result(for: store)

    return samples.map { sample in
      [
        "external_id": sample.uuid.uuidString,
        "metric": metric,
        "value": sample.quantity.doubleValue(for: unit),
        "unit": unit.unitString,
        "start_at_ms": sample.startDate.timeIntervalSince1970 * 1000.0,
        "end_at_ms": sample.endDate.timeIntervalSince1970 * 1000.0,
        "source_name": sample.sourceRevision.source.name,
        "device_name": sample.device?.name,
      ]
    }
  }

  private func readSleep(since: Date) async throws -> [[String: Any?]] {
    guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return [] }
    let predicate = HKQuery.predicateForSamples(withStart: since, end: Date(), options: [])
    let descriptor = HKSampleQueryDescriptor(
      predicates: [.categorySample(type: type, predicate: predicate)],
      sortDescriptors: [SortDescriptor(\HKCategorySample.startDate)]
    )
    let samples = try await descriptor.result(for: store)

    return samples.map { sample in
      [
        "external_id": sample.uuid.uuidString,
        "metric": "sleep_stage",
        "value": Double(sample.value),
        "unit": "HKCategoryValueSleepAnalysis",
        "start_at_ms": sample.startDate.timeIntervalSince1970 * 1000.0,
        "end_at_ms": sample.endDate.timeIntervalSince1970 * 1000.0,
        "source_name": sample.sourceRevision.source.name,
        "device_name": sample.device?.name,
      ]
    }
  }
}

private enum AidaHealthKitError: Error {
  case unavailable
}

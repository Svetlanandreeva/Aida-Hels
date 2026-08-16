import Foundation

struct CircadianWearableCandidateRequest: Codable {
    let profileId: String
    let provider: String
    let sourceRecordId: String
    let kind: String
    let localDate: String
    let localTime: String
    let confidence: Double?
    let metadata: [String: String]

    enum CodingKeys: String, CodingKey {
        case profileId = "profile_id"
        case provider
        case sourceRecordId = "source_record_id"
        case kind
        case localDate = "local_date"
        case localTime = "local_time"
        case confidence
        case metadata
    }
}

final class CircadianCandidateClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder = JSONEncoder()

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func stage(
        profileId: String,
        bearerToken: String,
        provider: String,
        sourceRecordId: String,
        kind: String,
        date: Date,
        confidence: Double? = nil,
        metadata: [String: String] = [:],
        calendar: Calendar = .current
    ) async throws {
        let day = Self.dayFormatter(calendar: calendar).string(from: date)
        let time = Self.timeFormatter(calendar: calendar).string(from: date)
        let payload = CircadianWearableCandidateRequest(
            profileId: profileId,
            provider: provider,
            sourceRecordId: sourceRecordId,
            kind: kind,
            localDate: day,
            localTime: time,
            confidence: confidence,
            metadata: metadata
        )

        let url = baseURL.appendingPathComponent("api/circadian/wearable-candidates")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(payload)

        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw CircadianCandidateClientError.serverResponse
        }
    }

    private static func dayFormatter(calendar: Calendar) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }

    private static func timeFormatter(calendar: Calendar) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "HH:mm"
        return formatter
    }
}

enum CircadianCandidateClientError: Error {
    case serverResponse
}

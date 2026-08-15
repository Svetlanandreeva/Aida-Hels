import Foundation

struct AppleHealthSyncRequest: Codable {
    let profileId: String
    let deviceName: String?
    let deviceModel: String?
    let osVersion: String?
    let samples: [AidaHealthSample]

    enum CodingKeys: String, CodingKey {
        case profileId = "profile_id"
        case deviceName = "device_name"
        case deviceModel = "device_model"
        case osVersion = "os_version"
        case samples
    }
}

struct AppleHealthSyncResponse: Codable {
    let ok: Bool
    let inserted: Int
    let skipped: Int
    let lastSyncAt: Date

    enum CodingKeys: String, CodingKey {
        case ok, inserted, skipped
        case lastSyncAt = "last_sync_at"
    }
}

final class AppleHealthSyncClient {
    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
        self.encoder.dateEncodingStrategy = .iso8601
        self.decoder.dateDecodingStrategy = .iso8601
    }

    func sync(
        profileId: String,
        bearerToken: String,
        samples: [AidaHealthSample],
        deviceName: String? = nil,
        deviceModel: String? = nil,
        osVersion: String? = nil
    ) async throws -> AppleHealthSyncResponse {
        let url = baseURL.appendingPathComponent("api/health/apple/sync")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try encoder.encode(
            AppleHealthSyncRequest(
                profileId: profileId,
                deviceName: deviceName,
                deviceModel: deviceModel,
                osVersion: osVersion,
                samples: samples
            )
        )

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw AppleHealthSyncError.serverResponse
        }
        return try decoder.decode(AppleHealthSyncResponse.self, from: data)
    }
}

enum AppleHealthSyncError: Error {
    case serverResponse
}

package com.aida.health

import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class AidaCircadianCandidateClient(private val baseUrl: String) {
    suspend fun stageSleepSession(
        profileId: String,
        bearerToken: String,
        session: AidaHealthConnectSleepSession,
        zoneId: ZoneId = ZoneId.systemDefault(),
    ) {
        val metadata = mapOf(
            "source_app" to session.sourceName,
            "recording_method" to session.recordingMethod,
            "stage_count" to session.stageCount.toString(),
        )
        stage(
            profileId = profileId,
            bearerToken = bearerToken,
            provider = "android_health_connect",
            sourceRecordId = "${session.externalId}:bedtime",
            kind = "bedtime",
            instant = session.startAt,
            metadata = metadata,
            zoneId = zoneId,
        )
        stage(
            profileId = profileId,
            bearerToken = bearerToken,
            provider = "android_health_connect",
            sourceRecordId = "${session.externalId}:wake",
            kind = "wake",
            instant = session.endAt,
            metadata = metadata,
            zoneId = zoneId,
        )
    }

    private fun stage(
        profileId: String,
        bearerToken: String,
        provider: String,
        sourceRecordId: String,
        kind: String,
        instant: Instant,
        metadata: Map<String, String>,
        zoneId: ZoneId,
    ) {
        val local = instant.atZone(zoneId)
        val body = buildString {
            append('{')
            append("\"profile_id\":\"").append(json(profileId)).append("\",")
            append("\"provider\":\"").append(json(provider)).append("\",")
            append("\"source_record_id\":\"").append(json(sourceRecordId)).append("\",")
            append("\"kind\":\"").append(json(kind)).append("\",")
            append("\"local_date\":\"").append(local.format(DateTimeFormatter.ISO_LOCAL_DATE)).append("\",")
            append("\"local_time\":\"").append(local.format(DateTimeFormatter.ofPattern("HH:mm"))).append("\",")
            append("\"metadata\":{")
            append(metadata.entries.joinToString(",") { (key, value) -> "\"${json(key)}\":\"${json(value)}\"" })
            append("}}")
        }

        val endpoint = URL(baseUrl.trimEnd('/') + "/api/circadian/wearable-candidates")
        val connection = (endpoint.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $bearerToken")
        }
        connection.outputStream.use { output ->
            output.write(body.toByteArray(StandardCharsets.UTF_8))
        }
        val status = connection.responseCode
        connection.disconnect()
        if (status !in 200..299) {
            throw AidaCircadianCandidateException("Candidate staging failed with HTTP $status")
        }
    }

    private fun json(value: String): String = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
}

class AidaHealthConnectCircadianCoordinator(
    private val healthConnect: AidaHealthConnectManager,
    private val candidateClient: AidaCircadianCandidateClient,
) {
    suspend fun stageRecentSleep(
        profileId: String,
        bearerToken: String,
        start: Instant,
        end: Instant = Instant.now(),
        zoneId: ZoneId = ZoneId.systemDefault(),
    ): Int {
        val sessions = healthConnect.readSleepSessions(start, end)
        sessions.forEach { session ->
            candidateClient.stageSleepSession(
                profileId = profileId,
                bearerToken = bearerToken,
                session = session,
                zoneId = zoneId,
            )
        }
        return sessions.size
    }
}

class AidaCircadianCandidateException(message: String) : RuntimeException(message)

package id.geoexplorer.app.core.vector

import id.geoexplorer.app.core.coordinates.IndonesiaUtmZones
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class SurveyWaypoint(
    val id: String,
    val label: String,
    val latitude: Double,
    val longitude: Double,
    val elevationM: Double? = null,
    val accuracyM: Float? = null,
    val category: String = "Survei",
    val note: String = ""
) {
    val epsg: Int?
        get() = IndonesiaUtmZones.epsgFor(latitude, longitude)

    val utmZoneLabel: String
        get() {
            val zone = IndonesiaUtmZones.zoneFor(longitude) ?: return "Di luar cakupan starter"
            return "Zona ${zone.number}${if (latitude >= 0.0) "N" else "S"}"
        }
}

data class TrackPoint(
    val latitude: Double,
    val longitude: Double,
    val elevationM: Double? = null,
    val accuracyM: Float? = null
)

object WaypointExporter {
    private const val EARTH_RADIUS_M = 6371008.8

    fun haversineDistanceMeters(
        lat1: Double,
        lon1: Double,
        lat2: Double,
        lon2: Double
    ): Double {
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val dPhi = Math.toRadians(lat2 - lat1)
        val dLambda = Math.toRadians(lon2 - lon1)
        val sinLat = sin(dPhi / 2.0)
        val sinLon = sin(dLambda / 2.0)
        val h = sinLat * sinLat + cos(phi1) * cos(phi2) * sinLon * sinLon
        return 2.0 * EARTH_RADIUS_M * atan2(sqrt(h), sqrt(1.0 - h))
    }

    fun polylineDistanceMeters(points: List<TrackPoint>): Double {
        if (points.size < 2) return 0.0
        var total = 0.0
        for (i in 1 until points.size) {
            total += haversineDistanceMeters(
                points[i - 1].latitude,
                points[i - 1].longitude,
                points[i].latitude,
                points[i].longitude
            )
        }
        return total
    }

    fun formatDistanceId(meters: Double): String {
        return if (meters >= 1000.0) {
            String.format(Locale.US, "%.3f km", meters / 1000.0)
        } else {
            String.format(Locale.US, "%.1f m", meters)
        }
    }

    fun toCsv(waypoints: List<SurveyWaypoint>): String {
        val header = "id,label,latitude,longitude,utm_zone,epsg"
        if (waypoints.isEmpty()) return header
        val rows = waypoints.map { wp ->
            val lat = String.format(Locale.US, "%.6f", wp.latitude)
            val lon = String.format(Locale.US, "%.6f", wp.longitude)
            val epsgText = wp.epsg?.toString() ?: ""
            listOf(
                escapeCsv(wp.id),
                escapeCsv(wp.label),
                lat,
                lon,
                escapeCsv(wp.utmZoneLabel),
                epsgText
            ).joinToString(",")
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    fun toSurveyCsv(
        waypoints: List<SurveyWaypoint>,
        trackPoints: List<TrackPoint> = emptyList()
    ): String {
        val header = "id,label,latitude,longitude,utm_zone,epsg,elevation_m,accuracy_m,category,note"
        val rows = mutableListOf<String>()
        waypoints.forEach { wp ->
            rows += listOf(
                escapeCsv(wp.id),
                escapeCsv(wp.label),
                String.format(Locale.US, "%.6f", wp.latitude),
                String.format(Locale.US, "%.6f", wp.longitude),
                escapeCsv(wp.utmZoneLabel),
                wp.epsg?.toString() ?: "",
                wp.elevationM?.let { String.format(Locale.US, "%.1f", it) } ?: "",
                wp.accuracyM?.let { String.format(Locale.US, "%.1f", it) } ?: "",
                escapeCsv(wp.category),
                escapeCsv(wp.note)
            ).joinToString(",")
        }
        if (trackPoints.size >= 2) {
            val totalDist = formatDistanceId(polylineDistanceMeters(trackPoints))
            trackPoints.forEachIndexed { idx, pt ->
                val zone = IndonesiaUtmZones.zoneFor(pt.longitude)
                val epsg = IndonesiaUtmZones.epsgFor(pt.latitude, pt.longitude)
                val zoneLabel = if (zone != null) {
                    "Zona ${zone.number}${if (pt.latitude >= 0.0) "N" else "S"}"
                } else {
                    "Di luar cakupan"
                }
                rows += listOf(
                    String.format(Locale.US, "TRK-%03d", idx + 1),
                    escapeCsv("Jalur Perjalanan #${idx + 1}"),
                    String.format(Locale.US, "%.6f", pt.latitude),
                    String.format(Locale.US, "%.6f", pt.longitude),
                    escapeCsv(zoneLabel),
                    epsg?.toString() ?: "",
                    pt.elevationM?.let { String.format(Locale.US, "%.1f", it) } ?: "",
                    pt.accuracyM?.let { String.format(Locale.US, "%.1f", it) } ?: "",
                    "Track GNSS",
                    escapeCsv("Total jarak jalur: $totalDist")
                ).joinToString(",")
            }
        }
        return (listOf(header) + rows).joinToString("\n")
    }

    fun toGeoJson(
        waypoints: List<SurveyWaypoint>,
        trackPoints: List<TrackPoint> = emptyList()
    ): String {
        val featureBlocks = waypoints.map { wp ->
            val lat = String.format(Locale.US, "%.6f", wp.latitude)
            val lon = String.format(Locale.US, "%.6f", wp.longitude)
            val epsgJson = wp.epsg?.toString() ?: "null"
            val elevJson = wp.elevationM?.let { String.format(Locale.US, "%.2f", it) } ?: "null"
            val accJson = wp.accuracyM?.let { String.format(Locale.US, "%.1f", it) } ?: "null"
            """
            |    {
            |      "type": "Feature",
            |      "properties": {
            |        "id": "${escapeJson(wp.id)}",
            |        "label": "${escapeJson(wp.label)}",
            |        "latitude": $lat,
            |        "longitude": $lon,
            |        "utm_zone": "${escapeJson(wp.utmZoneLabel)}",
            |        "epsg": $epsgJson,
            |        "elevation_m": $elevJson,
            |        "accuracy_m": $accJson,
            |        "category": "${escapeJson(wp.category)}",
            |        "note": "${escapeJson(wp.note)}"
            |      },
            |      "geometry": {
            |        "type": "Point",
            |        "coordinates": [$lon, $lat]
            |      }
            |    }
            """.trimMargin()
        }.toMutableList()

        if (trackPoints.size >= 2) {
            val distM = polylineDistanceMeters(trackPoints)
            val distLabel = formatDistanceId(distM)
            val coordsJson = trackPoints.joinToString(", ") { pt ->
                String.format(Locale.US, "[%.6f, %.6f]", pt.longitude, pt.latitude)
            }
            featureBlocks += """
            |    {
            |      "type": "Feature",
            |      "properties": {
            |        "id": "track-gnss",
            |        "label": "Jalur Perjalanan GNSS",
            |        "jumlah_titik": ${trackPoints.size},
            |        "jarak_m": ${String.format(Locale.US, "%.2f", distM)},
            |        "jarak_label": "${escapeJson(distLabel)}"
            |      },
            |      "geometry": {
            |        "type": "LineString",
            |        "coordinates": [$coordsJson]
            |      }
            |    }
            """.trimMargin()
        }

        val features = featureBlocks.joinToString(",\n")
        return """
            |{
            |  "type": "FeatureCollection",
            |  "name": "geoexplorer_waypoints",
            |  "features": [
            |$features
            |  ]
            |}
        """.trimMargin()
    }

    fun toGpx(
        waypoints: List<SurveyWaypoint>,
        trackPoints: List<TrackPoint> = emptyList(),
        projectName: String = "D H Y Explorer Survey"
    ): String {
        val wptXml = waypoints.joinToString("\n") { wp ->
            val ele = wp.elevationM?.let {
                "\n    <ele>${String.format(Locale.US, "%.2f", it)}</ele>"
            } ?: ""
            val desc = if (wp.note.isNotBlank()) "\n    <desc>${escapeXml(wp.note)}</desc>" else ""
            """  <wpt lat="${String.format(Locale.US, "%.6f", wp.latitude)}" lon="${String.format(Locale.US, "%.6f", wp.longitude)}">$ele
    <name>${escapeXml(wp.label)}</name>$desc
  </wpt>"""
        }

        val trkXml = if (trackPoints.size >= 2) {
            val distLabel = formatDistanceId(polylineDistanceMeters(trackPoints))
            val trkPts = trackPoints.joinToString("\n") { pt ->
                val ele = pt.elevationM?.let {
                    "<ele>${String.format(Locale.US, "%.2f", it)}</ele>"
                } ?: ""
                "      <trkpt lat=\"${String.format(Locale.US, "%.6f", pt.latitude)}\" lon=\"${String.format(Locale.US, "%.6f", pt.longitude)}\">$ele</trkpt>"
            }
            "\n  <trk>\n    <name>Jalur Perjalanan (${escapeXml(distLabel)})</name>\n    <trkseg>\n$trkPts\n    </trkseg>\n  </trk>"
        } else {
            ""
        }

        return """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="D H Y Explorer Android (ngek@)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(projectName)}</name>
  </metadata>
$wptXml$trkXml
</gpx>"""
    }

    private fun escapeCsv(value: String): String {
        return if (value.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
    }

    private fun escapeJson(value: String): String {
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    }

    private fun escapeXml(value: String): String {
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
    }
}

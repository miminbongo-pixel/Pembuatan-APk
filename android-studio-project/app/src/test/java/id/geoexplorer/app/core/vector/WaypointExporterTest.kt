package id.geoexplorer.app.core.vector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WaypointExporterTest {
    @Test fun csvExportEscapesCommasAndIncludesUtmEpsg() {
        val csv = WaypointExporter.toCsv(
            listOf(SurveyWaypoint("wp-1", "Makassar, Pelabuhan", -5.1, 119.0))
        )
        val lines = csv.lines()
        assertEquals("id,label,latitude,longitude,utm_zone,epsg", lines[0])
        assertEquals("wp-1,\"Makassar, Pelabuhan\",-5.100000,119.000000,Zona 50S,32750", lines[1])
    }

    @Test fun geoJsonExportProducesValidFeatureCollection() {
        val json = WaypointExporter.toGeoJson(
            listOf(SurveyWaypoint("wp-2", "Timika", -4.0, 135.0))
        )
        assertTrue(json.contains("\"type\": \"FeatureCollection\""))
        assertTrue(json.contains("\"epsg\": 32753"))
    }

    @Test fun gpxAndTrackExportIncludeTrackAndDistance() {
        val wps = listOf(
            SurveyWaypoint("wp-1", "Titik Awal", -5.1478, 119.4321, elevationM = 12.0, accuracyM = 3.5f)
        )
        val track = listOf(
            TrackPoint(-5.1478, 119.4321, elevationM = 12.0),
            TrackPoint(-5.1578, 119.4321, elevationM = 15.0)
        )
        val gpx = WaypointExporter.toGpx(wps, track)
        val geoJson = WaypointExporter.toGeoJson(wps, track)
        val surveyCsv = WaypointExporter.toSurveyCsv(wps, track)

        assertTrue(gpx.contains("<wpt lat=\"-5.147800\" lon=\"119.432100\">"))
        assertTrue(gpx.contains("<trkseg>"))
        assertTrue(geoJson.contains("\"LineString\""))
        assertTrue(surveyCsv.contains("TRK-001"))
        assertTrue(WaypointExporter.polylineDistanceMeters(track) > 1000.0)
    }
}

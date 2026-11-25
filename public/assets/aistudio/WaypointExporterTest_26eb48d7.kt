package id.geoexplorer.app.core.vector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WaypointExporterTest {
    @Test fun csvExportEscapesCommasAndIncludesUtmEpsg() {
        val csv = WaypointExporter.toCsv(
            listOf(
                SurveyWaypoint("wp-1", "Makassar, Pelabuhan", -5.1, 119.0)
            )
        )
        val lines = csv.lines()
        assertEquals("id,label,latitude,longitude,utm_zone,epsg", lines[0])
        assertEquals("wp-1,\"Makassar, Pelabuhan\",-5.100000,119.000000,Zona 50S,32750", lines[1])
    }

    @Test fun geoJsonExportProducesValidFeatureCollection() {
        val json = WaypointExporter.toGeoJson(
            listOf(
                SurveyWaypoint("wp-2", "Timika", -4.0, 135.0)
            )
        )
        assertTrue(json.contains("\"type\": \"FeatureCollection\""))
        assertTrue(json.contains("\"coordinates\": [135.000000, -4.000000]"))
        assertTrue(json.contains("\"epsg\": 32753"))
    }
}

package id.geoexplorer.app.core.map

import id.geoexplorer.app.core.coordinates.IndonesiaUtmZones
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MapLibreConfigTest {
    @Test fun defaultCameraTargetCentersInsideIndonesiaUtmCoverage() {
        val epsg = IndonesiaUtmZones.epsgFor(
            MapLibreConfig.DEFAULT_LATITUDE,
            MapLibreConfig.DEFAULT_LONGITUDE
        )
        assertEquals(32750, epsg)
    }

    @Test fun offlineFallbackStyleContainsValidMapLibreV8Structure() {
        val json = MapLibreConfig.OFFLINE_FALLBACK_STYLE_JSON
        assertTrue(json.contains("\"version\": 8"))
        assertTrue(json.contains("\"sources\""))
        assertTrue(json.contains("\"layers\""))
    }
}

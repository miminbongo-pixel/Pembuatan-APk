package id.geoexplorer.app.core.coordinates

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class IndonesiaUtmZonesTest {
    @Test fun makassarUsesZone50South() {
        assertEquals(32750, IndonesiaUtmZones.epsgFor(-5.1, 119.0))
    }

    @Test fun easternIndonesiaUsesZone53South() {
        assertEquals(32753, IndonesiaUtmZones.epsgFor(-4.0, 135.0))
    }

    @Test fun northernHemisphereUsesNorthernEpsg() {
        assertEquals(32648, IndonesiaUtmZones.epsgFor(1.0, 103.0))
    }

    @Test fun longitudeOutsideIndonesiaCoverageIsRejected() {
        assertNull(IndonesiaUtmZones.epsgFor(-5.0, 89.9))
        assertNull(IndonesiaUtmZones.epsgFor(-5.0, 144.1))
    }
}

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

    @Test fun equatorUsesNorthernHemisphereAndBoundariesAreInclusive() {
        assertEquals(32646, IndonesiaUtmZones.epsgFor(0.0, 90.0))
        assertEquals(32647, IndonesiaUtmZones.epsgFor(0.0, 96.0))
        assertEquals(32754, IndonesiaUtmZones.epsgFor(-80.0, 144.0))
        assertEquals(32654, IndonesiaUtmZones.epsgFor(84.0, 144.0))
    }

    @Test fun longitudeOutsideIndonesiaCoverageIsRejected() {
        assertNull(IndonesiaUtmZones.epsgFor(-5.0, 89.9))
        assertNull(IndonesiaUtmZones.epsgFor(-5.0, 144.1))
    }

    @Test fun latitudeOutsideUtmStandardRangeIsRejected() {
        assertNull(IndonesiaUtmZones.epsgFor(-80.1, 119.0))
        assertNull(IndonesiaUtmZones.epsgFor(84.1, 119.0))
    }

    @Test fun nonFiniteCoordinatesAreRejected() {
        assertNull(IndonesiaUtmZones.epsgFor(Double.NaN, 119.0))
        assertNull(IndonesiaUtmZones.epsgFor(-5.0, Double.POSITIVE_INFINITY))
        assertNull(IndonesiaUtmZones.epsgFor(-5.0, Double.NEGATIVE_INFINITY))
    }
}

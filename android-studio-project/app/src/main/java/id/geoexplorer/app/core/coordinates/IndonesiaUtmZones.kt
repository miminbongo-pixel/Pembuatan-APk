package id.geoexplorer.app.core.coordinates

/**
 * Cakupan zona UTM standar yang melintasi wilayah Indonesia (46–54).
 * EPSG 326xx = WGS 84 / UTM northern hemisphere.
 * EPSG 327xx = WGS 84 / UTM southern hemisphere.
 */
object IndonesiaUtmZones {
    data class Zone(val number: Int, val westLongitude: Double, val eastLongitude: Double) {
        fun epsg(isNorthernHemisphere: Boolean): Int =
            (if (isNorthernHemisphere) 32600 else 32700) + number
    }

    val zones = listOf(
        Zone(46, 90.0, 96.0),
        Zone(47, 96.0, 102.0),
        Zone(48, 102.0, 108.0),
        Zone(49, 108.0, 114.0),
        Zone(50, 114.0, 120.0),
        Zone(51, 120.0, 126.0),
        Zone(52, 126.0, 132.0),
        Zone(53, 132.0, 138.0),
        Zone(54, 138.0, 144.0)
    )

    fun zoneFor(longitude: Double): Zone? {
        if (!longitude.isFinite() || longitude < 90.0 || longitude > 144.0) return null
        return zones.firstOrNull {
            longitude >= it.westLongitude &&
                (longitude < it.eastLongitude || (it.number == 54 && longitude <= it.eastLongitude))
        }
    }

    fun epsgFor(latitude: Double, longitude: Double): Int? {
        if (!latitude.isFinite() || latitude !in -80.0..84.0) return null
        val zone = zoneFor(longitude) ?: return null
        return zone.epsg(isNorthernHemisphere = latitude >= 0.0)
    }
}

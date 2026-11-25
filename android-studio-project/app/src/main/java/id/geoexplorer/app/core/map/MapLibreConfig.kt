package id.geoexplorer.app.core.map

object MapLibreConfig {
    const val DEFAULT_LATITUDE = -5.1478
    const val DEFAULT_LONGITUDE = 119.4321
    const val DEFAULT_ZOOM = 7.2

    const val DEFAULT_STYLE_URL = "https://demotiles.maplibre.org/style.json"

    val OFFLINE_FALLBACK_STYLE_JSON = """
        {
          "version": 8,
          "name": "D H Y Explorer Offline Canvas",
          "sources": {},
          "layers": [
            {
              "id": "geoexplorer-background",
              "type": "background",
              "paint": {
                "background-color": "#DCE8F5"
              }
            }
          ]
        }
    """.trimIndent()
}

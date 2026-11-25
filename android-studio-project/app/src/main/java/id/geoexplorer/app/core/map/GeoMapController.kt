package id.geoexplorer.app.core.map

import android.content.Context
import android.graphics.Color
import android.graphics.RectF
import android.os.Bundle
import id.geoexplorer.app.core.coordinates.IndonesiaUtmZones
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource

/**
 * Pengendali MapLibre Native Android SDK dengan dukungan:
 * - Grid UTM Indonesia 46–54 ON/OFF
 * - Klik fitur poliline/poligon/titik untuk tabel atribut
 * - Ubah warna vektor secara dinamis
 * - Sinkronisasi arah kompas/bearing real-time
 */
class GeoMapController(private val context: Context) {
    private var mapView: MapView? = null
    private var mapLibreMap: MapLibreMap? = null
    private var fallbackLoaded = false
    private var isStarted = false
    private var isResumed = false

    private var utmGridEnabled: Boolean = true
    private var vectorHexColor: String = "#EF4444"
    private var activeVectorGeoJson: String? = null

    data class ClickedVectorFeature(
        val layerLabel: String,
        val geometryType: String,
        val attributes: Map<String, String>,
        val latitude: Double,
        val longitude: Double
    )

    companion object {
        private const val UTM_SOURCE_ID = "geoexplorer-utm-grid"
        private const val UTM_LINE_LAYER_ID = "geoexplorer-utm-lines"
        private const val VECTOR_SOURCE_ID = "geoexplorer-sample-vector"
        private const val VECTOR_FILL_LAYER_ID = "geoexplorer-vector-fill"
        private const val VECTOR_LINE_LAYER_ID = "geoexplorer-vector-line"
        private const val VECTOR_POINT_LAYER_ID = "geoexplorer-vector-point"
    }

    fun setUtmGridEnabled(enabled: Boolean) {
        utmGridEnabled = enabled
        mapLibreMap?.style?.getLayer(UTM_LINE_LAYER_ID)?.setProperties(
            PropertyFactory.visibility(if (enabled) Property.VISIBLE else Property.NONE)
        )
    }

    fun loadCustomGeoJson(geoJsonText: String) {
        activeVectorGeoJson = geoJsonText
        val style = mapLibreMap?.style ?: return
        style.getSourceAs<GeoJsonSource>(VECTOR_SOURCE_ID)?.setGeoJson(geoJsonText)
    }

    fun centerCameraAt(latitude: Double, longitude: Double, zoom: Double = 15.0) {
        val map = mapLibreMap ?: return
        val updated = CameraPosition.Builder()
            .target(LatLng(latitude, longitude))
            .zoom(zoom)
            .build()
        map.animateCamera(CameraUpdateFactory.newCameraPosition(updated), 500)
    }

    fun setVectorFeatureColor(hexColor: String) {
        vectorHexColor = hexColor
        val parsed = runCatching { Color.parseColor(hexColor) }.getOrNull() ?: return
        val style = mapLibreMap?.style ?: return
        style.getLayerAs<FillLayer>(VECTOR_FILL_LAYER_ID)?.setProperties(
            PropertyFactory.fillColor(parsed),
            PropertyFactory.fillOpacity(0.28f)
        )
        style.getLayerAs<LineLayer>(VECTOR_LINE_LAYER_ID)?.setProperties(
            PropertyFactory.lineColor(parsed),
            PropertyFactory.lineWidth(3.2f)
        )
        style.getLayerAs<CircleLayer>(VECTOR_POINT_LAYER_ID)?.setProperties(
            PropertyFactory.circleColor(parsed)
        )
    }

    fun resetNorth() {
        val map = mapLibreMap ?: return
        val current = map.cameraPosition
        val updated = CameraPosition.Builder(current).bearing(0.0).tilt(0.0).build()
        map.animateCamera(CameraUpdateFactory.newCameraPosition(updated), 300)
    }

    fun setCameraBearing(bearingDeg: Double) {
        val map = mapLibreMap ?: return
        val current = map.cameraPosition
        val updated = CameraPosition.Builder(current).bearing(bearingDeg).build()
        map.moveCamera(CameraUpdateFactory.newCameraPosition(updated))
    }

    fun setBasemap(
        source: BasemapCatalog.Source,
        onApplied: ((String) -> Unit)? = null
    ) {
        val map = mapLibreMap ?: return
        fallbackLoaded = false
        val styleBuilder = if (source.styleUri != null) {
            Style.Builder().fromUri(source.styleUri)
        } else {
            Style.Builder().fromJson(source.toRasterStyleJson())
        }
        map.setStyle(styleBuilder) { style ->
            installOverlays(style)
            onApplied?.invoke("${source.displayName} aktif")
        }
    }

    private fun installOverlays(style: Style) {
        if (style.getSource(UTM_SOURCE_ID) == null) {
            style.addSource(GeoJsonSource(UTM_SOURCE_ID, buildIndonesiaUtmGridGeoJson()))
            style.addLayer(
                LineLayer(UTM_LINE_LAYER_ID, UTM_SOURCE_ID).withProperties(
                    PropertyFactory.lineColor(Color.parseColor("#38BDF8")),
                    PropertyFactory.lineWidth(1.4f),
                    PropertyFactory.lineDasharray(arrayOf(4f, 3f)),
                    PropertyFactory.visibility(if (utmGridEnabled) Property.VISIBLE else Property.NONE)
                )
            )
        }

        if (style.getSource(VECTOR_SOURCE_ID) == null) {
            style.addSource(
                GeoJsonSource(
                    VECTOR_SOURCE_ID,
                    activeVectorGeoJson ?: buildSampleSurveyGeoJson()
                )
            )
            val parsedColor = runCatching { Color.parseColor(vectorHexColor) }
                .getOrDefault(Color.parseColor("#EF4444"))

            style.addLayer(
                FillLayer(VECTOR_FILL_LAYER_ID, VECTOR_SOURCE_ID).withProperties(
                    PropertyFactory.fillColor(parsedColor),
                    PropertyFactory.fillOpacity(0.28f)
                )
            )
            style.addLayer(
                LineLayer(VECTOR_LINE_LAYER_ID, VECTOR_SOURCE_ID).withProperties(
                    PropertyFactory.lineColor(parsedColor),
                    PropertyFactory.lineWidth(3.2f)
                )
            )
            style.addLayer(
                CircleLayer(VECTOR_POINT_LAYER_ID, VECTOR_SOURCE_ID).withProperties(
                    PropertyFactory.circleRadius(6.5f),
                    PropertyFactory.circleColor(parsedColor),
                    PropertyFactory.circleStrokeColor(Color.WHITE),
                    PropertyFactory.circleStrokeWidth(2f)
                )
            )
        }
    }

    fun createMapView(
        savedInstanceState: Bundle?,
        initialBasemap: BasemapCatalog.Source = BasemapCatalog.Source.ESRI_WORLD_IMAGERY,
        onCoordinateChanged: (latitude: Double, longitude: Double, zoom: Double, bearing: Double, styleSource: String) -> Unit,
        onFeatureClicked: (ClickedVectorFeature) -> Unit,
        onError: (String) -> Unit
    ): MapView? {
        return try {
            MapLibre.getInstance(context.applicationContext)
            fallbackLoaded = false
            isStarted = false
            isResumed = false

            lateinit var createdView: MapView
            createdView = MapView(context).apply {
                onCreate(savedInstanceState)
                addOnDidFailLoadingMapListener { errorMessage ->
                    if (!fallbackLoaded) {
                        fallbackLoaded = true
                        createdView.post {
                            mapLibreMap?.setStyle(
                                Style.Builder().fromJson(MapLibreConfig.OFFLINE_FALLBACK_STYLE_JSON)
                            ) { style ->
                                installOverlays(style)
                                val pos = mapLibreMap?.cameraPosition
                                val target = pos?.target
                                onCoordinateChanged(
                                    target?.latitude ?: MapLibreConfig.DEFAULT_LATITUDE,
                                    target?.longitude ?: MapLibreConfig.DEFAULT_LONGITUDE,
                                    pos?.zoom ?: MapLibreConfig.DEFAULT_ZOOM,
                                    pos?.bearing ?: 0.0,
                                    "Kanvas offline ($errorMessage)"
                                )
                            }
                        }
                    }
                }
            }

            createdView.getMapAsync { map ->
                mapLibreMap = map
                map.cameraPosition = CameraPosition.Builder()
                    .target(LatLng(MapLibreConfig.DEFAULT_LATITUDE, MapLibreConfig.DEFAULT_LONGITUDE))
                    .zoom(MapLibreConfig.DEFAULT_ZOOM)
                    .build()

                onCoordinateChanged(
                    MapLibreConfig.DEFAULT_LATITUDE,
                    MapLibreConfig.DEFAULT_LONGITUDE,
                    MapLibreConfig.DEFAULT_ZOOM,
                    0.0,
                    "Memuat ${initialBasemap.displayName}..."
                )

                val initialStyle = if (initialBasemap.styleUri != null) {
                    Style.Builder().fromUri(initialBasemap.styleUri)
                } else {
                    Style.Builder().fromJson(initialBasemap.toRasterStyleJson())
                }

                map.setStyle(initialStyle) { style ->
                    installOverlays(style)
                    val pos = map.cameraPosition
                    val target = pos.target
                    onCoordinateChanged(
                        target?.latitude ?: MapLibreConfig.DEFAULT_LATITUDE,
                        target?.longitude ?: MapLibreConfig.DEFAULT_LONGITUDE,
                        pos.zoom,
                        pos.bearing,
                        "${initialBasemap.displayName} aktif"
                    )
                }

                map.addOnCameraMoveListener {
                    val pos = map.cameraPosition
                    val target = pos.target ?: return@addOnCameraMoveListener
                    val sourceLabel = if (fallbackLoaded) "Kanvas offline MapLibre" else "Basemap MapLibre aktif"
                    onCoordinateChanged(target.latitude, target.longitude, pos.zoom, pos.bearing, sourceLabel)
                }

                map.addOnMapClickListener { point ->
                    val screenPt = map.projection.toScreenLocation(point)
                    val box = RectF(screenPt.x - 24f, screenPt.y - 24f, screenPt.x + 24f, screenPt.y + 24f)
                    val features = map.queryRenderedFeatures(
                        box,
                        VECTOR_POINT_LAYER_ID,
                        VECTOR_LINE_LAYER_ID,
                        VECTOR_FILL_LAYER_ID
                    )
                    if (features.isNotEmpty()) {
                        val hit = features.first()
                        val attrs = linkedMapOf<String, String>()
                        hit.properties()?.entrySet()?.forEach { entry ->
                            attrs[entry.key] = entry.value.toString().trim('"')
                        }
                        onFeatureClicked(
                            ClickedVectorFeature(
                                layerLabel = attrs["nama"] ?: "Fitur Vektor",
                                geometryType = hit.geometry()?.type() ?: "Feature",
                                attributes = attrs,
                                latitude = point.latitude,
                                longitude = point.longitude
                            )
                        )
                        true
                    } else {
                        val sourceLabel = if (fallbackLoaded) "Titik klik (kanvas offline)" else "Titik klik pada peta"
                        onCoordinateChanged(point.latitude, point.longitude, map.cameraPosition.zoom, map.cameraPosition.bearing, sourceLabel)
                        true
                    }
                }
            }

            mapView = createdView
            createdView
        } catch (t: Throwable) {
            onError(t.message ?: t::class.java.simpleName)
            null
        }
    }

    private fun buildIndonesiaUtmGridGeoJson(): String {
        val features = mutableListOf<String>()
        for (lon in 90..144 step 6) {
            features += """
                {"type":"Feature","properties":{"lon":$lon},"geometry":{"type":"LineString","coordinates":[[$lon,-12.0],[$lon,8.0]]}}
            """.trimIndent()
        }
        features += """
            {"type":"Feature","properties":{"kind":"equator"},"geometry":{"type":"LineString","coordinates":[[90.0,0.0],[144.0,0.0]]}}
        """.trimIndent()
        return """{"type":"FeatureCollection","features":[${features.joinToString(",")}]}"""
    }

    private fun buildSampleSurveyGeoJson(): String {
        val zone = IndonesiaUtmZones.zoneFor(119.4321)?.number ?: 50
        return """
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "properties": {"nama": "Koridor Transek Survei", "panjang_km": "12.6", "zona_utm": "Zona ${zone}S"},
                  "geometry": {
                    "type": "LineString",
                    "coordinates": [[119.405, -5.11], [119.422, -5.138], [119.4321, -5.1478], [119.448, -5.172]]
                  }
                },
                {
                  "type": "Feature",
                  "properties": {"nama": "Zona Survei Makassar", "luas_ha": "645.2", "epsg": "32750"},
                  "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[119.392, -5.115], [119.455, -5.115], [119.455, -5.175], [119.392, -5.175], [119.392, -5.115]]]
                  }
                }
              ]
            }
        """.trimIndent()
    }

    fun onStart() {
        val view = mapView ?: return
        if (!isStarted) {
            view.onStart()
            isStarted = true
        }
    }

    fun onResume() {
        val view = mapView ?: return
        if (!isStarted) {
            view.onStart()
            isStarted = true
        }
        if (!isResumed) {
            view.onResume()
            isResumed = true
        }
    }

    fun onPause() {
        val view = mapView ?: return
        if (isResumed) {
            view.onPause()
            isResumed = false
        }
    }

    fun onStop() {
        val view = mapView ?: return
        if (isResumed) {
            view.onPause()
            isResumed = false
        }
        if (isStarted) {
            view.onStop()
            isStarted = false
        }
    }

    fun onLowMemory() {
        mapView?.onLowMemory()
    }

    fun onSaveInstanceState(outState: Bundle) {
        mapView?.onSaveInstanceState(outState)
    }

    fun destroyMapView() {
        val view = mapView ?: return
        if (isResumed) {
            view.onPause()
            isResumed = false
        }
        if (isStarted) {
            view.onStop()
            isStarted = false
        }
        mapLibreMap = null
        view.onDestroy()
        mapView = null
    }
}

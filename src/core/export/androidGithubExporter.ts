import JSZip from 'jszip';

export interface ProjectPackageFile {
  path: string;
  content: string;
}

export const ANDROID_GRADLE_ROOT = `plugins {
    id("com.android.application") version "8.7.3" apply false
    id("com.android.library") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.jvm") version "2.0.21" apply false
}
`;

export const ANDROID_SETTINGS_GRADLE = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

enableFeaturePreview("TYPESAFE_PROJECT_ACCESSORS")

rootProject.name = "D H Y Explorer"
include(":app")
`;

export const ANDROID_GRADLE_PROPERTIES = `# Konfigurasi JVM & Gradle yang hemat memori
org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8
kotlin.daemon.jvmargs=-Xmx768m
org.gradle.parallel=true
org.gradle.caching=true

# Konfigurasi AndroidX & AGP 8+
android.useAndroidX=true
android.nonTransitiveRClass=true

# Gaya kode Kotlin resmi
kotlin.code.style=official
`;

export const ANDROID_GRADLE_WRAPPER_PROPERTIES = `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.9-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;

export const ANDROID_GITIGNORE = `*.iml
.gradle/
.kotlin/
.idea/
local.properties
.DS_Store
/build/
**/build/
captures/
.externalNativeBuild/
.cxx/
*.apk
*.ap_
*.aab
*.dex
*.class
*.hprof
`;

export const ANDROID_APP_BUILD_GRADLE = `import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.geoexplorer.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.geoexplorer.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "0.4.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt")
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")

    // Mesin peta utama MapLibre Native Android SDK
    implementation("org.maplibre.gl:android-sdk:11.13.0")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
`;

export const ANDROID_MANIFEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

    <application
        android:allowBackup="true"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

export const ANDROID_STRINGS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">D H Y Explorer</string>
</resources>
`;

export const ANDROID_STYLES_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">#0F5EC4</item>
        <item name="colorPrimaryDark">#0D4EA3</item>
        <item name="colorAccent">#0F5EC4</item>
        <item name="android:fontFamily">sans</item>
        <item name="android:navigationBarColor">#FFFFFF</item>
        <item name="android:statusBarColor">#0F5EC4</item>
        <item name="android:windowLightStatusBar">false</item>
    </style>
</resources>
`;

export const ANDROID_INDONESIA_UTM_ZONES_KT = `package id.geoexplorer.app.core.coordinates

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
`;

export const ANDROID_MAPLIBRE_CONFIG_KT = `package id.geoexplorer.app.core.map

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
`;

export const ANDROID_BASEMAP_CATALOG_KT = `package id.geoexplorer.app.core.map

object BasemapCatalog {
    enum class Source(
        val id: String,
        val displayName: String,
        val tileUrlTemplate: String?,
        val styleUri: String?,
        val attribution: String,
        val maxZoom: Int = 19
    ) {
        ESRI_WORLD_IMAGERY(
            id = "esri-satellite",
            displayName = "Satelit Esri",
            tileUrlTemplate = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            styleUri = null,
            attribution = "Esri, Maxar, Earthstar Geographics",
            maxZoom = 19
        ),
        GOOGLE_SATELLITE(
            id = "google-satellite",
            displayName = "Satelit Google Earth",
            tileUrlTemplate = "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            styleUri = null,
            attribution = "Google Satellite XYZ",
            maxZoom = 20
        ),
        GOOGLE_HYBRID(
            id = "google-hybrid",
            displayName = "Satelit Google Hybrid",
            tileUrlTemplate = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
            styleUri = null,
            attribution = "Google Hybrid XYZ",
            maxZoom = 20
        ),
        GOOGLE_ROADMAP(
            id = "google-roadmap",
            displayName = "Peta Google Maps",
            tileUrlTemplate = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
            styleUri = null,
            attribution = "Google Maps XYZ",
            maxZoom = 20
        ),
        OPENSTREETMAP(
            id = "osm-map",
            displayName = "Peta OpenStreetMap",
            tileUrlTemplate = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            styleUri = null,
            attribution = "OpenStreetMap contributors",
            maxZoom = 19
        ),
        MAPLIBRE_DEMO(
            id = "maplibre-vector",
            displayName = "Peta Vektor MapLibre",
            tileUrlTemplate = null,
            styleUri = MapLibreConfig.DEFAULT_STYLE_URL,
            attribution = "MapLibre Demo Tiles",
            maxZoom = 18
        );

        fun toRasterStyleJson(): String {
            val url = tileUrlTemplate ?: return MapLibreConfig.OFFLINE_FALLBACK_STYLE_JSON
            return """
                {
                  "version": 8,
                  "name": "\${displayName.replace("\"", "'")}",
                  "sources": {
                    "basemap": {
                      "type": "raster",
                      "tiles": ["$url"],
                      "tileSize": 256,
                      "maxzoom": $maxZoom
                    }
                  },
                  "layers": [
                    {
                      "id": "basemap-raster",
                      "type": "raster",
                      "source": "basemap",
                      "minzoom": 0,
                      "maxzoom": 22
                    }
                  ]
                }
            """.trimIndent()
        }
    }
}
`;

export const ANDROID_PROJECT_DEFINITION_KT = `package id.geoexplorer.app.core.project

data class ProjectDefinition(
    val id: String,
    val name: String,
    val crsAuthority: String = "EPSG",
    val crsCode: Int = 4326,
    val countryScope: String = "Indonesia"
) {
    fun validationErrors(): List<String> = buildList {
        if (id.isBlank()) add("ID proyek tidak boleh kosong")
        if (name.isBlank()) add("Nama proyek tidak boleh kosong")
        if (crsAuthority.isBlank()) add("Otoritas CRS tidak boleh kosong")
        if (crsCode <= 0) add("Kode CRS harus berupa bilangan positif")
        if (countryScope.isBlank()) add("Cakupan wilayah tidak boleh kosong")
    }

    val isValid: Boolean
        get() = validationErrors().isEmpty()
}
`;

export const ANDROID_WAYPOINT_EXPORTER_KT = `package id.geoexplorer.app.core.vector

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
            return "Zona \${zone.number}\${if (latitude >= 0.0) "N" else "S"}"
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
        return (listOf(header) + rows).joinToString("\\n")
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
                    "Zona \${zone.number}\${if (pt.latitude >= 0.0) "N" else "S"}"
                } else {
                    "Di luar cakupan"
                }
                rows += listOf(
                    String.format(Locale.US, "TRK-%03d", idx + 1),
                    escapeCsv("Jalur Perjalanan #\${idx + 1}"),
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
        return (listOf(header) + rows).joinToString("\\n")
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
            |        "id": "\${escapeJson(wp.id)}",
            |        "label": "\${escapeJson(wp.label)}",
            |        "latitude": $lat,
            |        "longitude": $lon,
            |        "utm_zone": "\${escapeJson(wp.utmZoneLabel)}",
            |        "epsg": $epsgJson,
            |        "elevation_m": $elevJson,
            |        "accuracy_m": $accJson,
            |        "category": "\${escapeJson(wp.category)}",
            |        "note": "\${escapeJson(wp.note)}"
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
            |        "jumlah_titik": \${trackPoints.size},
            |        "jarak_m": \${String.format(Locale.US, "%.2f", distM)},
            |        "jarak_label": "\${escapeJson(distLabel)}"
            |      },
            |      "geometry": {
            |        "type": "LineString",
            |        "coordinates": [$coordsJson]
            |      }
            |    }
            """.trimMargin()
        }

        val features = featureBlocks.joinToString(",\\n")
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
        val wptXml = waypoints.joinToString("\\n") { wp ->
            val ele = wp.elevationM?.let {
                "\\n    <ele>\${String.format(Locale.US, "%.2f", it)}</ele>"
            } ?: ""
            val desc = if (wp.note.isNotBlank()) "\\n    <desc>\${escapeXml(wp.note)}</desc>" else ""
            """  <wpt lat="\${String.format(Locale.US, "%.6f", wp.latitude)}" lon="\${String.format(Locale.US, "%.6f", wp.longitude)}">$ele
    <name>\${escapeXml(wp.label)}</name>$desc
  </wpt>"""
        }

        val trkXml = if (trackPoints.size >= 2) {
            val distLabel = formatDistanceId(polylineDistanceMeters(trackPoints))
            val trkPts = trackPoints.joinToString("\\n") { pt ->
                val ele = pt.elevationM?.let {
                    "<ele>\${String.format(Locale.US, "%.2f", it)}</ele>"
                } ?: ""
                "      <trkpt lat=\\"\${String.format(Locale.US, "%.6f", pt.latitude)}\\" lon=\\"\${String.format(Locale.US, "%.6f", pt.longitude)}\\">$ele</trkpt>"
            }
            "\\n  <trk>\\n    <name>Jalur Perjalanan (\${escapeXml(distLabel)})</name>\\n    <trkseg>\\n$trkPts\\n    </trkseg>\\n  </trk>"
        } else {
            ""
        }

        return """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="D H Y Explorer Android (ngek@)" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>\${escapeXml(projectName)}</name>
  </metadata>
$wptXml$trkXml
</gpx>"""
    }

    private fun escapeCsv(value: String): String {
        return if (value.any { it == ',' || it == '"' || it == '\\n' || it == '\\r' }) {
            "\\"\${value.replace("\\"", "\\"\\"")}\\""
        } else {
            value
        }
    }

    private fun escapeJson(value: String): String {
        return value
            .replace("\\\\", "\\\\\\\\")
            .replace("\\"", "\\\\\\"")
            .replace("\\n", "\\\\n")
            .replace("\\r", "\\\\r")
    }

    private fun escapeXml(value: String): String {
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\\"", "&quot;")
    }
}
`;

export const ANDROID_GEO_MAP_CONTROLLER_KT = `package id.geoexplorer.app.core.map

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
            onApplied?.invoke("\${source.displayName} aktif")
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
                    "Memuat \${initialBasemap.displayName}..."
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
                        "\${initialBasemap.displayName} aktif"
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
        return """{"type":"FeatureCollection","features":[\${features.joinToString(",")}]}"""
    }

    private fun buildSampleSurveyGeoJson(): String {
        val zone = IndonesiaUtmZones.zoneFor(119.4321)?.number ?: 50
        return """
            {
              "type": "FeatureCollection",
              "features": [
                {
                  "type": "Feature",
                  "properties": {"nama": "Koridor Transek Survei", "panjang_km": "12.6", "zona_utm": "Zona \${zone}S"},
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
`;

export const ANDROID_MAIN_ACTIVITY_KT = `package id.geoexplorer.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import id.geoexplorer.app.core.coordinates.IndonesiaUtmZones
import id.geoexplorer.app.core.map.BasemapCatalog
import id.geoexplorer.app.core.map.GeoMapController
import id.geoexplorer.app.core.vector.SurveyWaypoint
import id.geoexplorer.app.core.vector.TrackPoint
import id.geoexplorer.app.core.vector.WaypointExporter
import java.util.Locale
import kotlin.math.roundToInt

class MainActivity : AppCompatActivity(), SensorEventListener, LocationListener {
    private val primaryBlue = Color.rgb(15, 94, 196)
    private val accentBlue = Color.rgb(20, 105, 190)
    private val paleBg = Color.rgb(244, 247, 251)

    private lateinit var content: LinearLayout
    private var currentScreen: Screen = Screen.HOME
    private var infoTitle: String = ""
    private var infoMessage: String = ""
    private var savedStateForMap: Bundle? = null
    private var mapController: GeoMapController? = null

    private var sensorManager: SensorManager? = null
    private var compassActive: Boolean = false
    private var compassTextView: TextView? = null
    private var mapStatusTextView: TextView? = null
    private var utmGridOn: Boolean = true
    private var wgs84Visible: Boolean = true

    private var locationUpdatesActive: Boolean = false
    private var permissionDeniedState: Boolean = false
    private var pendingLocationAction: (() -> Unit)? = null
    private var lastGnssLocation: Location? = null
    private var surveyStatusTextView: TextView? = null
    private var trackStatusTextView: TextView? = null
    private var isRecordingTrack: Boolean = false
    private val trackPoints = mutableListOf<TrackPoint>()
    private val waypoints = mutableListOf(
        SurveyWaypoint(
            id = "wp-1",
            label = "Makassar (Titik Kontrol 50S)",
            latitude = -5.1478,
            longitude = 119.4321,
            elevationM = 4.5,
            accuracyM = 3.2f,
            category = "Titik Kontrol",
            note = "UTM Zone 50S · EPSG:32750"
        ),
        SurveyWaypoint(
            id = "wp-2",
            label = "Timika Papua Tengah",
            latitude = -4.0,
            longitude = 135.0,
            elevationM = 28.0,
            accuracyM = 4.0f,
            category = "Titik Kontrol",
            note = "UTM Zone 53S · EPSG:32753"
        )
    )

    private val openGeoJsonLauncher =
        registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) {
                val textData = runCatching {
                    contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                }.getOrNull()
                if (!textData.isNullOrBlank()) {
                    mapController?.loadCustomGeoJson(textData)
                    mapStatusTextView?.text = "Status: Berkas GeoJSON lokal dimuat ke peta."
                }
            }
        }

    private val exportCsvLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
            if (uri != null) {
                writeTextToUri(uri, WaypointExporter.toSurveyCsv(waypoints, trackPoints), "CSV")
            }
        }

    private val exportGeoJsonLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("application/geo+json")) { uri ->
            if (uri != null) {
                writeTextToUri(uri, WaypointExporter.toGeoJson(waypoints, trackPoints), "GeoJSON")
            }
        }

    private val exportGpxLauncher =
        registerForActivityResult(ActivityResultContracts.CreateDocument("application/gpx+xml")) { uri ->
            if (uri != null) {
                writeTextToUri(uri, WaypointExporter.toGpx(waypoints, trackPoints), "GPX")
            }
        }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
            val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            if (fineGranted || coarseGranted) {
                permissionDeniedState = false
                startLiveLocationUpdates()
                val action = pendingLocationAction
                pendingLocationAction = null
                action?.invoke()
            } else {
                permissionDeniedState = true
                pendingLocationAction = null
                handleLocationPermissionDenied()
            }
        }

    private enum class Screen {
        HOME,
        MAP,
        SURVEY,
        COORDINATES,
        INFO
    }

    companion object {
        private const val KEY_SCREEN = "geoexplorer_screen"
        private const val KEY_INFO_TITLE = "geoexplorer_info_title"
        private const val KEY_INFO_MESSAGE = "geoexplorer_info_message"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        savedStateForMap = savedInstanceState
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (currentScreen != Screen.HOME) {
                    showHome()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        val restoredScreen = savedInstanceState?.getString(KEY_SCREEN)
            ?.let { runCatching { Screen.valueOf(it) }.getOrNull() }
            ?: Screen.HOME

        when (restoredScreen) {
            Screen.HOME -> showHome()
            Screen.MAP -> showMapPreview()
            Screen.SURVEY -> showSurveyAndGps()
            Screen.COORDINATES -> showCoordinates()
            Screen.INFO -> {
                val title = savedInstanceState?.getString(KEY_INFO_TITLE).orEmpty()
                val msg = savedInstanceState?.getString(KEY_INFO_MESSAGE).orEmpty()
                if (title.isNotEmpty()) showInfo(title, msg) else showHome()
            }
        }

        if (hasLocationPermission()) {
            startLiveLocationUpdates()
        } else if (savedInstanceState == null) {
            // Proaktif meminta izin lokasi saat aplikasi pertama kali dijalankan
            ensureLocationPermission(showRationaleDialog = false) {
                centerOnLastKnownGnss()
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun ensureLocationPermission(
        showRationaleDialog: Boolean = true,
        onGranted: () -> Unit
    ) {
        if (hasLocationPermission()) {
            permissionDeniedState = false
            startLiveLocationUpdates()
            onGranted()
            return
        }

        pendingLocationAction = onGranted
        val shouldShowRationale = ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        )

        if (showRationaleDialog && shouldShowRationale) {
            AlertDialog.Builder(this)
                .setTitle("Izin Lokasi GNSS Diperlukan")
                .setMessage(
                    "D H Y Explorer membutuhkan izin lokasi akurat untuk membaca koordinat GPS, akurasi posisi, zona UTM/EPSG, serta merekam jalur perjalanan survei."
                )
                .setPositiveButton("Izinkan Lokasi") { _, _ ->
                    launchLocationPermissionRequest()
                }
                .setNegativeButton("Gunakan Mode Manual") { _, _ ->
                    pendingLocationAction = null
                    updatePermissionDeniedLabels("Izin lokasi ditolak. Mode input waypoint manual tetap aktif.")
                }
                .show()
        } else {
            launchLocationPermissionRequest()
        }
    }

    private fun launchLocationPermissionRequest() {
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    private fun handleLocationPermissionDenied() {
        val canAskAgain = ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        if (canAskAgain) {
            updatePermissionDeniedLabels("Izin lokasi ditolak sementara. Ketuk Baca GNSS untuk meminta izin lagi.")
            AlertDialog.Builder(this)
                .setTitle("Izin Lokasi Ditolak")
                .setMessage("Tanpa izin lokasi, koordinat GPS otomatis dan perekaman jalur tidak dapat aktif. Anda tetap bisa mencatat waypoint secara manual.")
                .setPositiveButton("Minta Izin Lagi") { _, _ ->
                    launchLocationPermissionRequest()
                }
                .setNegativeButton("Lanjut Tanpa GPS", null)
                .show()
        } else {
            updatePermissionDeniedLabels("Izin lokasi ditolak permanen. Aktifkan di Pengaturan Aplikasi.")
            AlertDialog.Builder(this)
                .setTitle("Izin Lokasi Dinonaktifkan")
                .setMessage("Izin lokasi ditolak secara permanen. Buka Pengaturan Aplikasi lalu aktifkan izin Lokasi untuk memakai sensor GNSS.")
                .setPositiveButton("Buka Pengaturan") { _, _ ->
                    openAppLocationSettings()
                }
                .setNegativeButton("Mode Manual", null)
                .show()
        }
    }

    private fun updatePermissionDeniedLabels(message: String) {
        mapStatusTextView?.text = "Status: $message"
        surveyStatusTextView?.text = message
    }

    private fun openAppLocationSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", packageName, null)
        )
        startActivity(intent)
    }

    private fun writeTextToUri(uri: Uri, contentText: String, formatLabel: String) {
        val ok = runCatching {
            contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { writer ->
                writer.write(contentText)
            }
            true
        }.getOrDefault(false)
        val msg = if (ok) {
            "Ekspor $formatLabel berhasil disimpan (\${waypoints.size} waypoint, \${trackPoints.size} titik jalur)."
        } else {
            "Gagal menyimpan berkas $formatLabel."
        }
        surveyStatusTextView?.text = msg
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    private fun text(value: String, size: Float, color: Int = Color.BLACK, bold: Boolean = false): TextView =
        TextView(this).apply {
            text = value
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(4), dp(6), dp(4), dp(6))
        }

    private fun releaseMapIfActive() {
        stopCompassSensor()
        mapController?.destroyMapView()
        mapController = null
    }

    private fun baseScreen(title: String, screen: Screen) {
        if (screen != Screen.MAP) {
            releaseMapIfActive()
        }
        currentScreen = screen

        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(paleBg)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val header = TextView(this).apply {
            text = "D H Y Explorer  |  $title"
            textSize = 19f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(16), dp(18), dp(12), dp(18))
            setBackgroundColor(primaryBlue)
        }
        outer.addView(header)

        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(24))
        }
        scroll.addView(content)
        outer.addView(scroll)

        ViewCompat.setOnApplyWindowInsetsListener(outer) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            header.setPadding(
                dp(16),
                dp(14) + systemBars.top,
                dp(12),
                dp(14)
            )
            content.setPadding(
                dp(16) + systemBars.left,
                dp(12),
                dp(16) + systemBars.right,
                dp(24) + systemBars.bottom
            )
            insets
        }

        setContentView(outer)
    }

    private fun addButton(label: String, action: () -> Unit): Button {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            setTextColor(Color.WHITE)
            setBackgroundColor(primaryBlue)
            setPadding(dp(14), dp(10), dp(14), dp(10))
            setOnClickListener { action() }
        }
        content.addView(
            b,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(8) }
        )
        return b
    }

    private fun showHome() {
        baseScreen("GIS Lapangan Indonesia", Screen.HOME)
        content.addView(text("Pemetaan • Survei • Analisis (v0.4.0 — ngek@)", 16f, accentBlue, true))
        content.addView(
            text(
                "Aplikasi D H Y Explorer Android (v0.4.0) oleh pengembang ngek@. Dilengkapi kompas orientasi real-time, Grid UTM ON/OFF, GNSS & akurasi posisi, waypoint & track survei, kalkulasi jarak, serta ekspor CSV/GeoJSON/GPX.",
                14f
            )
        )
        addButton("Peta Utama, GNSS & Kompas Real-Time", ::showMapPreview)
        addButton("GPS, Waypoint, Rekam Jalur & Ekspor", ::showSurveyAndGps)
        addButton("Sistem Koordinat WGS 84 / UTM", ::showCoordinates)
        addButton("Versi & Info Pengembang") {
            showInfo(
                "D H Y Explorer v0.4.0",
                "Pengembang: ngek@\\n\\n" +
                    "• Izin lokasi runtime & penanganan penolakan izin\\n" +
                    "• Posisi GNSS real-time, akurasi (±m), Zona UTM & EPSG\\n" +
                    "• Tambah & edit atribut waypoint serta rekam jalur perjalanan\\n" +
                    "• Hitung jarak survei & ekspor CSV, GeoJSON, dan GPX"
            )
        }
    }

    private fun showSurveyAndGps() {
        baseScreen("GPS & Survei GNSS", Screen.SURVEY)

        val statusView = text(formatGnssSummaryText(), 13f)
        surveyStatusTextView = statusView
        content.addView(statusView)

        val trackDist = WaypointExporter.polylineDistanceMeters(trackPoints)
        val wpRouteDist = WaypointExporter.polylineDistanceMeters(
            waypoints.map { TrackPoint(it.latitude, it.longitude, it.elevationM, it.accuracyM) }
        )
        val trackView = text(
            String.format(
                Locale.US,
                "Jalur Terekam: %d titik (%s)\\nTotal Rute %d Waypoint: %s",
                trackPoints.size,
                WaypointExporter.formatDistanceId(trackDist),
                waypoints.size,
                WaypointExporter.formatDistanceId(wpRouteDist)
            ),
            13f,
            accentBlue,
            true
        )
        trackStatusTextView = trackView
        content.addView(trackView)

        addButton("Baca / Segarkan Posisi GNSS") {
            ensureLocationPermission {
                centerOnLastKnownGnss()
                surveyStatusTextView?.text = formatGnssSummaryText()
            }
        }

        if (permissionDeniedState && !hasLocationPermission()) {
            addButton("Buka Pengaturan Izin Lokasi", ::openAppLocationSettings)
        }

        val recBtn = addButton(
            if (isRecordingTrack) "Hentikan Rekam Jalur (\${trackPoints.size} titik)" else "Mulai Rekam Jalur Perjalanan"
        ) {}
        recBtn.setOnClickListener {
            if (isRecordingTrack) {
                isRecordingTrack = false
                recBtn.text = "Mulai Rekam Jalur Perjalanan"
                refreshTrackSummaryView()
            } else {
                ensureLocationPermission {
                    trackPoints.clear()
                    lastGnssLocation?.let {
                        trackPoints.add(
                            TrackPoint(
                                it.latitude,
                                it.longitude,
                                if (it.hasAltitude()) it.altitude else null,
                                if (it.hasAccuracy()) it.accuracy else null
                            )
                        )
                    }
                    isRecordingTrack = true
                    recBtn.text = "Hentikan Rekam Jalur (\${trackPoints.size} titik)"
                    refreshTrackSummaryView()
                }
            }
        }

        addButton("Tangkap GPS Sebagai Waypoint") {
            ensureLocationPermission {
                val loc = lastGnssLocation
                if (loc != null) {
                    val nextIdx = waypoints.size + 1
                    waypoints.add(
                        0,
                        SurveyWaypoint(
                            id = "wp-\${System.currentTimeMillis()}",
                            label = "GPS-\${String.format(Locale.US, "%02d", nextIdx)}",
                            latitude = loc.latitude,
                            longitude = loc.longitude,
                            elevationM = if (loc.hasAltitude()) loc.altitude else null,
                            accuracyM = if (loc.hasAccuracy()) loc.accuracy else null,
                            category = "Survei",
                            note = "Tangkapan GNSS Android"
                        )
                    )
                    showSurveyAndGps()
                } else {
                    surveyStatusTextView?.text = "Menunggu fix GNSS perangkat terlebih dahulu..."
                }
            }
        }

        addButton("Tambah Waypoint Manual") {
            showEditOrAddWaypointDialog(null)
        }

        addButton("Ekspor Hasil Survei ke CSV") {
            exportCsvLauncher.launch("dhy_explorer_survei.csv")
        }
        addButton("Ekspor Hasil Survei ke GeoJSON") {
            exportGeoJsonLauncher.launch("dhy_explorer_survei.geojson")
        }
        addButton("Ekspor Hasil Survei ke GPX") {
            exportGpxLauncher.launch("dhy_explorer_survei.gpx")
        }

        content.addView(text("Daftar Waypoint & Jarak dari GPS", 15f, primaryBlue, true))
        waypoints.forEach { wp ->
            val distFromGps = lastGnssLocation?.let { loc ->
                val d = WaypointExporter.haversineDistanceMeters(
                    loc.latitude,
                    loc.longitude,
                    wp.latitude,
                    wp.longitude
                )
                " | Jarak GPS: \${WaypointExporter.formatDistanceId(d)}"
            } ?: ""
            val accLabel = wp.accuracyM?.let { String.format(Locale.US, " | Akurasi ±%.1f m", it) } ?: ""
            addButton(
                "\${wp.label} (\${wp.utmZoneLabel} · EPSG:\${wp.epsg ?: "-"})\\n" +
                    String.format(Locale.US, "%.5f°, %.5f°%s%s", wp.latitude, wp.longitude, accLabel, distFromGps)
            ) {
                showEditOrAddWaypointDialog(wp)
            }
        }

        addButton("Kembali ke Beranda", ::showHome)
    }

    private fun refreshTrackSummaryView() {
        val trackDist = WaypointExporter.polylineDistanceMeters(trackPoints)
        val wpRouteDist = WaypointExporter.polylineDistanceMeters(
            waypoints.map { TrackPoint(it.latitude, it.longitude, it.elevationM, it.accuracyM) }
        )
        trackStatusTextView?.text = String.format(
            Locale.US,
            "Jalur Terekam: %d titik (%s)\\nTotal Rute %d Waypoint: %s",
            trackPoints.size,
            WaypointExporter.formatDistanceId(trackDist),
            waypoints.size,
            WaypointExporter.formatDistanceId(wpRouteDist)
        )
    }

    private fun formatGnssSummaryText(): String {
        val loc = lastGnssLocation
        if (loc == null) {
            return if (!hasLocationPermission()) {
                "Izin lokasi belum diberikan. Ketuk 'Baca / Segarkan Posisi GNSS' untuk meminta izin."
            } else {
                "Penerima GNSS aktif, menunggu sinyal lokasi..."
            }
        }
        val zone = IndonesiaUtmZones.zoneFor(loc.longitude)
        val epsg = IndonesiaUtmZones.epsgFor(loc.latitude, loc.longitude)
        val utmLabel = if (zone != null && epsg != null) {
            "Zona \${zone.number}\${if (loc.latitude >= 0) "N" else "S"} · EPSG:$epsg"
        } else {
            "Di luar zona 46–54"
        }
        val accText = if (loc.hasAccuracy()) String.format(Locale.US, "±%.1f m", loc.accuracy) else "—"
        val eleText = if (loc.hasAltitude()) String.format(Locale.US, "%.1f m", loc.altitude) else "—"
        return String.format(
            Locale.US,
            "GNSS Aktif (%s)\\nLat: %.6f° | Lon: %.6f°\\nAkurasi: %s | Elevasi: %s\\nUTM: %s",
            loc.provider ?: "GPS",
            loc.latitude,
            loc.longitude,
            accText,
            eleText,
            utmLabel
        )
    }

    private fun showEditOrAddWaypointDialog(existing: SurveyWaypoint?) {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(4))
        }
        val labelInput = EditText(this).apply {
            hint = "Label Waypoint"
            setText(existing?.label ?: "Titik-\${waypoints.size + 1}")
        }
        val categoryInput = EditText(this).apply {
            hint = "Kategori (Titik Kontrol / Batas Lahan / Survei)"
            setText(existing?.category ?: "Survei")
        }
        val latInput = EditText(this).apply {
            hint = "Latitude (-5.1478)"
            setText(
                existing?.latitude?.let { String.format(Locale.US, "%.6f", it) }
                    ?: lastGnssLocation?.latitude?.let { String.format(Locale.US, "%.6f", it) }
                    ?: "-5.147800"
            )
        }
        val lonInput = EditText(this).apply {
            hint = "Longitude (119.4321)"
            setText(
                existing?.longitude?.let { String.format(Locale.US, "%.6f", it) }
                    ?: lastGnssLocation?.longitude?.let { String.format(Locale.US, "%.6f", it) }
                    ?: "119.432100"
            )
        }
        val elevInput = EditText(this).apply {
            hint = "Elevasi m (opsional)"
            setText(existing?.elevationM?.let { String.format(Locale.US, "%.1f", it) } ?: "")
        }
        val noteInput = EditText(this).apply {
            hint = "Catatan lapangan"
            setText(existing?.note ?: "")
        }
        listOf(labelInput, categoryInput, latInput, lonInput, elevInput, noteInput).forEach {
            layout.addView(it)
        }

        val builder = AlertDialog.Builder(this)
            .setTitle(if (existing == null) "Tambah Waypoint Baru" else "Edit Atribut Waypoint")
            .setView(layout)
            .setPositiveButton("Simpan") { _, _ ->
                val lbl = labelInput.text.toString().trim().ifEmpty { "Titik Survei" }
                val lat = latInput.text.toString().toDoubleOrNull() ?: return@setPositiveButton
                val lon = lonInput.text.toString().toDoubleOrNull() ?: return@setPositiveButton
                val elev = elevInput.text.toString().toDoubleOrNull()
                val cat = categoryInput.text.toString().trim().ifEmpty { "Survei" }
                val note = noteInput.text.toString().trim()

                if (existing == null) {
                    waypoints.add(
                        0,
                        SurveyWaypoint(
                            id = "wp-\${System.currentTimeMillis()}",
                            label = lbl,
                            latitude = lat,
                            longitude = lon,
                            elevationM = elev,
                            category = cat,
                            note = note
                        )
                    )
                } else {
                    val idx = waypoints.indexOfFirst { it.id == existing.id }
                    if (idx >= 0) {
                        waypoints[idx] = existing.copy(
                            label = lbl,
                            latitude = lat,
                            longitude = lon,
                            elevationM = elev,
                            category = cat,
                            note = note
                        )
                    }
                }
                showSurveyAndGps()
            }
            .setNegativeButton("Batal", null)

        if (existing != null) {
            builder.setNeutralButton("Hapus") { _, _ ->
                waypoints.removeAll { it.id == existing.id }
                showSurveyAndGps()
            }
        }
        builder.show()
    }

    private fun showMapPreview() {
        releaseMapIfActive()
        baseScreen("Peta Utama", Screen.MAP)

        val mapContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(220, 232, 245))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(380)
            ).apply { bottomMargin = dp(10) }
        }
        content.addView(mapContainer)

        val compassBadge = TextView(this).apply {
            text = "Kompas: 0° U (Reset)"
            textSize = 12f
            setTextColor(primaryBlue)
            setTypeface(typeface, Typeface.BOLD)
            setBackgroundColor(Color.argb(235, 255, 255, 255))
            setPadding(dp(10), dp(6), dp(10), dp(6))
            setOnClickListener {
                stopCompassSensor()
                mapController?.resetNorth()
                text = "Kompas: 0° U (Reset)"
            }
        }
        compassTextView = compassBadge

        val infoPanel = text("Menyiapkan mesin peta MapLibre...", 13f).apply {
            visibility = if (wgs84Visible) View.VISIBLE else View.GONE
        }
        mapStatusTextView = infoPanel
        content.addView(infoPanel)

        val controller = GeoMapController(this)
        mapController = controller

        val mapBundle = savedStateForMap
        savedStateForMap = null

        val mapView = controller.createMapView(
            savedInstanceState = mapBundle,
            onCoordinateChanged = { lat, lon, zoom, bearing, sourceStatus ->
                val zone = IndonesiaUtmZones.zoneFor(lon)
                val epsg = IndonesiaUtmZones.epsgFor(lat, lon)
                val utmLabel = if (epsg == null || zone == null) {
                    "Di luar zona 46–54"
                } else {
                    val hemi = if (lat >= 0.0) "N" else "S"
                    "Zona \${zone.number}$hemi (EPSG:$epsg)"
                }
                val normBearing = (((bearing % 360.0) + 360.0) % 360.0).roundToInt()
                if (!compassActive) {
                    compassBadge.text = "Kompas: \${normBearing}° (\${cardinalId(normBearing)})"
                }
                val accInfo = lastGnssLocation?.let {
                    if (it.hasAccuracy()) String.format(Locale.US, " | Akurasi GNSS: ±%.1f m", it.accuracy) else ""
                } ?: ""
                infoPanel.text = String.format(
                    Locale.US,
                    "Status: %s\\nLat: %.5f° | Lon: %.5f° | Zoom: %.2f\\nUTM: %s%s",
                    sourceStatus,
                    lat,
                    lon,
                    zoom,
                    utmLabel,
                    accInfo
                )
            },
            onFeatureClicked = { feat ->
                showFeatureAttributeAndColorDialog(feat, controller)
            },
            onError = { message ->
                mapContainer.removeAllViews()
                mapContainer.addView(
                    text("MapLibre gagal: $message", 14f, Color.rgb(160, 30, 30))
                )
            }
        )

        if (mapView != null) {
            mapContainer.addView(
                mapView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
            mapContainer.addView(
                compassBadge,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.TOP or Gravity.END
                ).apply { setMargins(0, dp(10), dp(10), 0) }
            )
            controller.onStart()
            controller.onResume()
        }

        val gridBtn = addButton("Grid UTM: \${if (utmGridOn) "ON" else "OFF"}") {}
        gridBtn.setOnClickListener {
            utmGridOn = !utmGridOn
            controller.setUtmGridEnabled(utmGridOn)
            gridBtn.text = "Grid UTM: \${if (utmGridOn) "ON" else "OFF"}"
        }

        val coordToggleBtn = addButton("Koordinat WGS 84: \${if (wgs84Visible) "TAMPIL" else "SEMBUNYI"}") {}
        coordToggleBtn.setOnClickListener {
            wgs84Visible = !wgs84Visible
            infoPanel.visibility = if (wgs84Visible) View.VISIBLE else View.GONE
            coordToggleBtn.text = "Koordinat WGS 84: \${if (wgs84Visible) "TAMPIL" else "SEMBUNYI"}"
        }

        val sensorBtn = addButton("Aktifkan Sensor Kompas Real-Time") {}
        sensorBtn.setOnClickListener {
            if (compassActive) {
                stopCompassSensor()
                sensorBtn.text = "Aktifkan Sensor Kompas Real-Time"
            } else {
                startCompassSensor()
                sensorBtn.text = "Matikan Sensor Kompas (Live)"
            }
        }

        addButton("Pusatkan ke Posisi GNSS") {
            ensureLocationPermission {
                centerOnLastKnownGnss()
            }
        }

        addButton("GPS, Waypoint & Ekspor Survei", ::showSurveyAndGps)

        addButton("Impor Berkas GeoJSON Lokal") {
            openGeoJsonLauncher.launch(arrayOf("application/geo+json", "application/json", "*/*"))
        }

        content.addView(text("Pilih Peta Dasar", 15f, accentBlue, true))
        listOf(
            BasemapCatalog.Source.ESRI_WORLD_IMAGERY,
            BasemapCatalog.Source.GOOGLE_SATELLITE,
            BasemapCatalog.Source.GOOGLE_HYBRID,
            BasemapCatalog.Source.GOOGLE_ROADMAP,
            BasemapCatalog.Source.OPENSTREETMAP
        ).forEach { basemap ->
            addButton(basemap.displayName) {
                controller.setBasemap(basemap) { statusText ->
                    infoPanel.text = "Status: $statusText"
                }
            }
        }

        addButton("Kembali ke Beranda", ::showHome)
    }

    @SuppressLint("MissingPermission")
    private fun startLiveLocationUpdates() {
        if (!hasLocationPermission() || locationUpdatesActive) return
        val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
        runCatching {
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000L, 2f, this)
            }
            if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 4000L, 5f, this)
            }
            val last = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            if (last != null) {
                lastGnssLocation = last
            }
            locationUpdatesActive = true
        }
    }

    private fun stopLiveLocationUpdates() {
        if (!locationUpdatesActive) return
        val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
        runCatching {
            lm.removeUpdates(this)
        }
        locationUpdatesActive = false
    }

    @SuppressLint("MissingPermission")
    private fun centerOnLastKnownGnss() {
        val lm = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
        val loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
            ?: lastGnssLocation
        if (loc != null) {
            lastGnssLocation = loc
            mapController?.centerCameraAt(loc.latitude, loc.longitude, 15.0)
            val accText = if (loc.hasAccuracy()) String.format(Locale.US, " · ±%.1f m", loc.accuracy) else ""
            mapStatusTextView?.text = String.format(
                Locale.US,
                "Status: GNSS aktif (%.5f°, %.5f°%s)",
                loc.latitude,
                loc.longitude,
                accText
            )
        } else {
            mapStatusTextView?.text = "Status: Menunggu sinyal GNSS perangkat..."
        }
    }

    override fun onLocationChanged(location: Location) {
        lastGnssLocation = location
        if (isRecordingTrack) {
            val prev = trackPoints.lastOrNull()
            val movedEnough = prev == null || WaypointExporter.haversineDistanceMeters(
                prev.latitude,
                prev.longitude,
                location.latitude,
                location.longitude
            ) >= 1.5
            if (movedEnough) {
                trackPoints.add(
                    TrackPoint(
                        latitude = location.latitude,
                        longitude = location.longitude,
                        elevationM = if (location.hasAltitude()) location.altitude else null,
                        accuracyM = if (location.hasAccuracy()) location.accuracy else null
                    )
                )
            }
        }
        if (currentScreen == Screen.SURVEY) {
            surveyStatusTextView?.text = formatGnssSummaryText()
            refreshTrackSummaryView()
        }
    }

    private fun showFeatureAttributeAndColorDialog(
        feature: GeoMapController.ClickedVectorFeature,
        controller: GeoMapController
    ) {
        val attrText = if (feature.attributes.isEmpty()) {
            "Tidak ada atribut tambahan."
        } else {
            feature.attributes.entries.joinToString("\\n") { (k, v) -> "$k : $v" }
        }
        val colorChoices = listOf(
            "Biru Kobalt (#0F5EC4)" to "#0F5EC4",
            "Hijau Hutan (#16A34A)" to "#16A34A",
            "Merah Survei (#EF4444)" to "#EF4444",
            "Jingga Kontur (#D97706)" to "#D97706",
            "Ungu Batas (#7C3AED)" to "#7C3AED"
        )
        AlertDialog.Builder(this)
            .setTitle("\${feature.layerLabel} (\${feature.geometryType})")
            .setMessage("Koordinat: \${String.format(Locale.US, "%.5f, %.5f", feature.latitude, feature.longitude)}\\n\\nTabel Atribut:\\n$attrText")
            .setPositiveButton("Ubah Warna") { _, _ ->
                AlertDialog.Builder(this)
                    .setTitle("Pilih Warna Fitur")
                    .setItems(colorChoices.map { it.first }.toTypedArray()) { _, which ->
                        controller.setVectorFeatureColor(colorChoices[which].second)
                    }
                    .show()
            }
            .setNeutralButton("Catatan Atribut") { _, _ ->
                val noteInput = EditText(this).apply {
                    hint = "Catatan lapangan oleh ngek@"
                }
                AlertDialog.Builder(this)
                    .setTitle("Tambah Catatan Atribut")
                    .setView(noteInput)
                    .setPositiveButton("Simpan") { _, _ ->
                        mapStatusTextView?.text = "Atribut diperbarui: \${noteInput.text}"
                    }
                    .setNegativeButton("Batal", null)
                    .show()
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    private fun startCompassSensor() {
        val rotSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        if (rotSensor != null) {
            compassActive = true
            sensorManager?.registerListener(this, rotSensor, SensorManager.SENSOR_DELAY_UI)
        }
    }

    private fun stopCompassSensor() {
        compassActive = false
        sensorManager?.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (!compassActive || event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
        val rotMatrix = FloatArray(9)
        val orientation = FloatArray(3)
        SensorManager.getRotationMatrixFromVector(rotMatrix, event.values)
        SensorManager.getOrientation(rotMatrix, orientation)
        val azimuthDeg = ((Math.toDegrees(orientation[0].toDouble()) + 360.0) % 360.0)
        val degInt = azimuthDeg.roundToInt()
        compassTextView?.text = "Kompas Live: \${degInt}° (\${cardinalId(degInt)})"
        mapController?.setCameraBearing(azimuthDeg)
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun cardinalId(deg: Int): String = when (((deg + 22) % 360) / 45) {
        0 -> "U"
        1 -> "TL"
        2 -> "T"
        3 -> "TG"
        4 -> "S"
        5 -> "BD"
        6 -> "B"
        else -> "BL"
    }

    private fun showCoordinates() {
        baseScreen("Sistem Koordinat", Screen.COORDINATES)
        content.addView(text("Zona UTM Indonesia (46–54)", 18f, primaryBlue, true))
        val examples = listOf(-5.1 to 119.0, -4.0 to 135.0, 1.0 to 103.0, -8.0 to 140.0)
        examples.forEach { (lat, lon) ->
            val epsg = IndonesiaUtmZones.epsgFor(lat, lon)
            val zone = IndonesiaUtmZones.zoneFor(lon)
            val label = if (epsg == null) "Di luar cakupan" else "Zona \${zone?.number}\${if (lat >= 0) "N" else "S"}, EPSG:$epsg"
            content.addView(text(String.format(Locale.US, "Lat %.4f°, Lon %.4f° → %s", lat, lon, label), 14f))
        }
        addButton("Kembali ke Beranda", ::showHome)
    }

    private fun showInfo(title: String, message: String) {
        infoTitle = title
        infoMessage = message
        baseScreen(title, Screen.INFO)
        content.addView(text(title, 18f, primaryBlue, true))
        content.addView(text(message, 15f))
        addButton("Kembali ke Beranda", ::showHome)
    }

    override fun onStart() {
        super.onStart()
        mapController?.onStart()
    }

    override fun onResume() {
        super.onResume()
        mapController?.onResume()
        if (hasLocationPermission()) {
            permissionDeniedState = false
            startLiveLocationUpdates()
        }
    }

    override fun onPause() {
        stopCompassSensor()
        if (!isRecordingTrack) {
            stopLiveLocationUpdates()
        }
        mapController?.onPause()
        super.onPause()
    }

    override fun onStop() {
        mapController?.onStop()
        super.onStop()
    }

    override fun onLowMemory() {
        super.onLowMemory()
        mapController?.onLowMemory()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(KEY_SCREEN, currentScreen.name)
        outState.putString(KEY_INFO_TITLE, infoTitle)
        outState.putString(KEY_INFO_MESSAGE, infoMessage)
        mapController?.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        stopLiveLocationUpdates()
        releaseMapIfActive()
        super.onDestroy()
    }
}
`;

export const ANDROID_UTM_TEST_KT = `package id.geoexplorer.app.core.coordinates

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
`;

export const ANDROID_WAYPOINT_TEST_KT = `package id.geoexplorer.app.core.vector

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
        assertEquals("wp-1,\\"Makassar, Pelabuhan\\",-5.100000,119.000000,Zona 50S,32750", lines[1])
    }

    @Test fun geoJsonExportProducesValidFeatureCollection() {
        val json = WaypointExporter.toGeoJson(
            listOf(SurveyWaypoint("wp-2", "Timika", -4.0, 135.0))
        )
        assertTrue(json.contains("\\"type\\": \\"FeatureCollection\\""))
        assertTrue(json.contains("\\"epsg\\": 32753"))
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

        assertTrue(gpx.contains("<wpt lat=\\"-5.147800\\" lon=\\"119.432100\\">"))
        assertTrue(gpx.contains("<trkseg>"))
        assertTrue(geoJson.contains("\\"LineString\\""))
        assertTrue(surveyCsv.contains("TRK-001"))
        assertTrue(WaypointExporter.polylineDistanceMeters(track) > 1000.0)
    }
}
`;

export const ANDROID_MAPLIBRE_CONFIG_TEST_KT = `package id.geoexplorer.app.core.map

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
        assertTrue(json.contains("\\"version\\": 8"))
        assertTrue(json.contains("\\"sources\\""))
        assertTrue(json.contains("\\"layers\\""))
    }
}
`;

export const ANDROID_PROJECT_DEFINITION_TEST_KT = `package id.geoexplorer.app.core.project

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectDefinitionTest {
    @Test fun defaultProjectMetadataIsValid() {
        assertTrue(ProjectDefinition(id = "project-1", name = "Survei Pesisir").isValid)
    }

    @Test fun blankNameIsRejected() {
        assertFalse(ProjectDefinition(id = "project-1", name = " ").isValid)
    }

    @Test fun blankIdAuthorityScopeOrNonPositiveCrsIsRejected() {
        assertFalse(ProjectDefinition(id = "", name = "Survei").isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", crsAuthority = " ").isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", crsCode = 0).isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", crsCode = -4326).isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", countryScope = "").isValid)
    }

    @Test fun validationErrorsListDescribesInvalidFields() {
        val errors = ProjectDefinition(id = "", name = "", crsCode = 0).validationErrors()
        assertTrue(errors.contains("ID proyek tidak boleh kosong"))
        assertTrue(errors.contains("Nama proyek tidak boleh kosong"))
        assertTrue(errors.contains("Kode CRS harus berupa bilangan positif"))
    }
}
`;

export const GITATTRIBUTES_CONTENT = `* text=auto
*.sh text eol=lf
android-studio-project/gradlew text eol=lf
*.bat text eol=crlf
*.jar binary
*.apk binary
*.aab binary
`;

export const GITHUB_WORKFLOW_YML = `name: Build D H Y Explorer APK & Web

on:
  push:
    branches: [ main, master ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-android-apk:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: android-studio-project
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Set up Android SDK
        uses: android-actions/setup-android@v3

      - name: Set up Gradle cache
        uses: gradle/actions/setup-gradle@v4

      - name: Verify Gradle Wrapper & permissions
        run: |
          test -f gradle/wrapper/gradle-wrapper.jar
          chmod +x gradlew

      - name: Run Android unit tests and build Debug & Release APK
        run: ./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease --no-daemon

      - name: Prepare downloadable APK files
        run: |
          mkdir -p dist-apk
          cp app/build/outputs/apk/debug/app-debug.apk dist-apk/DHY-Explorer-v0.4.0-debug.apk
          cp app/build/outputs/apk/release/app-release-unsigned.apk dist-apk/DHY-Explorer-v0.4.0-release-unsigned.apk
          ls -lh dist-apk

      - name: Upload D H Y Explorer APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: DHY-Explorer-v0.4.0-APK
          path: android-studio-project/dist-apk/*.apk
          retention-days: 30

      - name: Publish APK to GitHub Releases
        if: github.event_name != 'pull_request'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ startsWith(github.ref, 'refs/tags/') && github.ref_name || 'v0.4.0-apk' }}
          name: D H Y Explorer v0.4.0 (ngek@)
          body: |
            Build otomatis APK Android **D H Y Explorer v0.4.0** (Pengembang: \`ngek@\`).

            - **\`DHY-Explorer-v0.4.0-debug.apk\`**: Siap diunduh dan langsung dipasang (install) pada perangkat Android.
            - **\`DHY-Explorer-v0.4.0-release-unsigned.apk\`**: Paket rilis untuk penandatanganan keystore produksi.
          files: |
            android-studio-project/dist-apk/DHY-Explorer-v0.4.0-debug.apk
            android-studio-project/dist-apk/DHY-Explorer-v0.4.0-release-unsigned.apk
          draft: false
          prerelease: false

  verify-web-app:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run unit tests, TypeScript lint, and Web build
        run: npm ci && npm test && npm run lint && npm run build
`;

export const ANDROID_README_MD = `# D H Y Explorer — Proyek Android Studio & GitHub (v0.4.0)

**Pengembang:** \`ngek@\`

Panduan membuka di Android Studio, membangun APK, dan mengunduh APK langsung dari GitHub Releases atau GitHub Actions:

## 1. Membuka & Build APK di Android Studio
1. Ekstrak folder \`android-studio-project\` (atau clone repositori GitHub ini).
2. Buka **Android Studio** -> **Open** -> pilih folder \`android-studio-project\`.
3. Tunggu Gradle Sync selesai (Gradle Wrapper 8.9 lengkap dengan \`gradlew\`, \`gradlew.bat\`, dan \`gradle-wrapper.jar\` + JDK 17 + Compile SDK 35).
4. Untuk langsung memasang ke HP Android (via USB Debugging) tekan **Run 'app'**, atau pilih **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** untuk menghasilkan berkas \`app/build/outputs/apk/debug/app-debug.apk\` yang siap disalin dan diinstal di perangkat Android.

## 2. Pengujian & Build APK Lokal via Gradle Wrapper
\`\`\`bash
cd android-studio-project
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease
\`\`\`
*(Di Windows gunakan \`gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease\`)*

## 3. Build & Unduh APK Otomatis di GitHub (Releases & Actions)
1. Push seluruh repositori termasuk \`.gitattributes\` dan \`.github/workflows/build-apk.yml\` ke branch \`main\` (atau jalankan manual dari tab **Actions -> Run workflow**).
2. Setelah workflow selesai, unduh APK melalui dua cara:
   - **GitHub Releases (1-Klik Unduh APK):** Buka menu **Releases** di sisi kanan repositori lalu unduh langsung \`DHY-Explorer-v0.4.0-debug.apk\` (siap pasang di Android).
   - **GitHub Actions Artifacts:** Buka tab **Actions** -> pilih run terbaru -> unduh artefak \`DHY-Explorer-v0.4.0-APK\`.

## Fitur v0.4.0 (oleh ngek@)
- Kompas orientasi real-time (Sensor Rotasi Android & kontrol manual + Reset Utara)
- Toggle **Grid UTM ON/OFF** (Zona 46–54 Indonesia & Garis Ekuator) dan toggle **Tampil/Sembunyi Koordinat WGS 84**
- Izin lokasi runtime & penanganan penolakan izin (\`LocationManager\` + Pengaturan Aplikasi)
- Posisi GNSS real-time, akurasi posisi (\`±m\`), zona UTM & EPSG, tambah/edit atribut waypoint, rekam jalur perjalanan, hitung jarak survei, serta ekspor CSV, GeoJSON, dan GPX
- Impor berkas GeoJSON lokal (\`OpenDocument\`) serta klik fitur poliline/poligon/titik untuk melihat atribut & ubah warna
- Kelengkapan penuh **Gradle Wrapper 8.9** (\`gradlew\`, \`gradlew.bat\`, \`gradle-wrapper.jar\`)
`;

export const ANDROID_STATUS_MD = `# Status Pengembangan D H Y Explorer — v0.4.0

**Pengembang:** \`ngek@\`

## Peningkatan & Perbaikan v0.4.0
1. **Gradle Wrapper 8.9 Lengkap & \`.gitattributes\`**: Berkas \`gradlew\`, \`gradlew.bat\`, \`gradle/wrapper/gradle-wrapper.jar\`, \`gradle/wrapper/gradle-wrapper.properties\`, dan \`.gitattributes\` sudah disertakan lengkap agar eksekusi Gradle di Linux/macOS/Windows dan GitHub Actions bebas masalah line-ending.
2. **Build & Unduh APK di GitHub & Android Studio**: Workflow \`.github/workflows/build-apk.yml\` menjalankan unit test, membangun \`DHY-Explorer-v0.4.0-debug.apk\` dan \`DHY-Explorer-v0.4.0-release-unsigned.apk\`, mengunggah artefak \`DHY-Explorer-v0.4.0-APK\`, serta menerbitkan langsung ke **GitHub Releases** untuk unduhan 1-klik.
3. **Fitur Survei GNSS & Peta Lengkap**:
   - Web & Android: Koordinat WGS 84 (tampil/sembunyi), Grid UTM ON/OFF, Kompas real-time, GPS/GNSS + akurasi posisi, tambah/edit waypoint, rekam jalur perjalanan, hitung jarak survei, ekspor CSV/GeoJSON/GPX, serta permintaan dan penanganan penolakan izin lokasi runtime.
4. **Unit Test Lengkap**:
   - Web/TypeScript (\`npm test\`): Menguji Zona UTM Indonesia, geodesi/snap/seleksi spasial/validasi topologi, ekspor CSV/GeoJSON/GPX, metadata proyek, dan paritas templat Android+GitHub.
   - Android/JUnit (\`IndonesiaUtmZonesTest\`, \`WaypointExporterTest\`, \`MapLibreConfigTest\`, \`ProjectDefinitionTest\`): Disertakan lengkap pada \`app/src/test/\`.

## Status Pemeriksaan Build
- **Web TypeScript (\`npm test\`, \`npm run lint\`, \`npm run build\`)**: Terverifikasi lulus di lingkungan pengembangan.
- **Android APK (\`./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease\`)**: Dijalankan otomatis pada runner GitHub Actions (\`.github/workflows/build-apk.yml\`) dengan JDK 17 & Android SDK 35, atau langsung melalui Android Studio (**Build > Build APK(s)**) / \`./gradlew\` pada mesin lokal yang memiliki JDK 17 + Android SDK.
`;

export const GRADLEW_UNIX = `#!/bin/sh

##############################################################################
# Gradle start up script for POSIX generated by Gradle 8.9
##############################################################################

app_path=$0
while
    APP_HOME=\${app_path%"\${app_path##*/}"}
    [ -h "$app_path" ]
do
    ls=$( ls -ld "$app_path" )
    link=\${ls#*' -> '}
    case $link in
      /*)   app_path=$link ;;
      *)    app_path=$APP_HOME$link ;;
    esac
done

APP_BASE_NAME=\${0##*/}
APP_HOME=$( cd -P "\${APP_HOME:-./}" > /dev/null && printf '%s\\n' "$PWD" ) || exit

warn () {
    echo "$*"
} >&2

die () {
    echo
    echo "$*"
    echo
    exit 1
} >&2

cygwin=false
msys=false
darwin=false
case "$( uname )" in
  CYGWIN* )         cygwin=true  ;;
  Darwin* )         darwin=true  ;;
  MSYS* | MINGW* )  msys=true    ;;
esac

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

if [ -n "$JAVA_HOME" ] ; then
    if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
        JAVACMD=$JAVA_HOME/jre/sh/java
    else
        JAVACMD=$JAVA_HOME/bin/java
    fi
    if [ ! -x "$JAVACMD" ] ; then
        die "ERROR: JAVA_HOME is set to an invalid directory: $JAVA_HOME"
    fi
else
    JAVACMD=java
    if ! command -v java >/dev/null 2>&1
    then
        die "ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH."
    fi
fi

if "$cygwin" || "$msys" ; then
    APP_HOME=$( cygpath --path --mixed "$APP_HOME" )
    CLASSPATH=$( cygpath --path --mixed "$CLASSPATH" )
    JAVACMD=$( cygpath --unix "$JAVACMD" )
fi

DEFAULT_JVM_OPTS='-Dfile.encoding=UTF-8 "-Xmx64m" "-Xms64m"'

set -- \\
        "-Dorg.gradle.appname=$APP_BASE_NAME" \\
        -classpath "$CLASSPATH" \\
        org.gradle.wrapper.GradleWrapperMain \\
        "$@"

eval "set -- $(
        printf '%s\\n' "$DEFAULT_JVM_OPTS $JAVA_OPTS $GRADLE_OPTS" |
        xargs -n1 |
        sed ' s~[^-[:alnum:]+,./:=@_]~\\\\&~g; ' |
        tr '\\n' ' '
    )" '"$@"'

exec "$JAVACMD" "$@"
`;

export const GRADLEW_BAT = `@if "%DEBUG%"=="" @echo off
@rem Gradle startup script for Windows (Gradle 8.9)
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi
set DEFAULT_JVM_OPTS=-Dfile.encoding=UTF-8 "-Xmx64m" "-Xms64m"

if defined JAVA_HOME goto findJavaFromJavaHome
set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. 1>&2
goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe
if exist "%JAVA_EXE%" goto execute
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME% 1>&2
goto fail

:execute
set CLASSPATH=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
if %ERRORLEVEL% equ 0 goto mainEnd
:fail
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% equ 0 set EXIT_CODE=1
if not ""=="%GRADLE_EXIT_CONSOLE%" exit %EXIT_CODE%
exit /b %EXIT_CODE%
:mainEnd
if "%OS%"=="Windows_NT" endlocal
`;

export function buildAndroidAndGithubFiles(): ProjectPackageFile[] {
  return [
    { path: '.gitattributes', content: GITATTRIBUTES_CONTENT },
    { path: '.github/workflows/build-apk.yml', content: GITHUB_WORKFLOW_YML },
    { path: 'README.md', content: ANDROID_README_MD },
    { path: 'android-studio-project/.gitignore', content: ANDROID_GITIGNORE },
    { path: 'android-studio-project/gradlew', content: GRADLEW_UNIX },
    { path: 'android-studio-project/gradlew.bat', content: GRADLEW_BAT },
    { path: 'android-studio-project/build.gradle.kts', content: ANDROID_GRADLE_ROOT },
    { path: 'android-studio-project/settings.gradle.kts', content: ANDROID_SETTINGS_GRADLE },
    { path: 'android-studio-project/gradle.properties', content: ANDROID_GRADLE_PROPERTIES },
    {
      path: 'android-studio-project/gradle/wrapper/gradle-wrapper.properties',
      content: ANDROID_GRADLE_WRAPPER_PROPERTIES,
    },
    { path: 'android-studio-project/README_MULAI_DI_ANDROID_STUDIO.md', content: ANDROID_README_MD },
    { path: 'android-studio-project/STATUS_PEMBANGUNAN.md', content: ANDROID_STATUS_MD },
    { path: 'android-studio-project/app/build.gradle.kts', content: ANDROID_APP_BUILD_GRADLE },
    { path: 'android-studio-project/app/src/main/AndroidManifest.xml', content: ANDROID_MANIFEST_XML },
    { path: 'android-studio-project/app/src/main/res/values/strings.xml', content: ANDROID_STRINGS_XML },
    { path: 'android-studio-project/app/src/main/res/values/styles.xml', content: ANDROID_STYLES_XML },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/MainActivity.kt',
      content: ANDROID_MAIN_ACTIVITY_KT,
    },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/core/coordinates/IndonesiaUtmZones.kt',
      content: ANDROID_INDONESIA_UTM_ZONES_KT,
    },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/core/map/BasemapCatalog.kt',
      content: ANDROID_BASEMAP_CATALOG_KT,
    },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/core/map/MapLibreConfig.kt',
      content: ANDROID_MAPLIBRE_CONFIG_KT,
    },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/core/map/GeoMapController.kt',
      content: ANDROID_GEO_MAP_CONTROLLER_KT,
    },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/core/project/ProjectDefinition.kt',
      content: ANDROID_PROJECT_DEFINITION_KT,
    },
    {
      path: 'android-studio-project/app/src/main/java/id/geoexplorer/app/core/vector/WaypointExporter.kt',
      content: ANDROID_WAYPOINT_EXPORTER_KT,
    },
    {
      path: 'android-studio-project/app/src/test/java/id/geoexplorer/app/core/coordinates/IndonesiaUtmZonesTest.kt',
      content: ANDROID_UTM_TEST_KT,
    },
    {
      path: 'android-studio-project/app/src/test/java/id/geoexplorer/app/core/vector/WaypointExporterTest.kt',
      content: ANDROID_WAYPOINT_TEST_KT,
    },
    {
      path: 'android-studio-project/app/src/test/java/id/geoexplorer/app/core/map/MapLibreConfigTest.kt',
      content: ANDROID_MAPLIBRE_CONFIG_TEST_KT,
    },
    {
      path: 'android-studio-project/app/src/test/java/id/geoexplorer/app/core/project/ProjectDefinitionTest.kt',
      content: ANDROID_PROJECT_DEFINITION_TEST_KT,
    },
  ];
}

export function downloadGithubWorkflowFile(): void {
  const blob = new Blob([GITHUB_WORKFLOW_YML], { type: 'text/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'build-apk.yml';
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadAndroidGithubZip(): Promise<void> {
  const zip = new JSZip();
  const files = buildAndroidAndGithubFiles();
  for (const file of files) {
    if (file.path === 'android-studio-project/gradlew') {
      zip.file(file.path, file.content, { unixPermissions: '755' });
    } else {
      zip.file(file.path, file.content);
    }
  }
  const resp = await fetch('/android-wrapper/gradle-wrapper.jar');
  if (!resp.ok) {
    throw new Error('Berkas gradle-wrapper.jar tidak ditemukan di server.');
  }
  const jarBuffer = await resp.arrayBuffer();
  zip.file('android-studio-project/gradle/wrapper/gradle-wrapper.jar', jarBuffer);

  const blob = await zip.generateAsync({ type: 'blob', platform: 'UNIX' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DHY_Explorer_GitHub_AndroidStudio_v0.4.0.zip';
  a.click();
  URL.revokeObjectURL(url);
}


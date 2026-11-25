package id.geoexplorer.app

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import id.geoexplorer.app.core.coordinates.IndonesiaUtmZones
import id.geoexplorer.app.core.map.BasemapCatalog
import id.geoexplorer.app.core.map.GeoMapController
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private val navy = Color.rgb(13, 55, 105)
    private val blue = Color.rgb(20, 105, 190)
    private val pale = Color.rgb(239, 245, 252)

    private lateinit var content: LinearLayout
    private var currentScreen: Screen = Screen.HOME
    private var infoTitle: String = ""
    private var infoMessage: String = ""
    private var savedStateForMap: Bundle? = null
    private var mapController: GeoMapController? = null

    private enum class Screen {
        HOME,
        MAP,
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
            Screen.COORDINATES -> showCoordinates()
            Screen.INFO -> {
                val title = savedInstanceState?.getString(KEY_INFO_TITLE).orEmpty()
                val msg = savedInstanceState?.getString(KEY_INFO_MESSAGE).orEmpty()
                if (title.isNotEmpty()) showInfo(title, msg) else showHome()
            }
        }
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
            setBackgroundColor(pale)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val header = TextView(this).apply {
            text = "GeoExplorer  |  $title"
            textSize = 20f
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(16), dp(18), dp(12), dp(18))
            setBackgroundColor(navy)
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

        // Mencegah header dan konten terpotong status bar / navigation bar pada Android 15 (targetSdk 35)
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

    private fun addButton(label: String, action: () -> Unit) {
        val b = Button(this).apply {
            text = label
            isAllCaps = false
            setTextColor(navy)
            setOnClickListener { action() }
        }
        content.addView(
            b,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(7) }
        )
    }

    private fun showHome() {
        baseScreen("GIS Lapangan Indonesia", Screen.HOME)
        content.addView(text("Pemetaan • Survei • Analisis", 16f, blue, true))
        content.addView(
            text(
                "Fondasi aplikasi GeoExplorer. Pilih modul untuk melihat rancangan awal dan status pengembangannya.",
                14f
            )
        )
        addButton("Peta Utama", ::showMapPreview)
        addButton("Sistem Koordinat WGS 84 / UTM", ::showCoordinates)
        addButton("GPS & Survey", { showInfo("GPS & Survey", "Modul GNSS, waypoint, tracking, akurasi, elevasi, dan catatan lapangan akan diintegrasikan pada tahap berikutnya.") })
        addButton("Layer Manager", { showInfo("Layer Manager", "Rencana: mengatur layer raster dan vektor, urutan, visibilitas, transparansi, CRS, dan simbol.") })
        addButton("Data Center", { showInfo("Data Center", "Rencana format: SHP, KML/KMZ, GPX, GeoJSON, GeoPackage, ECW, GeoTIFF, PDF georeferensi, CSV/TXT.") })
        addButton("Digitasi & Editor", { showInfo("Digitasi & Editor", "Rencana: titik, garis, poligon, vertex, snap, undo/redo, atribut, dan warna tiap objek.") })
        addButton("Analisis Spasial", { showInfo("Analisis Spasial", "Rencana: jarak, luas, keliling, bearing, buffer, seleksi spasial, overlay, dan validasi geometri.") })
        addButton("Map Layout & Ekspor", { showInfo("Map Layout", "Rencana: layout A4/A3, judul, legenda, skala, arah utara, grid koordinat, dan ekspor PDF.") })
        content.addView(text("Versi fondasi 0.3.2 • Mesin peta MapLibre disiapkan", 12f, Color.DKGRAY))
    }

    private fun showMapPreview() {
        releaseMapIfActive()
        baseScreen("Peta Utama - MapLibre", Screen.MAP)

        content.addView(text("Kanvas Peta MapLibre", 18f, navy, true))

        val mapContainer = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(220, 232, 245))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(360)
            ).apply { bottomMargin = dp(10) }
        }
        content.addView(mapContainer)

        content.addView(text("Panel informasi lokasi", 16f, blue, true))
        val infoPanel = text(
            "Menyiapkan mesin peta MapLibre...",
            14f
        )
        content.addView(infoPanel)

        val controller = GeoMapController(this)
        mapController = controller

        val mapBundle = savedStateForMap
        savedStateForMap = null

        val mapView = controller.createMapView(
            savedInstanceState = mapBundle,
            onCoordinateChanged = { lat, lon, zoom, sourceStatus ->
                val zone = IndonesiaUtmZones.zoneFor(lon)
                val epsg = IndonesiaUtmZones.epsgFor(lat, lon)
                val utmLabel = if (epsg == null || zone == null) {
                    "Di luar cakupan starter (90°–144° BT)"
                } else {
                    val hemi = if (lat >= 0.0) "N" else "S"
                    "Zona ${zone.number}$hemi (EPSG:$epsg)"
                }
                infoPanel.text = String.format(
                    Locale.US,
                    "Status: %s\nLatitude: %.5f°\nLongitude: %.5f°\nZoom: %.2f\nZona UTM: %s\nAkurasi GPS: menunggu izin lokasi",
                    sourceStatus,
                    lat,
                    lon,
                    zoom,
                    utmLabel
                )
            },
            onError = { message ->
                mapContainer.removeAllViews()
                mapContainer.addView(
                    text(
                        "MapLibre tidak dapat diinisialisasi pada perangkat/emulator ini: $message",
                        14f,
                        Color.rgb(160, 30, 30)
                    )
                )
                infoPanel.text = "Latitude: —\nLongitude: —\nZona UTM: —\nStatus: gagal inisialisasi MapView"
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
            controller.onStart()
            controller.onResume()
        }

        content.addView(text("Sumber Peta & Satelit", 16f, blue, true))
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

    private fun showCoordinates() {
        baseScreen("Sistem Koordinat", Screen.COORDINATES)
        content.addView(text("Zona UTM Indonesia", 18f, navy, true))
        content.addView(
            text(
                "Starter mendukung pemilihan zona UTM standar 46–54 berdasarkan longitude, serta kode EPSG utara/selatan berdasarkan latitude.",
                14f
            )
        )
        val examples = listOf(
            -5.1 to 119.0,
            -4.0 to 135.0,
            1.0 to 103.0,
            -8.0 to 140.0
        )
        examples.forEach { (lat, lon) ->
            val epsg = IndonesiaUtmZones.epsgFor(lat, lon)
            val zone = IndonesiaUtmZones.zoneFor(lon)
            val label = if (epsg == null) {
                "Di luar cakupan starter"
            } else {
                "Zona ${zone?.number}${if (lat >= 0) "N" else "S"}, EPSG:$epsg"
            }
            content.addView(
                text(
                    String.format(Locale.US, "Lat %.4f°, Lon %.4f° → %s", lat, lon, label),
                    14f
                )
            )
        }
        content.addView(text("Catatan", 16f, blue, true))
        content.addView(
            text(
                "CRS asli dari setiap data impor tetap harus dipertahankan. Data SRGI 2013, TM-3, data lintas zona, dan epoch memerlukan transformasi CRS yang benar; fungsi PROJ belum diintegrasikan pada versi ini.",
                14f
            )
        )
        addButton("Kembali ke Beranda", ::showHome)
    }

    private fun showInfo(title: String, message: String) {
        infoTitle = title
        infoMessage = message
        baseScreen(title, Screen.INFO)
        content.addView(text(title, 18f, navy, true))
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
    }

    override fun onPause() {
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
        releaseMapIfActive()
        super.onDestroy()
    }
}

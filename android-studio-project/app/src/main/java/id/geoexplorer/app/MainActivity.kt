package id.geoexplorer.app

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
            "Ekspor $formatLabel berhasil disimpan (${waypoints.size} waypoint, ${trackPoints.size} titik jalur)."
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
                "Pengembang: ngek@\n\n" +
                    "• Izin lokasi runtime & penanganan penolakan izin\n" +
                    "• Posisi GNSS real-time, akurasi (±m), Zona UTM & EPSG\n" +
                    "• Tambah & edit atribut waypoint serta rekam jalur perjalanan\n" +
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
                "Jalur Terekam: %d titik (%s)\nTotal Rute %d Waypoint: %s",
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
            if (isRecordingTrack) "Hentikan Rekam Jalur (${trackPoints.size} titik)" else "Mulai Rekam Jalur Perjalanan"
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
                    recBtn.text = "Hentikan Rekam Jalur (${trackPoints.size} titik)"
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
                            id = "wp-${System.currentTimeMillis()}",
                            label = "GPS-${String.format(Locale.US, "%02d", nextIdx)}",
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
                " | Jarak GPS: ${WaypointExporter.formatDistanceId(d)}"
            } ?: ""
            val accLabel = wp.accuracyM?.let { String.format(Locale.US, " | Akurasi ±%.1f m", it) } ?: ""
            addButton(
                "${wp.label} (${wp.utmZoneLabel} · EPSG:${wp.epsg ?: "-"})\n" +
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
            "Jalur Terekam: %d titik (%s)\nTotal Rute %d Waypoint: %s",
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
            "Zona ${zone.number}${if (loc.latitude >= 0) "N" else "S"} · EPSG:$epsg"
        } else {
            "Di luar zona 46–54"
        }
        val accText = if (loc.hasAccuracy()) String.format(Locale.US, "±%.1f m", loc.accuracy) else "—"
        val eleText = if (loc.hasAltitude()) String.format(Locale.US, "%.1f m", loc.altitude) else "—"
        return String.format(
            Locale.US,
            "GNSS Aktif (%s)\nLat: %.6f° | Lon: %.6f°\nAkurasi: %s | Elevasi: %s\nUTM: %s",
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
            setText(existing?.label ?: "Titik-${waypoints.size + 1}")
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
                            id = "wp-${System.currentTimeMillis()}",
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
                    "Zona ${zone.number}$hemi (EPSG:$epsg)"
                }
                val normBearing = (((bearing % 360.0) + 360.0) % 360.0).roundToInt()
                if (!compassActive) {
                    compassBadge.text = "Kompas: ${normBearing}° (${cardinalId(normBearing)})"
                }
                val accInfo = lastGnssLocation?.let {
                    if (it.hasAccuracy()) String.format(Locale.US, " | Akurasi GNSS: ±%.1f m", it.accuracy) else ""
                } ?: ""
                infoPanel.text = String.format(
                    Locale.US,
                    "Status: %s\nLat: %.5f° | Lon: %.5f° | Zoom: %.2f\nUTM: %s%s",
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

        val gridBtn = addButton("Grid UTM: ${if (utmGridOn) "ON" else "OFF"}") {}
        gridBtn.setOnClickListener {
            utmGridOn = !utmGridOn
            controller.setUtmGridEnabled(utmGridOn)
            gridBtn.text = "Grid UTM: ${if (utmGridOn) "ON" else "OFF"}"
        }

        val coordToggleBtn = addButton("Koordinat WGS 84: ${if (wgs84Visible) "TAMPIL" else "SEMBUNYI"}") {}
        coordToggleBtn.setOnClickListener {
            wgs84Visible = !wgs84Visible
            infoPanel.visibility = if (wgs84Visible) View.VISIBLE else View.GONE
            coordToggleBtn.text = "Koordinat WGS 84: ${if (wgs84Visible) "TAMPIL" else "SEMBUNYI"}"
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
            feature.attributes.entries.joinToString("\n") { (k, v) -> "$k : $v" }
        }
        val colorChoices = listOf(
            "Biru Kobalt (#0F5EC4)" to "#0F5EC4",
            "Hijau Hutan (#16A34A)" to "#16A34A",
            "Merah Survei (#EF4444)" to "#EF4444",
            "Jingga Kontur (#D97706)" to "#D97706",
            "Ungu Batas (#7C3AED)" to "#7C3AED"
        )
        AlertDialog.Builder(this)
            .setTitle("${feature.layerLabel} (${feature.geometryType})")
            .setMessage("Koordinat: ${String.format(Locale.US, "%.5f, %.5f", feature.latitude, feature.longitude)}\n\nTabel Atribut:\n$attrText")
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
                        mapStatusTextView?.text = "Atribut diperbarui: ${noteInput.text}"
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
        compassTextView?.text = "Kompas Live: ${degInt}° (${cardinalId(degInt)})"
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
            val label = if (epsg == null) "Di luar cakupan" else "Zona ${zone?.number}${if (lat >= 0) "N" else "S"}, EPSG:$epsg"
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

# Status Pengembangan D H Y Explorer — v0.4.0

**Pengembang:** `ngek@`

## Peningkatan & Perbaikan v0.4.0
1. **Gradle Wrapper 8.9 Lengkap & `.gitattributes`**: Berkas `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, `gradle/wrapper/gradle-wrapper.properties`, dan `.gitattributes` sudah disertakan lengkap agar eksekusi Gradle di Linux/macOS/Windows dan GitHub Actions bebas masalah line-ending.
2. **Build & Unduh APK di GitHub & Android Studio**: Workflow `.github/workflows/build-apk.yml` menjalankan unit test, membangun `DHY-Explorer-v0.4.0-debug.apk` dan `DHY-Explorer-v0.4.0-release-unsigned.apk`, mengunggah artefak `DHY-Explorer-v0.4.0-APK`, serta menerbitkan langsung ke **GitHub Releases** untuk unduhan 1-klik.
3. **Fitur Survei GNSS & Peta Lengkap**:
   - Web & Android: Koordinat WGS 84 (tampil/sembunyi), Grid UTM ON/OFF, Kompas real-time, GPS/GNSS + akurasi posisi, tambah/edit waypoint, rekam jalur perjalanan, hitung jarak survei, ekspor CSV/GeoJSON/GPX, serta permintaan dan penanganan penolakan izin lokasi runtime.
4. **Unit Test Lengkap**:
   - Web/TypeScript (`npm test`): Menguji Zona UTM Indonesia, geodesi/snap/seleksi spasial/validasi topologi, ekspor CSV/GeoJSON/GPX, metadata proyek, dan paritas templat Android+GitHub.
   - Android/JUnit (`IndonesiaUtmZonesTest`, `WaypointExporterTest`, `MapLibreConfigTest`, `ProjectDefinitionTest`): Disertakan lengkap pada `app/src/test/`.

## Status Pemeriksaan Build
- **Web TypeScript (`npm test`, `npm run lint`, `npm run build`)**: Terverifikasi lulus di lingkungan pengembangan.
- **Android APK (`./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease`)**: Dijalankan otomatis pada runner GitHub Actions (`.github/workflows/build-apk.yml`) dengan JDK 17 & Android SDK 35, atau langsung melalui Android Studio (**Build > Build APK(s)**) / `./gradlew` pada mesin lokal yang memiliki JDK 17 + Android SDK.

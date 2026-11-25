# D H Y Explorer — Proyek Android Studio & GitHub (v0.4.0)

**Pengembang:** `ngek@`

Panduan membuka di Android Studio, membangun APK, dan mengunduh APK langsung dari GitHub Releases atau GitHub Actions:

## 1. Membuka & Build APK di Android Studio
1. Ekstrak folder `android-studio-project` (atau clone repositori GitHub ini).
2. Buka **Android Studio** -> **Open** -> pilih folder `android-studio-project`.
3. Tunggu Gradle Sync selesai (Gradle Wrapper 8.9 lengkap dengan `gradlew`, `gradlew.bat`, dan `gradle-wrapper.jar` + JDK 17 + Compile SDK 35).
4. Untuk langsung memasang ke HP Android (via USB Debugging) tekan **Run 'app'**, atau pilih **Build -> Build Bundle(s) / APK(s) -> Build APK(s)** untuk menghasilkan berkas `app/build/outputs/apk/debug/app-debug.apk` yang siap disalin dan diinstal di perangkat Android.

## 2. Pengujian & Build APK Lokal via Gradle Wrapper
```bash
cd android-studio-project
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease
```
*(Di Windows gunakan `gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease`)*

## 3. Build & Unduh APK Otomatis di GitHub (Releases & Actions)
1. Push seluruh repositori termasuk `.gitattributes` dan `.github/workflows/build-apk.yml` ke branch `main` (atau jalankan manual dari tab **Actions -> Run workflow**).
2. Setelah workflow selesai, unduh APK melalui dua cara:
   - **GitHub Releases (1-Klik Unduh APK):** Buka menu **Releases** di sisi kanan repositori lalu unduh langsung `DHY-Explorer-v0.4.0-debug.apk` (siap pasang di Android).
   - **GitHub Actions Artifacts:** Buka tab **Actions** -> pilih run terbaru -> unduh artefak `DHY-Explorer-v0.4.0-APK`.

## Fitur v0.4.0 (oleh ngek@)
- Kompas orientasi real-time (Sensor Rotasi Android & kontrol manual + Reset Utara)
- Toggle **Grid UTM ON/OFF** (Zona 46–54 Indonesia & Garis Ekuator) dan toggle **Tampil/Sembunyi Koordinat WGS 84**
- Izin lokasi runtime & penanganan penolakan izin (`LocationManager` + Pengaturan Aplikasi)
- Posisi GNSS real-time, akurasi posisi (`±m`), zona UTM & EPSG, tambah/edit atribut waypoint, rekam jalur perjalanan, hitung jarak survei, serta ekspor CSV, GeoJSON, dan GPX
- Impor berkas GeoJSON lokal (`OpenDocument`) serta klik fitur poliline/poligon/titik untuk melihat atribut & ubah warna
- Kelengkapan penuh **Gradle Wrapper 8.9** (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`)

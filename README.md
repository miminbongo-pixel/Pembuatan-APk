# D H Y Explorer — Proyek Android Studio & GitHub (v0.4.0)

**Pengembang:** `ngek@`

Panduan membuka di Android Studio dan membuild APK melalui Gradle Wrapper 8.9 atau GitHub Actions:

## 1. Membuka di Android Studio
1. Ekstrak folder `android-studio-project` (atau clone repositori GitHub ini).
2. Buka **Android Studio** -> **Open** -> pilih folder `android-studio-project`.
3. Tunggu Gradle Sync selesai (Gradle Wrapper 8.9 lengkap dengan `gradlew`, `gradlew.bat`, dan `gradle-wrapper.jar` + JDK 17 + Compile SDK 35).
4. Jalankan ke emulator atau perangkat Android (**Run 'app'**).

## 2. Pengujian & Build APK Lokal via Gradle Wrapper
```bash
cd android-studio-project
./gradlew :app:testDebugUnitTest :app:assembleDebug
```
*(Di Windows gunakan `gradlew.bat :app:testDebugUnitTest :app:assembleDebug`)*

## 3. Build APK Otomatis di GitHub Actions
1. Push seluruh repositori termasuk `.github/workflows/build-apk.yml` ke branch `main`.
2. Buka tab **Actions** untuk mengunduh artefak `DHY-Explorer-0.4.0-debug-apk`.

## Fitur v0.4.0 (oleh ngek@)
- Kompas orientasi real-time (Sensor Rotasi Android & kontrol manual + Reset Utara)
- Toggle **Grid UTM ON/OFF** (Zona 46–54 Indonesia & Garis Ekuator)
- Klik fitur **poliline / poligon / titik** untuk melihat & mengedit tabel atribut serta mengubah warna layer
- Impor berkas GeoJSON lokal (`OpenDocument`) dan tombol pusatkan GNSS cepat (`LocationManager`)
- Kelengkapan penuh **Gradle Wrapper 8.9** (`gradlew`, `gradlew.bat`, `gradle-wrapper.jar`)

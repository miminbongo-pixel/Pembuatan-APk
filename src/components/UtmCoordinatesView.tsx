import React, { useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Compass, MapPin, Navigation } from 'lucide-react';
import {
  epsgFor,
  epsgForZone,
  formatUtmZoneLabel,
  INDONESIA_UTM_BENCHMARKS,
  INDONESIA_UTM_ZONES,
  latLonToUtm,
  utmToLatLon,
  zoneFor,
} from '../core/coordinates/indonesiaUtmZones';

interface UtmCoordinatesViewProps {
  onBack: () => void;
  onFocusMapAt: (lat: number, lon: number, zoom?: number) => void;
}

const ZONE_REGIONS: Record<number, string> = {
  46: 'Aceh Bagian Barat & Sabang',
  47: 'Sumatra Utara, Riau, Sumatra Barat, Jambi, Kepri',
  48: 'Sumatra Selatan, Lampung, Bangka, Jakarta, Jawa Barat, Kalbar',
  49: 'Jawa Tengah, Yogyakarta, Jawa Timur, Kalbar Timur, Kalteng',
  50: 'Bali, NTB, Kaltim, Kalsel, Sulawesi Selatan & Barat',
  51: 'NTT, Sulawesi Tengah, Sulawesi Utara, Gorontalo, Sulteng',
  52: 'Maluku Utara, Maluku Bagian Barat',
  53: 'Maluku Tenggara, Papua Barat, Papua Tengah',
  54: 'Papua Bagian Timur, Jayapura, Merauke',
};

export const UtmCoordinatesView: React.FC<UtmCoordinatesViewProps> = ({
  onBack,
  onFocusMapAt,
}) => {
  const [latInput, setLatInput] = useState('-5.10000');
  const [lonInput, setLonInput] = useState('119.00000');

  const parsedLat = Number.parseFloat(latInput);
  const parsedLon = Number.parseFloat(lonInput);

  const starterEpsg = epsgFor(parsedLat, parsedLon);
  const starterZone = zoneFor(parsedLon);
  const starterLabel = formatUtmZoneLabel(parsedLat, parsedLon);
  const utmResult = latLonToUtm(parsedLat, parsedLon);

  // Reverse UTM -> WGS 84 inputs
  const [eastingInput, setEastingInput] = useState('721728.00');
  const [northingInput, setNorthingInput] = useState('9435898.00');
  const [utmZoneInput, setUtmZoneInput] = useState(50);
  const [utmHemiInput, setUtmHemiInput] = useState<'N' | 'S'>('S');

  const parsedEasting = Number.parseFloat(eastingInput);
  const parsedNorthing = Number.parseFloat(northingInput);
  const reverseResult = utmToLatLon(
    parsedEasting,
    parsedNorthing,
    utmZoneInput,
    utmHemiInput === 'N'
  );

  const syncUtmFromLatLon = () => {
    if (!utmResult) return;
    setEastingInput(utmResult.easting.toFixed(2));
    setNorthingInput(utmResult.northing.toFixed(2));
    setUtmZoneInput(utmResult.zone);
    setUtmHemiInput(utmResult.hemisphere);
  };

  const syncLatLonFromUtm = () => {
    if (!reverseResult) return;
    setLatInput(reverseResult.latitude.toFixed(5));
    setLonInput(reverseResult.longitude.toFixed(5));
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F7FB]">
      <header className="h-14 bg-[#0F5EC4] text-white px-3 sm:px-5 flex items-center gap-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight">
          Sistem Koordinat & Zona UTM
        </h1>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Sistem Koordinat WGS 84 & Zona UTM Indonesia
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Pemilih zona UTM standar 46–54 (90°–144° BT), penentuan kode EPSG belahan utara/selatan,
            serta konversi geodetik bolak-balik WGS 84 ↔ Proyeksi Transverse Mercator.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
          Datum WGS 84 · Zona 46–54 · -80°LS s.d. 84°LU
        </div>
      </div>

      {/* Bidirectional Converter Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Forward: Lat/Lon -> UTM */}
        <section className="bg-white border border-slate-200 rounded-md p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                01. Geografis (WGS 84) ke Proyeksi UTM
              </h2>
              <button
                type="button"
                onClick={syncUtmFromLatLon}
                disabled={!utmResult}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1469BE] hover:text-[#0D3769] disabled:opacity-40"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Salin ke UTM</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Latitude (Desimal °)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Longitude (Desimal °)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={lonInput}
                  onChange={(e) => setLonInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Cakupan Starter Indonesia (46–54)</span>
                <span
                  className={`font-medium ${
                    starterEpsg ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {starterEpsg ? `${starterLabel} · EPSG:${starterEpsg}` : starterLabel}
                </span>
              </div>

              {utmResult ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <div className="text-[11px] text-slate-500">Easting (mT)</div>
                    <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {utmResult.easting.toFixed(2)} m
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Northing (mU)</div>
                    <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {utmResult.northing.toFixed(2)} m
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Meridian Tengah / k</div>
                    <div className="text-sm font-medium font-mono tabular-nums text-slate-800">
                      {utmResult.centralMeridian}° · {utmResult.scaleFactor.toFixed(5)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-600 pt-1">
                  Koordinat di luar rentang valid UTM (-80° s.d. 84° lintang, -180° s.d. 180° bujur).
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {starterZone
                ? `Batas bujur zona: ${starterZone.westLongitude}°–${starterZone.eastLongitude}° BT`
                : 'Batas starter Indonesia: 90°–144° BT'}
            </span>
            <button
              type="button"
              disabled={!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)}
              onClick={() => onFocusMapAt(parsedLat, parsedLon, 13)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0D3769] text-white hover:bg-[#1469BE] disabled:opacity-40 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Lihat di Peta</span>
            </button>
          </div>
        </section>

        {/* Inverse: UTM -> Lat/Lon */}
        <section className="bg-white border border-slate-200 rounded-md p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">
                02. Proyeksi UTM ke Geografis (WGS 84)
              </h2>
              <button
                type="button"
                onClick={syncLatLonFromUtm}
                disabled={!reverseResult}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1469BE] hover:text-[#0D3769] disabled:opacity-40"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Salin ke Lat/Lon</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Zona UTM</label>
                <select
                  value={utmZoneInput}
                  onChange={(e) => setUtmZoneInput(Number(e.target.value))}
                  className="w-full px-2.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                >
                  {INDONESIA_UTM_ZONES.map((z) => (
                    <option key={z.number} value={z.number}>
                      Zona {z.number}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Belahan</label>
                <select
                  value={utmHemiInput}
                  onChange={(e) => setUtmHemiInput(e.target.value as 'N' | 'S')}
                  className="w-full px-2.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                >
                  <option value="S">Selatan (S)</option>
                  <option value="N">Utara (N)</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Easting (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={eastingInput}
                  onChange={(e) => setEastingInput(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Northing (m)</label>
                <input
                  type="number"
                  step="0.01"
                  value={northingInput}
                  onChange={(e) => setNorthingInput(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Kode EPSG Target</span>
                <span className="font-mono font-medium text-[#0D3769]">
                  EPSG:{epsgForZone(utmZoneInput, utmHemiInput === 'N')}
                </span>
              </div>

              {reverseResult ? (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="text-[11px] text-slate-500">Hasil Latitude</div>
                    <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {reverseResult.latitude.toFixed(6)}°
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Hasil Longitude</div>
                    <div className="text-sm font-semibold font-mono tabular-nums text-slate-900">
                      {reverseResult.longitude.toFixed(6)}°
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-rose-600 pt-1">
                  Masukkan angka Easting, Northing, dan zona UTM yang valid.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              False Easting 500.000 m · False Northing {utmHemiInput === 'S' ? '10.000.000 m' : '0 m'}
            </span>
            <button
              type="button"
              disabled={!reverseResult}
              onClick={() =>
                reverseResult && onFocusMapAt(reverseResult.latitude, reverseResult.longitude, 13)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0D3769] text-white hover:bg-[#1469BE] disabled:opacity-40 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Pusatkan Peta</span>
            </button>
          </div>
        </section>
      </div>

      {/* Reference Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Zone 46-54 Matrix */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Matriks Zona UTM Indonesia (46–54)
            </h2>
            <span className="text-xs text-slate-500">9 Zona Standar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Zona</th>
                  <th className="py-2.5 px-3">Rentang Bujur</th>
                  <th className="py-2.5 px-3">CM</th>
                  <th className="py-2.5 px-3">EPSG Utara</th>
                  <th className="py-2.5 px-3">EPSG Selatan</th>
                  <th className="py-2.5 px-4">Cakupan Wilayah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {INDONESIA_UTM_ZONES.map((zone) => {
                  const isActive = starterZone?.number === zone.number;
                  return (
                    <tr
                      key={zone.number}
                      className={isActive ? 'bg-[#EFF5FC]' : 'hover:bg-slate-50'}
                    >
                      <td className="py-2.5 px-4 font-mono font-semibold text-[#0D3769]">
                        {zone.number}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {zone.westLongitude}°–{zone.eastLongitude}° BT
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                        {zone.centralMeridian}°
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800">
                        {32600 + zone.number}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-800">
                        {32700 + zone.number}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{ZONE_REGIONS[zone.number]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Benchmark Cities */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-md overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Titik Uji Standar Indonesia
              </h2>
              <span className="text-xs text-slate-500">Klik untuk uji</span>
            </div>
            <div className="divide-y divide-slate-100">
              {INDONESIA_UTM_BENCHMARKS.map((bm) => {
                const epsg = epsgFor(bm.latitude, bm.longitude);
                const label = formatUtmZoneLabel(bm.latitude, bm.longitude);
                return (
                  <div
                    key={bm.name}
                    className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">{bm.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {bm.region} · EPSG:{epsg}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        {bm.latitude.toFixed(2)}°, {bm.longitude.toFixed(2)}°
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLatInput(bm.latitude.toFixed(5));
                          setLonInput(bm.longitude.toFixed(5));
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-[#0D3769] bg-[#EFF5FC] rounded hover:bg-[#DCE8F5]"
                        title={`Uji koordinat ${bm.name} (${label})`}
                      >
                        Uji
                      </button>
                      <button
                        type="button"
                        onClick={() => onFocusMapAt(bm.latitude, bm.longitude, 12)}
                        className="p-1 text-slate-500 hover:text-[#0D3769]"
                        title={`Pusatkan peta ke ${bm.name}`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
            CRS asli dari setiap data impor tetap dipertahankan. Data SRGI 2013, TM-3° BPN, data
            lintas zona, dan transformasi datum/epoch memerlukan definisi proyeksi sumber yang
            sesuai sebelum analisis gabungan.
          </div>
        </section>
      </div>
    </div>
    </div>
  );
};

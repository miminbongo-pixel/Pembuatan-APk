import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CircleDot,
  Compass,
  Download,
  Edit3,
  LocateFixed,
  MapPin,
  Plus,
  Radio,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { epsgFor, formatUtmZoneLabel, latLonToUtm } from '../core/coordinates/indonesiaUtmZones';
import {
  compassDirectionId,
  formatDistance,
  haversineDistanceMeters,
  initialBearingDegrees,
  LngLatTuple,
  polylineDistanceMeters,
} from '../core/spatial/geodesy';
import {
  SurveyWaypoint,
  waypointsToCsv,
  waypointsToGeoJson,
  waypointsToGpx,
} from '../core/vector/waypointExporter';

interface SurveyGpsViewProps {
  onBack: () => void;
  waypoints: SurveyWaypoint[];
  onAddWaypoint: (wp: Omit<SurveyWaypoint, 'id' | 'recordedAt'>) => void;
  onUpdateWaypoint: (
    id: string,
    updates: Partial<Omit<SurveyWaypoint, 'id' | 'recordedAt'>>
  ) => void;
  onDeleteWaypoint: (id: string) => void;
  onFocusMapAt: (lat: number, lon: number, zoom?: number) => void;
  onCreateBufferAt: (lon: number, lat: number, radiusMeters: number, label: string) => void;
  gpsPosition: {
    lat: number;
    lon: number;
    accuracy: number | null;
    altitude: number | null;
    timestamp: string;
  } | null;
  gpsPermissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
  gpsError: string | null;
  isLocatingGps: boolean;
  isTrackingGps: boolean;
  trackPoints: LngLatTuple[];
  onRequestGpsFix: () => void;
  onToggleTracking: () => void;
  onSaveTrackToLayer: () => void;
  onClearTrack: () => void;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const SurveyGpsView: React.FC<SurveyGpsViewProps> = ({
  onBack,
  waypoints,
  onAddWaypoint,
  onUpdateWaypoint,
  onDeleteWaypoint,
  onFocusMapAt,
  onCreateBufferAt,
  gpsPosition,
  gpsPermissionState,
  gpsError,
  isLocatingGps,
  isTrackingGps,
  trackPoints,
  onRequestGpsFix,
  onToggleTracking,
  onSaveTrackToLayer,
  onClearTrack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Semua');

  const [newLabel, setNewLabel] = useState('');
  const [newLat, setNewLat] = useState('-5.100000');
  const [newLon, setNewLon] = useState('119.000000');
  const [newElev, setNewElev] = useState('');
  const [newCategory, setNewCategory] = useState('Titik Kontrol');
  const [newNote, setNewNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingWpId, setEditingWpId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategory, setEditCategory] = useState('Survei');
  const [editLat, setEditLat] = useState('');
  const [editLon, setEditLon] = useState('');
  const [editElev, setEditElev] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [calcFromId, setCalcFromId] = useState<string>(() =>
    waypoints[0]?.id ?? '__gps__'
  );
  const [calcToId, setCalcToId] = useState<string>(() =>
    waypoints[1]?.id ?? waypoints[0]?.id ?? ''
  );
  const [includeTrackInExport, setIncludeTrackInExport] = useState(true);

  const categories = ['Semua', 'Titik Kontrol', 'Batas Lahan', 'Infrastruktur', 'Survei'];

  const filteredWaypoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return waypoints.filter((wp) => {
      const catMatch = categoryFilter === 'Semua' || (wp.category ?? 'Survei') === categoryFilter;
      const textMatch =
        !q ||
        wp.label.toLowerCase().includes(q) ||
        wp.id.toLowerCase().includes(q) ||
        (wp.note ?? '').toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [waypoints, searchQuery, categoryFilter]);

  const trackDistanceM = useMemo(() => polylineDistanceMeters(trackPoints), [trackPoints]);

  const sequentialWaypointsDistanceM = useMemo(() => {
    if (waypoints.length < 2) return 0;
    const coords: LngLatTuple[] = waypoints.map((wp) => [wp.longitude, wp.latitude]);
    return polylineDistanceMeters(coords);
  }, [waypoints]);

  const surveyCalcResult = useMemo(() => {
    const resolvePoint = (
      id: string
    ): { label: string; lat: number; lon: number; elev: number | null } | null => {
      if (id === '__gps__') {
        if (!gpsPosition) return null;
        return {
          label: 'Posisi GPS Saat Ini',
          lat: gpsPosition.lat,
          lon: gpsPosition.lon,
          elev: gpsPosition.altitude,
        };
      }
      const wp = waypoints.find((w) => w.id === id);
      if (!wp) return null;
      return {
        label: wp.label,
        lat: wp.latitude,
        lon: wp.longitude,
        elev: wp.elevationM ?? null,
      };
    };

    const p1 = resolvePoint(calcFromId);
    const p2 = resolvePoint(calcToId);
    if (!p1 || !p2) return null;
    const distM = haversineDistanceMeters([p1.lon, p1.lat], [p2.lon, p2.lat]);
    const bearing = initialBearingDegrees([p1.lon, p1.lat], [p2.lon, p2.lat]);
    const deltaElev =
      p1.elev != null && p2.elev != null ? p2.elev - p1.elev : null;
    return { p1, p2, distM, bearing, deltaElev };
  }, [calcFromId, calcToId, gpsPosition, waypoints]);

  const handleCaptureCurrentGpsAsWaypoint = () => {
    if (!gpsPosition) return;
    const nextNum = waypoints.length + 1;
    onAddWaypoint({
      label: newLabel.trim() || `GPS-${String(nextNum).padStart(2, '0')}`,
      latitude: gpsPosition.lat,
      longitude: gpsPosition.lon,
      elevationM: gpsPosition.altitude,
      accuracyM: gpsPosition.accuracy,
      category: newCategory,
      note: newNote.trim() || 'Tangkapan GNSS perangkat',
    });
    setNewLabel('');
    setNewNote('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const lat = Number.parseFloat(newLat);
    const lon = Number.parseFloat(newLon);
    if (!newLabel.trim()) {
      setFormError('Nama titik survei wajib diisi.');
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setFormError('Koordinat lintang/bujur tidak valid.');
      return;
    }
    const elev = newElev.trim() ? Number.parseFloat(newElev) : null;
    onAddWaypoint({
      label: newLabel.trim(),
      latitude: lat,
      longitude: lon,
      elevationM: Number.isFinite(elev) ? elev : null,
      accuracyM: null,
      category: newCategory,
      note: newNote.trim(),
    });
    setNewLabel('');
    setNewNote('');
  };

  const startEditWaypoint = (wp: SurveyWaypoint) => {
    setEditingWpId(wp.id);
    setEditLabel(wp.label);
    setEditCategory(wp.category ?? 'Survei');
    setEditLat(wp.latitude.toFixed(6));
    setEditLon(wp.longitude.toFixed(6));
    setEditElev(wp.elevationM != null ? String(wp.elevationM) : '');
    setEditNote(wp.note ?? '');
    setEditError(null);
  };

  const handleSaveEditedWaypoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWpId) return;
    const lat = Number.parseFloat(editLat);
    const lon = Number.parseFloat(editLon);
    if (!editLabel.trim()) {
      setEditError('Label waypoint tidak boleh kosong.');
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setEditError('Koordinat latitude/longitude tidak valid.');
      return;
    }
    const elev = editElev.trim() ? Number.parseFloat(editElev) : null;
    onUpdateWaypoint(editingWpId, {
      label: editLabel.trim(),
      category: editCategory,
      latitude: lat,
      longitude: lon,
      elevationM: Number.isFinite(elev) ? elev : null,
      note: editNote.trim(),
    });
    setEditingWpId(null);
    setEditError(null);
  };

  const gpsUtm = gpsPosition ? latLonToUtm(gpsPosition.lat, gpsPosition.lon) : null;
  const exportTracks = includeTrackInExport ? trackPoints : [];
  const canExportSurvey = waypoints.length > 0 || trackPoints.length >= 2;

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
        <h1 className="text-base sm:text-lg font-bold tracking-tight">GPS & Survei GNSS</h1>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">GPS & Survei Lapangan</h1>
            <p className="text-sm text-slate-600 mt-1">
              Posisi GNSS, akurasi horizontal, zona UTM & EPSG, perekaman jalur perjalanan,
              kalkulasi jarak survei, edit atribut waypoint, serta ekspor CSV, GeoJSON, dan GPX.
            </p>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            {trackPoints.length >= 2 && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTrackInExport}
                  onChange={(e) => setIncludeTrackInExport(e.target.checked)}
                  className="rounded border-slate-300 accent-[#0F5EC4]"
                />
                <span>Sertakan jalur perjalanan ({trackPoints.length} titik · {formatDistance(trackDistanceM)})</span>
              </label>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canExportSurvey}
                onClick={() =>
                  downloadTextFile(
                    'dhy_explorer_survei.csv',
                    waypointsToCsv(waypoints, exportTracks),
                    'text/csv'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV</span>
              </button>
              <button
                type="button"
                disabled={!canExportSurvey}
                onClick={() =>
                  downloadTextFile(
                    'dhy_explorer_survei.geojson',
                    JSON.stringify(waypointsToGeoJson(waypoints, exportTracks), null, 2),
                    'application/geo+json'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh GeoJSON</span>
              </button>
              <button
                type="button"
                disabled={!canExportSurvey}
                onClick={() =>
                  downloadTextFile(
                    'dhy_explorer_survei.gpx',
                    waypointsToGpx(waypoints, 'D H Y Explorer Survey', exportTracks),
                    'application/gpx+xml'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0D3769] text-white rounded-md hover:bg-[#1469BE] disabled:opacity-40 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh GPX</span>
              </button>
            </div>
          </div>
        </div>

        {/* Runtime Location Permission Status & Denial Recovery Banner */}
        <section
          className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            gpsPermissionState === 'denied' || gpsPermissionState === 'unsupported'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : gpsPermissionState === 'granted'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs">
            {gpsPermissionState === 'denied' || gpsPermissionState === 'unsupported' ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  gpsPermissionState === 'granted' ? 'text-emerald-600' : 'text-[#0F5EC4]'
                }`}
              />
            )}
            <div>
              <div className="font-semibold">
                Status Izin Lokasi:{' '}
                {gpsPermissionState === 'granted'
                  ? 'Diizinkan (GPS Siap)'
                  : gpsPermissionState === 'denied'
                    ? 'Ditolak oleh Pengguna'
                    : gpsPermissionState === 'unsupported'
                      ? 'Perangkat Tidak Mendukung Geolocation'
                      : 'Belum Diminta (Menunggu Izin)'}
              </div>
              <p className="text-[11px] opacity-85 mt-0.5">
                {gpsPermissionState === 'denied'
                  ? 'Akses lokasi ditolak. Buka pengaturan situs di browser (ikon gembok di bilah alamat) dan ubah Lokasi menjadi "Izinkan", lalu tekan tombol Minta Izin Lagi. Fitur waypoint manual tetap dapat digunakan.'
                  : gpsPermissionState === 'unsupported'
                    ? 'Browser ini tidak menyediakan sensor lokasi. Anda tetap bisa mencatat waypoint manual, menghitung jarak survei, dan mengekspor berkas.'
                    : gpsPermissionState === 'granted'
                      ? 'Akses GNSS aktif untuk membaca koordinat, akurasi horizontal, zona UTM, dan merekam jalur perjalanan.'
                      : 'Aplikasi akan meminta izin lokasi perangkat saat Anda menekan "Baca Posisi GNSS" atau "Mulai Rekam Track".'}
              </p>
            </div>
          </div>
          {gpsPermissionState !== 'unsupported' && (
            <button
              type="button"
              onClick={onRequestGpsFix}
              disabled={isLocatingGps}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                gpsPermissionState === 'denied'
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-[#0F5EC4] text-white hover:bg-[#0D4EA3]'
              } disabled:opacity-50`}
            >
              {gpsPermissionState === 'denied'
                ? 'Minta Izin Lagi'
                : isLocatingGps
                  ? 'Meminta Izin...'
                  : 'Minta / Segarkan GPS'}
            </button>
          )}
        </section>

        {/* Top Grid: Live GNSS Receiver + Manual Waypoint Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* GNSS Panel */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Penerima GNSS Perangkat</h2>
                <span
                  className={`text-xs font-medium ${
                    gpsPosition
                      ? 'text-emerald-700'
                      : gpsError
                        ? 'text-rose-600'
                        : 'text-slate-500'
                  }`}
                >
                  {gpsPosition ? '● Fix Aktif' : gpsError ? '✖ Tidak Tersedia' : 'Menunggu Pembacaan'}
                </span>
              </div>

              {gpsPosition ? (
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] text-slate-500">Latitude</div>
                      <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                        {gpsPosition.lat.toFixed(6)}°
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Longitude</div>
                      <div className="text-base font-semibold font-mono tabular-nums text-slate-900">
                        {gpsPosition.lon.toFixed(6)}°
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500">Akurasi</div>
                      <div className="font-mono tabular-nums font-medium text-slate-800">
                        {gpsPosition.accuracy != null ? `±${gpsPosition.accuracy.toFixed(1)} m` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Elevasi</div>
                      <div className="font-mono tabular-nums font-medium text-slate-800">
                        {gpsPosition.altitude != null ? `${gpsPosition.altitude.toFixed(1)} m` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Zona UTM & EPSG</div>
                      <div className="font-mono tabular-nums font-medium text-[#0D3769]">
                        {gpsUtm ? `${gpsUtm.zone}${gpsUtm.hemisphere} · ${gpsUtm.epsg}` : '—'}
                      </div>
                    </div>
                  </div>
                  {gpsUtm && (
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 pt-1 border-t border-slate-100 flex justify-between">
                      <span>{gpsUtm.easting.toFixed(1)} mT · {gpsUtm.northing.toFixed(1)} mU</span>
                      <span>{new Date(gpsPosition.timestamp).toLocaleTimeString('id-ID')}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-5 text-xs text-slate-600 leading-relaxed">
                  {gpsError ? (
                    <p className="text-rose-700">{gpsError}</p>
                  ) : (
                    <p>
                      Klik tombol di bawah untuk meminta izin lokasi dan membaca koordinat GNSS,
                      akurasi posisi horizontal, serta zona UTM & kode EPSG secara langsung.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onRequestGpsFix}
                  disabled={isLocatingGps}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-[#1469BE] text-white hover:bg-[#0D3769] disabled:opacity-50 whitespace-nowrap"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>{isLocatingGps ? 'Membaca GNSS...' : 'Baca Posisi GNSS'}</span>
                </button>

                {gpsPosition && (
                  <button
                    type="button"
                    onClick={handleCaptureCurrentGpsAsWaypoint}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md bg-emerald-700 text-white hover:bg-emerald-800 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Simpan Titik</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={onToggleTracking}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
                    isTrackingGps
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {isTrackingGps ? <Square className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5" />}
                  <span>
                    {isTrackingGps
                      ? `Hentikan Track (${trackPoints.length} titik)`
                      : 'Mulai Rekam Jalur'}
                  </span>
                </button>

                {trackPoints.length >= 2 && (
                  <>
                    <button
                      type="button"
                      onClick={onSaveTrackToLayer}
                      className="px-3 py-2 text-xs font-medium bg-[#0D3769] text-white rounded-md hover:bg-[#1469BE] whitespace-nowrap"
                    >
                      Simpan Layer
                    </button>
                    <button
                      type="button"
                      onClick={onClearTrack}
                      className="px-2.5 py-2 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100"
                      title="Bersihkan jalur sementara"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              {trackPoints.length > 0 && (
                <div className="text-[11px] font-mono tabular-nums text-[#7C3AED] flex items-center justify-between pt-1">
                  <span>Jalur terekam: {trackPoints.length} titik</span>
                  <span className="font-semibold">Jarak: {formatDistance(trackDistanceM)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Manual Waypoint Entry */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Catat Titik Survei (Waypoint) Manual
            </h2>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Label Titik Survei
                  </label>
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Contoh: BM-01 Dermaga Makassar"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Kategori</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                  >
                    <option value="Titik Kontrol">Titik Kontrol</option>
                    <option value="Batas Lahan">Batas Lahan</option>
                    <option value="Infrastruktur">Infrastruktur</option>
                    <option value="Survei">Survei</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={newLon}
                    onChange={(e) => setNewLon(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Elevasi (m, opsional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newElev}
                    onChange={(e) => setNewElev(e.target.value)}
                    placeholder="12.5"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Catatan Lapangan
                  </label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Deskripsi kondisi patok, tutupan lahan, atau objek"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md bg-[#0D3769] text-white hover:bg-[#1469BE] transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Titik</span>
                </button>
              </div>
              {formError && <p className="text-xs text-rose-600">{formError}</p>}
            </form>
          </section>
        </div>

        {/* Survey Distance Calculator & Summary */}
        <section className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-[#0F5EC4]" />
              <h2 className="text-sm font-semibold text-slate-900">
                Kalkulator & Ringkasan Jarak Survei
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Perhitungan geodetik WGS84 (Haversine)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <div className="text-[11px] text-slate-500">Jarak Jalur Perjalanan Terekam</div>
              <div className="text-base font-bold font-mono tabular-nums text-[#7C3AED] mt-0.5">
                {trackPoints.length >= 2 ? formatDistance(trackDistanceM) : '0.0 m'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {trackPoints.length} titik track GNSS
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <div className="text-[11px] text-slate-500">Total Rute Antar Waypoint Berurutan</div>
              <div className="text-base font-bold font-mono tabular-nums text-[#0F5EC4] mt-0.5">
                {formatDistance(sequentialWaypointsDistanceM)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Melalui {waypoints.length} waypoint
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
              <div className="text-[11px] text-slate-500">Jarak Titik Terpilih</div>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                {surveyCalcResult ? formatDistance(surveyCalcResult.distM) : '—'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <Compass className="w-3 h-3" />
                <span>
                  {surveyCalcResult
                    ? `Azimuth ${surveyCalcResult.bearing.toFixed(1)}° (${compassDirectionId(surveyCalcResult.bearing)})`
                    : 'Pilih dua titik di bawah'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titik Asal</label>
              <select
                value={calcFromId}
                onChange={(e) => setCalcFromId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0F5EC4]"
              >
                <option value="__gps__">
                  Posisi GPS Saat Ini {gpsPosition ? '(Aktif)' : '(Belum tersedia)'}
                </option>
                {waypoints.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titik Tujuan</label>
              <select
                value={calcToId}
                onChange={(e) => setCalcToId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#0F5EC4]"
              >
                {waypoints.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-[#EFF5FC] border border-blue-200 rounded-md px-3 py-2 flex flex-col justify-center text-xs">
              {surveyCalcResult ? (
                <>
                  <div className="font-mono tabular-nums font-bold text-[#0F5EC4]">
                    {surveyCalcResult.distM.toFixed(1)} m ({(surveyCalcResult.distM / 1000).toFixed(4)} km)
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Beda Elevasi:{' '}
                    {surveyCalcResult.deltaElev != null
                      ? `${surveyCalcResult.deltaElev >= 0 ? '+' : ''}${surveyCalcResult.deltaElev.toFixed(1)} m`
                      : '—'}
                  </div>
                </>
              ) : (
                <span className="text-slate-600">
                  Pilih titik GPS atau dua waypoint untuk menghitung jarak survei.
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Inline Edit Waypoint Panel */}
        {editingWpId && (
          <section className="bg-amber-50 border border-amber-300 rounded-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-amber-950">
                Edit Atribut Waypoint ({editingWpId})
              </h2>
              <button
                type="button"
                onClick={() => setEditingWpId(null)}
                className="p-1 text-amber-800 hover:bg-amber-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditedWaypoint} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-amber-900 mb-1">Label</label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-md focus:outline-none focus:border-[#0F5EC4]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">Kategori</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-md"
                  >
                    <option value="Titik Kontrol">Titik Kontrol</option>
                    <option value="Batas Lahan">Batas Lahan</option>
                    <option value="Infrastruktur">Infrastruktur</option>
                    <option value="Survei">Survei</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">Elevasi (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editElev}
                    onChange={(e) => setEditElev(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-amber-200 rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editLat}
                    onChange={(e) => setEditLat(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-amber-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editLon}
                    onChange={(e) => setEditLon(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-amber-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">Catatan</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-amber-200 rounded-md"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold bg-[#0F5EC4] text-white rounded-md hover:bg-[#0D4EA3]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingWpId(null)}
                    className="px-3 py-2 text-xs font-medium bg-white border border-amber-200 text-amber-900 rounded-md hover:bg-amber-100"
                  >
                    Batal
                  </button>
                </div>
              </div>
              {editError && <p className="text-xs text-rose-700">{editError}</p>}
            </form>
          </section>
        )}

        {/* Waypoint Table */}
        <section className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Daftar Titik Survei</h2>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {filteredWaypoints.length} dari {waypoints.length} titik
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                      categoryFilter === cat
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari label atau catatan..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
                />
              </div>
            </div>
          </div>

          {filteredWaypoints.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-800">Belum ada titik survei yang cocok</p>
              <p className="text-xs text-slate-500 mt-1">
                Tambahkan titik secara manual, tangkap dari GNSS perangkat, atau gunakan alat Tambah
                Titik pada Peta Utama.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">ID / Label</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-right">Latitude</th>
                    <th className="py-2.5 px-3 text-right">Longitude</th>
                    <th className="py-2.5 px-3">Zona UTM & EPSG</th>
                    <th className="py-2.5 px-3 text-right">Elevasi / Akurasi</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredWaypoints.map((wp) => {
                    const epsg = epsgFor(wp.latitude, wp.longitude);
                    const zoneLabel = formatUtmZoneLabel(wp.latitude, wp.longitude);
                    const isEditing = editingWpId === wp.id;
                    return (
                      <tr key={wp.id} className={isEditing ? 'bg-amber-50/70' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{wp.label}</div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[240px]">
                            {wp.id}
                            {wp.note ? ` · ${wp.note}` : ''}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                          {wp.category ?? 'Survei'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                          {wp.latitude.toFixed(6)}°
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                          {wp.longitude.toFixed(6)}°
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-[#0D3769] whitespace-nowrap">
                          {zoneLabel}
                          {epsg ? ` · EPSG:${epsg}` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {wp.elevationM != null ? `${wp.elevationM.toFixed(1)} m` : '—'}
                          {wp.accuracyM != null ? ` / ±${wp.accuracyM.toFixed(1)} m` : ''}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditWaypoint(wp)}
                              className="p-1.5 text-amber-700 hover:bg-amber-100 rounded"
                              title="Edit atribut waypoint"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onFocusMapAt(wp.latitude, wp.longitude, 15)}
                              className="p-1.5 text-slate-600 hover:text-[#0D3769] hover:bg-slate-100 rounded"
                              title="Lihat di peta"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onCreateBufferAt(wp.longitude, wp.latitude, 500, wp.label)
                              }
                              className="p-1.5 text-slate-600 hover:text-[#1469BE] hover:bg-slate-100 rounded"
                              title="Buat buffer 500 m"
                            >
                              <CircleDot className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteWaypoint(wp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Hapus titik"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import type { FeatureCollection } from 'geojson';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Compass,
  FileText,
  Filter,
  Layers,
  Mountain,
  PenTool,
  Ruler,
  ShieldCheck,
  SquareDashed,
  Wrench,
  X,
} from 'lucide-react';
import { GeoLayer, MapToolMode } from '../core/project/projectDefinition';
import {
  computeElevationSlopeProfile,
  formatArea,
  formatDistance,
  LngLatTuple,
  polygonAreaSquareMeters,
  polylineDistanceMeters,
  repairFeatureCollectionGeometries,
  selectFeaturesInsideMask,
  validateFeatureCollectionGeometries,
} from '../core/spatial/geodesy';
import { SurveyWaypoint } from '../core/vector/waypointExporter';

interface AnalysisToolsViewProps {
  onBack: () => void;
  onStartMapTool: (mode: MapToolMode) => void;
  onOpenUtm: () => void;
  onOpenSurvey: () => void;
  onOpenLayout: () => void;
  waypoints: SurveyWaypoint[];
  layers: GeoLayer[];
  onCreateBufferAt: (lon: number, lat: number, radiusMeters: number, label: string) => void;
  onAddSpatialSelectionLayer: (
    name: string,
    data: FeatureCollection,
    color?: string
  ) => void;
  onRepairLayerGeometry: (layerId: string, repairedData: FeatureCollection) => void;
}

export const AnalysisToolsView: React.FC<AnalysisToolsViewProps> = ({
  onBack,
  onStartMapTool,
  onOpenUtm,
  onOpenSurvey,
  onOpenLayout,
  waypoints,
  layers,
  onCreateBufferAt,
  onAddSpatialSelectionLayer,
  onRepairLayerGeometry,
}) => {
  const [activePanel, setActivePanel] = useState<
    'none' | 'buffer' | 'overlay' | 'select' | 'validate' | 'slope'
  >('none');
  const [selectedWpId, setSelectedWpId] = useState<string>(waypoints[0]?.id ?? '');
  const [customLat, setCustomLat] = useState('-5.1478');
  const [customLon, setCustomLon] = useState('119.4321');
  const [bufferRadiusM, setBufferRadiusM] = useState(500);

  const polygonMaskLayers = layers.filter((l) =>
    l.data.features.some(
      (f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    )
  );

  const [sourceLayerId, setSourceLayerId] = useState<string>(layers[0]?.id ?? '');
  const [maskLayerId, setMaskLayerId] = useState<string>(polygonMaskLayers[0]?.id ?? '');

  // Compute real overlay & spatial summary across visible layers
  const visibleLayers = layers.filter((l) => l.visible);
  let totalPoints = waypoints.length;
  let totalLines = 0;
  let totalPolygons = 0;
  let totalLengthM = 0;
  let totalAreaSqM = 0;

  visibleLayers.forEach((layer) => {
    layer.data.features.forEach((f) => {
      if (!f.geometry) return;
      if (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint') {
        totalPoints++;
      } else if (f.geometry.type === 'LineString') {
        totalLines++;
        totalLengthM += polylineDistanceMeters(f.geometry.coordinates as LngLatTuple[]);
      } else if (f.geometry.type === 'Polygon') {
        totalPolygons++;
        const ring = f.geometry.coordinates[0] as LngLatTuple[];
        if (ring) totalAreaSqM += polygonAreaSquareMeters(ring);
      }
    });
  });

  const handleRunBuffer = (e: React.FormEvent) => {
    e.preventDefault();
    const wp = waypoints.find((w) => w.id === selectedWpId);
    if (wp) {
      onCreateBufferAt(wp.longitude, wp.latitude, bufferRadiusM, wp.label);
      return;
    }
    const lat = Number.parseFloat(customLat);
    const lon = Number.parseFloat(customLon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      onCreateBufferAt(lon, lat, bufferRadiusM, 'Titik Koordinat');
    }
  };

  const resolvedSourceLayer = layers.find((l) => l.id === sourceLayerId) ?? layers[0] ?? null;
  const resolvedMaskLayer =
    polygonMaskLayers.find((l) => l.id === maskLayerId) ?? polygonMaskLayers[0] ?? null;

  const selectionPreview =
    resolvedSourceLayer && resolvedMaskLayer
      ? selectFeaturesInsideMask(resolvedSourceLayer.data, resolvedMaskLayer.data)
      : null;

  const layerValidationResults = layers.map((l) => ({
    layer: l,
    issues: validateFeatureCollectionGeometries(l.data),
  }));

  const totalGeometryIssues = layerValidationResults.reduce(
    (sum, item) => sum + item.issues.length,
    0
  );

  const elevationProfile = computeElevationSlopeProfile(waypoints);
  const minElev =
    elevationProfile.length > 0
      ? Math.min(...elevationProfile.map((p) => p.elevationM))
      : 0;
  const maxElev =
    elevationProfile.length > 0
      ? Math.max(...elevationProfile.map((p) => p.elevationM))
      : 10;
  const maxCumDist =
    elevationProfile.length > 0
      ? Math.max(1, elevationProfile[elevationProfile.length - 1].cumulativeDistanceM)
      : 1;

  const toolCards = [
    {
      id: 'distance',
      title: 'Pengukuran Jarak',
      subtitle: 'Jarak geodetik & snap',
      onClick: () => onStartMapTool('measure-distance'),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center">
          <Ruler className="w-7 h-7 text-[#0F5EC4] -rotate-45" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'area',
      title: 'Pengukuran Luas',
      subtitle: 'Luas ha & digitasi area',
      onClick: () => onStartMapTool('measure-area'),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center">
          <SquareDashed className="w-7 h-7 text-[#0F5EC4]" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'buffer',
      title: 'Buffer',
      subtitle: 'Zona penyangga geodetik',
      onClick: () => setActivePanel((p) => (p === 'buffer' ? 'none' : 'buffer')),
      icon: (
        <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center">
          <CircleDot className="w-7 h-7 text-[#0F5EC4]" strokeWidth={2.2} />
        </div>
      ),
    },
    {
      id: 'select',
      title: 'Seleksi Spasial',
      subtitle: 'Filter dalam poligon',
      onClick: () => setActivePanel((p) => (p === 'select' ? 'none' : 'select')),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Filter className="w-7 h-7 text-[#1469BE]" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'slope',
      title: 'Profil Kelerengan',
      subtitle: 'Elevasi & lereng % / °',
      onClick: () => setActivePanel((p) => (p === 'slope' ? 'none' : 'slope')),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center">
          <Mountain className="w-7 h-7 text-teal-600" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'validate',
      title: 'Validasi Geometri',
      subtitle:
        totalGeometryIssues === 0
          ? 'Semua layer valid'
          : `${totalGeometryIssues} isu terdeteksi`,
      onClick: () => setActivePanel((p) => (p === 'validate' ? 'none' : 'validate')),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-emerald-600" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'overlay',
      title: 'Statistik Overlay',
      subtitle: 'Ringkasan layer aktif',
      onClick: () => setActivePanel((p) => (p === 'overlay' ? 'none' : 'overlay')),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Layers className="w-7 h-7 text-[#0F5EC4]" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'utm',
      title: 'Zona UTM',
      subtitle: 'Konversi WGS 84 ↔ UTM',
      onClick: onOpenUtm,
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Compass className="w-7 h-7 text-[#0F5EC4]" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'digitize-line',
      title: 'Digitasi Garis',
      subtitle: 'Gambar poliline & snap',
      onClick: () => onStartMapTool('digitize-line'),
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
          <PenTool className="w-7 h-7 text-amber-600" strokeWidth={2} />
        </div>
      ),
    },
    {
      id: 'export-pdf',
      title: 'Ekspor PDF',
      subtitle: 'Layout peta cetak A4',
      onClick: onOpenLayout,
      icon: (
        <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
          <FileText className="w-7 h-7 text-rose-600" strokeWidth={2} />
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F7FB] flex flex-col">
      <header className="h-14 bg-[#0F5EC4] text-white px-3 sm:px-5 flex items-center justify-between gap-3 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">
            Alat Analisis & Geoprosesing
          </h1>
        </div>
        <button
          type="button"
          onClick={onOpenSurvey}
          className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-xl transition-colors whitespace-nowrap"
        >
          Buka GPS/GNSS
        </button>
      </header>

      <div className="max-w-5xl w-full mx-auto px-4 py-5 flex-1 flex flex-col justify-between gap-5">
        <div className="space-y-5">
          {/* 2-col (mobile) / 5-col (desktop) Tool Card Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-3.5">
            {toolCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col items-center justify-center text-center gap-2.5 hover:border-[#0F5EC4] hover:shadow-md active:scale-[0.98] transition-all min-h-[132px]"
              >
                {card.icon}
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                    {card.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">
                    {card.subtitle}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Interactive Buffer Tool Panel */}
          {activePanel === 'buffer' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Analisis Buffer Spasial Geodetik
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={handleRunBuffer}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Titik Acuan (Waypoint atau Manual)
                  </label>
                  <select
                    value={selectedWpId}
                    onChange={(e) => setSelectedWpId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {waypoints.map((wp) => (
                      <option key={wp.id} value={wp.id}>
                        {wp.label} ({wp.latitude.toFixed(4)}°, {wp.longitude.toFixed(4)}°)
                      </option>
                    ))}
                    <option value="">Koordinat Manual</option>
                  </select>
                </div>

                {selectedWpId === '' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={customLat}
                        onChange={(e) => setCustomLat(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={customLon}
                        onChange={(e) => setCustomLon(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Radius Buffer
                  </label>
                  <select
                    value={bufferRadiusM}
                    onChange={(e) => setBufferRadiusM(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value={100}>100 m</option>
                    <option value={250}>250 m</option>
                    <option value={500}>500 m</option>
                    <option value={1000}>1.000 m (1 km)</option>
                    <option value={5000}>5.000 m (5 km)</option>
                    <option value={10000}>10.000 m (10 km)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-[#0F5EC4] text-white rounded-xl hover:bg-[#0D4EA3]"
                >
                  Buat Poligon Buffer
                </button>
              </form>
            </section>
          )}

          {/* Interactive Spatial Selection (Intersect within Polygon/Buffer Mask) */}
          {activePanel === 'select' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Seleksi Spasial (Fitur di Dalam Poligon)
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {layers.length === 0 || polygonMaskLayers.length === 0 ? (
                <p className="text-xs text-slate-600">
                  Diperlukan minimal 1 layer target dan 1 layer poligon/buffer sebagai batas seleksi.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Layer Target (Yang Akan Difilter)
                      </label>
                      <select
                        value={resolvedSourceLayer?.id ?? ''}
                        onChange={(e) => setSourceLayerId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        {layers.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} ({l.data.features.length} fitur)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Layer Batas Poligon / Buffer
                      </label>
                      <select
                        value={resolvedMaskLayer?.id ?? ''}
                        onChange={(e) => setMaskLayerId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                      >
                        {polygonMaskLayers.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectionPreview && resolvedSourceLayer && resolvedMaskLayer && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs">
                      <div>
                        <span className="font-bold text-[#0F5EC4] font-mono">
                          {selectionPreview.features.length}
                        </span>{' '}
                        dari {resolvedSourceLayer.data.features.length} fitur berpotongan dengan{' '}
                        <strong className="text-slate-800">{resolvedMaskLayer.name}</strong>.
                      </div>
                      <button
                        type="button"
                        disabled={selectionPreview.features.length === 0}
                        onClick={() =>
                          onAddSpatialSelectionLayer(
                            `Seleksi ${resolvedSourceLayer.name} ∩ ${resolvedMaskLayer.name}`,
                            selectionPreview,
                            '#7C3AED'
                          )
                        }
                        className="px-3.5 py-2 font-semibold bg-[#0F5EC4] text-white rounded-xl hover:bg-[#0D4EA3] disabled:opacity-40 whitespace-nowrap"
                      >
                        Simpan Sebagai Layer Baru
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Geometry Validation & Auto-Repair Panel */}
          {activePanel === 'validate' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Validasi & Perbaikan Topologi Geometri
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {layers.length === 0 ? (
                <p className="text-xs text-slate-600">Belum ada layer vektor untuk divalidasi.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {layerValidationResults.map(({ layer, issues }) => (
                    <div
                      key={layer.id}
                      className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{layer.name}</div>
                        {issues.length === 0 ? (
                          <div className="text-emerald-700 mt-0.5">
                            ✓ Valid ({layer.data.features.length} fitur bebas simpul duplikat & ring tertutup)
                          </div>
                        ) : (
                          <div className="text-amber-700 mt-0.5">
                            {issues.length} masalah: {issues[0].issue} (Fitur #{issues[0].featureIndex + 1})
                          </div>
                        )}
                      </div>
                      {issues.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onRepairLayerGeometry(
                              layer.id,
                              repairFeatureCollectionGeometries(layer.data)
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 whitespace-nowrap"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Perbaiki Otomatis</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Elevation & Slope Profile Panel */}
          {activePanel === 'slope' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Profil Elevasi & Kemiringan Lereng (Slope)
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {elevationProfile.length < 2 ? (
                <p className="text-xs text-slate-600">
                  Diperlukan minimal 2 titik survei dengan data elevasi (meter) untuk menghitung profil kelerengan.
                </p>
              ) : (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <svg viewBox="0 0 600 130" className="w-full h-32">
                      <defs>
                        <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0F5EC4" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#0F5EC4" stopOpacity="0.03" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const padX = 24;
                        const padY = 16;
                        const w = 600 - padX * 2;
                        const h = 130 - padY * 2;
                        const elevSpan = Math.max(1, maxElev - minElev);
                        const coords = elevationProfile.map((p) => {
                          const x = padX + (p.cumulativeDistanceM / maxCumDist) * w;
                          const y = padY + h - ((p.elevationM - minElev) / elevSpan) * h;
                          return [x, y] as [number, number];
                        });
                        const linePoints = coords.map((c) => `${c[0]},${c[1]}`).join(' ');
                        const areaPath = `M ${coords[0][0]},${padY + h} ${coords
                          .map((c) => `L ${c[0]},${c[1]}`)
                          .join(' ')} L ${coords[coords.length - 1][0]},${padY + h} Z`;
                        return (
                          <>
                            <path d={areaPath} fill="url(#elevFill)" />
                            <polyline
                              fill="none"
                              stroke="#0F5EC4"
                              strokeWidth="2.5"
                              points={linePoints}
                            />
                            {coords.map(([cx, cy], idx) => (
                              <circle
                                key={idx}
                                cx={cx}
                                cy={cy}
                                r="4"
                                fill="#0F5EC4"
                                stroke="#FFFFFF"
                                strokeWidth="1.5"
                              />
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                          <th className="py-2 px-3">Titik</th>
                          <th className="py-2 px-3">Elevasi</th>
                          <th className="py-2 px-3">Jarak Akumulatif</th>
                          <th className="py-2 px-3">Beda Tinggi</th>
                          <th className="py-2 px-3">Lereng (%)</th>
                          <th className="py-2 px-3">Sudut (°)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                        {elevationProfile.map((seg, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-sans font-medium text-slate-800">
                              {seg.label}
                            </td>
                            <td className="py-1.5 px-3 text-slate-800">
                              {seg.elevationM.toFixed(1)} m
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              {formatDistance(seg.cumulativeDistanceM)}
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              {i === 0
                                ? '—'
                                : `${seg.deltaElevationM >= 0 ? '+' : ''}${seg.deltaElevationM.toFixed(1)} m`}
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-[#0F5EC4]">
                              {i === 0 ? '—' : `${seg.slopePercent.toFixed(2)}%`}
                            </td>
                            <td className="py-1.5 px-3 text-slate-700">
                              {i === 0 ? '—' : `${seg.slopeDegrees.toFixed(2)}°`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Interactive Overlay Summary Panel */}
          {activePanel === 'overlay' && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">
                  Ringkasan Overlay Layer Aktif
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePanel('none')}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-500">Layer Aktif</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {visibleLayers.length}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-500">Total Titik</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                    {totalPoints}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-500">Panjang Garis ({totalLines})</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#0F5EC4] mt-0.5">
                    {formatDistance(totalLengthM)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="text-slate-500">Luas Poligon ({totalPolygons})</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#0F5EC4] mt-0.5">
                    {formatArea(totalAreaSqM)}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Bottom Readiness Banner */}
        <div className="bg-[#DCFCE7] border border-emerald-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
          <span className="text-sm font-medium text-emerald-950">
            Fitur analisis spasial, seleksi poligon, validasi geometri & profil kelerengan v0.4.0 siap digunakan
          </span>
        </div>
      </div>
    </div>
  );
};

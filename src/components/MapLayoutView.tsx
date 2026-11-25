import React, { useState } from 'react';
import { ArrowLeft, Download, Map, Printer } from 'lucide-react';
import { epsgFor, formatUtmZoneLabel } from '../core/coordinates/indonesiaUtmZones';
import { GeoLayer, ProjectDefinition } from '../core/project/projectDefinition';
import { SurveyWaypoint } from '../core/vector/waypointExporter';

interface MapLayoutViewProps {
  onBack: () => void;
  project: ProjectDefinition;
  layers: GeoLayer[];
  waypoints: SurveyWaypoint[];
  mapSnapshot: {
    dataUrl: string | null;
    centerLat: number;
    centerLon: number;
    zoom: number;
  };
  onGoToMap: () => void;
}

function estimateScaleBar(lat: number, zoom: number): { label: string; widthPx: number } {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const targetMeters = metersPerPixel * 110;
  const niceSteps = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000];
  const chosen =
    niceSteps.find((s) => s >= targetMeters) ?? niceSteps[niceSteps.length - 1];
  const widthPx = Math.max(48, Math.min(160, Math.round(chosen / metersPerPixel)));
  const label = chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`;
  return { label, widthPx };
}

export const MapLayoutView: React.FC<MapLayoutViewProps> = ({
  onBack,
  project,
  layers,
  waypoints,
  mapSnapshot,
  onGoToMap,
}) => {
  const [mapTitle, setMapTitle] = useState(project.name || 'Peta Survei Lapangan');
  const [organization, setOrganization] = useState('Tim Survei Geospasial Indonesia');
  const [surveyor, setSurveyor] = useState('Surveyor Lapangan');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  const visibleLayers = layers.filter((l) => l.visible);
  const centerUtmZone = formatUtmZoneLabel(mapSnapshot.centerLat, mapSnapshot.centerLon);
  const centerEpsg = epsgFor(mapSnapshot.centerLat, mapSnapshot.centerLon);
  const scale = estimateScaleBar(mapSnapshot.centerLat, mapSnapshot.zoom);

  const handleDownloadSnapshot = () => {
    if (!mapSnapshot.dataUrl) return;
    const a = document.createElement('a');
    a.href = mapSnapshot.dataUrl;
    a.download = `${mapTitle.replace(/\s+/g, '_').toLowerCase()}_peta.png`;
    a.click();
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F7FB]">
      <header className="h-14 bg-[#0F5EC4] text-white px-3 sm:px-5 flex items-center gap-3 shadow-sm no-print">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors"
          title="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight">Ekspor PDF & Layout Peta</h1>
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4 mb-6 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Map Layout & Ekspor Cetak</h1>
          <p className="text-sm text-slate-600 mt-1">
            Susun lembar cetak kartografi A4 dengan judul peta, skala batang, arah utara, grid
            koordinat, legenda layer aktif, dan cetak langsung ke PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoToMap}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-50 whitespace-nowrap"
          >
            <Map className="w-3.5 h-3.5" />
            <span>Perbarui Tangkapan Peta</span>
          </button>
          <button
            type="button"
            disabled={!mapSnapshot.dataUrl}
            onClick={handleDownloadSnapshot}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh PNG Peta</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0D3769] text-white rounded-md hover:bg-[#1469BE] whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Layout Properties Column */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-md p-5 space-y-4 no-print">
          <h2 className="text-sm font-semibold text-slate-900">Pengaturan Lembar A4</h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Judul Peta</label>
              <input
                type="text"
                value={mapTitle}
                onChange={(e) => setMapTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 mb-1">Instansi / Proyek</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 mb-1">Disusun Oleh</label>
              <input
                type="text"
                value={surveyor}
                onChange={(e) => setSurveyor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#1469BE]"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-600 mb-1.5">Orientasi Kertas</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    orientation === 'landscape'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  A4 Lanskap
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    orientation === 'portrait'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  A4 Potret
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-700 font-medium">Tampilkan Grid Koordinat</span>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="accent-[#0D3769]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-slate-700 font-medium">Tampilkan Legenda & CRS</span>
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className="accent-[#0D3769]"
                />
              </label>
            </div>
          </div>
        </aside>

        {/* Printable A4 Sheet Preview */}
        <div className="lg:col-span-8 flex justify-center print-only-full">
          <div
            className={`bg-white border border-slate-300 p-6 w-full print-only-full ${
              orientation === 'landscape' ? 'max-w-[840px]' : 'max-w-[620px]'
            }`}
          >
            {/* Outer Cartographic Frame */}
            <div className="border-2 border-slate-900 p-3 flex flex-col gap-3">
              {/* Sheet Header */}
              <div className="flex items-start justify-between border-b border-slate-300 pb-2.5 gap-4">
                <div>
                  <div className="text-[11px] font-medium text-[#1469BE]">
                    {organization} · {project.countryScope}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5">{mapTitle}</h2>
                </div>
                <div className="text-right text-[11px] font-mono tabular-nums text-slate-600 shrink-0">
                  <div>Proyek: {project.id}</div>
                  <div>
                    CRS: {project.crsAuthority}:{project.crsCode} ({centerUtmZone})
                  </div>
                </div>
              </div>

              {/* Map Viewport Area */}
              <div
                className={`relative border border-slate-800 bg-[#DCE8F5] overflow-hidden ${
                  orientation === 'landscape' ? 'h-[380px]' : 'h-[430px]'
                }`}
              >
                {mapSnapshot.dataUrl ? (
                  <img
                    src={mapSnapshot.dataUrl}
                    alt={mapTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-sm font-semibold text-[#0D3769]">
                      Tangkapan Kanvas Peta Belum Diambil
                    </p>
                    <p className="text-xs text-slate-600 mt-1 max-w-sm">
                      Buka tab Peta Utama terlebih dahulu lalu klik tombol Tangkap Peta, atau klik
                      Perbarui Tangkapan Peta di atas.
                    </p>
                  </div>
                )}

                {/* Cartographic Coordinate Grid Overlay */}
                {showGrid && (
                  <div className="pointer-events-none absolute inset-0 border border-slate-900/20 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, idx) => (
                      <div key={idx} className="border border-slate-900/15" />
                    ))}
                  </div>
                )}

                {/* North Arrow */}
                <div className="absolute top-3 right-3 bg-white/95 border border-slate-300 rounded px-2 py-1.5 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-900 leading-none">U</span>
                  <svg
                    width="18"
                    height="24"
                    viewBox="0 0 24 32"
                    className="mt-0.5 text-[#0D3769]"
                    aria-hidden="true"
                  >
                    <polygon points="12,2 20,26 12,21" fill="currentColor" />
                    <polygon
                      points="12,2 4,26 12,21"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                {/* Scale Bar */}
                <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-300 rounded px-2.5 py-1.5">
                  <div className="flex items-end gap-2">
                    <div
                      style={{ width: `${scale.widthPx}px` }}
                      className="h-2 border-b-2 border-x-2 border-slate-900 flex"
                    >
                      <div className="w-1/2 h-full bg-slate-900" />
                      <div className="w-1/2 h-full bg-white" />
                    </div>
                    <span className="text-[10px] font-mono tabular-nums font-semibold text-slate-900 leading-none">
                      {scale.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Legend & Metadata Footer */}
              {showLegend && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 text-xs">
                  <div className="sm:col-span-7 border border-slate-200 p-2.5 rounded-sm">
                    <div className="text-[11px] font-semibold text-slate-900 mb-1.5">
                      Legenda Layer & Data Survei
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1469BE] inline-block shrink-0" />
                        <span className="text-[11px] text-slate-700 truncate">
                          Titik Survei ({waypoints.length})
                        </span>
                      </div>
                      {visibleLayers.map((layer) => (
                        <div key={layer.id} className="flex items-center gap-2">
                          <span
                            style={{ backgroundColor: layer.color }}
                            className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
                          />
                          <span className="text-[11px] text-slate-700 truncate">
                            {layer.name} ({layer.data.features.length})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="sm:col-span-5 border border-slate-200 p-2.5 rounded-sm text-[11px] space-y-1 font-mono tabular-nums text-slate-700">
                    <div>
                      Pusat: {mapSnapshot.centerLat.toFixed(4)}°,{' '}
                      {mapSnapshot.centerLon.toFixed(4)}°
                    </div>
                    <div>
                      Zona: {centerUtmZone}
                      {centerEpsg ? ` (EPSG:${centerEpsg})` : ''}
                    </div>
                    <div className="font-sans text-slate-600">
                      Disusun: {surveyor} · {new Date().toLocaleDateString('id-ID')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

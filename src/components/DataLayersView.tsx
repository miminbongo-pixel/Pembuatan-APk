import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Globe,
  Map as MapIcon,
  Maximize2,
  MoreVertical,
  Plus,
  Search,
  Table2,
  Trash2,
} from 'lucide-react';
import { BASEMAP_CATALOG, BasemapSource } from '../core/map/basemapCatalog';
import {
  GeoLayer,
  LayerSymbology,
  LineDashStyle,
  PointSymbolShape,
  ProjectDefinition,
  validateProjectDefinition,
} from '../core/project/projectDefinition';
import {
  computeFeatureCollectionBounds,
  computeSingleFeatureBounds,
  normalizeLayerSymbology,
} from '../core/spatial/geodesy';
import { epsgFor, formatUtmZoneLabel } from '../core/coordinates/indonesiaUtmZones';
import { extractFeatureLatLon, importVectorFile } from '../core/vector/waypointExporter';
import {
  downloadAndroidGithubZip,
  downloadGithubWorkflowFile,
} from '../core/export/androidGithubExporter';

interface DataLayersViewProps {
  onBack: () => void;
  basemap: BasemapSource;
  onChangeBasemap: (source: BasemapSource) => void;
  project: ProjectDefinition;
  onUpdateProject: (updated: ProjectDefinition) => void;
  layers: GeoLayer[];
  activeLayerId: string | null;
  onSelectActiveLayer: (id: string | null) => void;
  onAddLayersBatch: (newLayers: GeoLayer[]) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleAllLayers: (visible: boolean) => void;
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
  onUpdateLayerColor: (id: string, color: string) => void;
  onUpdateLayerSymbology: (id: string, symbology: LayerSymbology) => void;
  onUpdateFeatureProperties: (
    layerId: string,
    featureIndex: number,
    updatedProps: Record<string, unknown>
  ) => void;
  onDeleteLayerFeature: (layerId: string, featureIndex: number) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
  onZoomToLayer: (bounds: [[number, number], [number, number]]) => void;
  onZoomToFeature: (bounds: [[number, number], [number, number]]) => void;
  onLoadSampleIndonesiaData: () => void;
  initialSubTab?: 'semua' | 'vektor' | 'raster' | 'proyek';
  initialInspectedLayerId?: string | null;
}

const COLOR_SWATCHES = ['#0F5EC4', '#16A34A', '#EF4444', '#D97706', '#7C3AED', '#0F766E'];

const LayerThumbnail: React.FC<{ color: string; kind: 'vector' | 'raster' | 'satellite' }> = ({
  color,
  kind,
}) => {
  if (kind === 'satellite') {
    return (
      <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-emerald-900 shrink-0">
        <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden="true">
          <rect width="48" height="48" fill="#1E3A2F" />
          <path d="M0 14 Q18 8 30 22 T48 20 L48 48 L0 48 Z" fill="#2D5A3F" />
          <path d="M6 34 Q22 24 38 38 L48 36 L48 48 L0 48 Z" fill="#1E40AF" opacity="0.6" />
          <line x1="0" y1="28" x2="48" y2="18" stroke="#E2E8F0" strokeWidth="1.2" opacity="0.7" />
        </svg>
      </div>
    );
  }
  if (kind === 'raster') {
    return (
      <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 shrink-0">
        <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden="true">
          <rect width="48" height="48" fill="#EFF6FF" />
          <path d="M0 10 L48 16 M0 28 L48 22 M16 0 L12 48 M34 0 L38 48" stroke="#93C5FD" strokeWidth="1.5" />
          <path d="M4 40 L24 20 L44 38" stroke="#0F5EC4" strokeWidth="2.5" fill="none" />
          <circle cx="24" cy="20" r="3" fill="#EF4444" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0">
      <svg viewBox="0 0 48 48" className="w-full h-full" aria-hidden="true">
        <rect width="48" height="48" fill="#F8FAFC" />
        <path d="M0 16 H48 M0 32 H48 M16 0 V48 M32 0 V48" stroke="#E2E8F0" strokeWidth="1" />
        <polygon
          points="10,12 30,8 38,26 22,38 8,28"
          fill={color}
          fillOpacity="0.22"
          stroke={color}
          strokeWidth="2"
        />
        <circle cx="24" cy="22" r="3.5" fill={color} />
      </svg>
    </div>
  );
};

export const DataLayersView: React.FC<DataLayersViewProps> = ({
  onBack,
  basemap,
  onChangeBasemap,
  project,
  onUpdateProject,
  layers,
  activeLayerId,
  onSelectActiveLayer,
  onAddLayersBatch,
  onToggleLayerVisibility,
  onToggleAllLayers,
  onUpdateLayerOpacity,
  onUpdateLayerColor,
  onUpdateLayerSymbology,
  onUpdateFeatureProperties,
  onDeleteLayerFeature,
  onMoveLayer,
  onDeleteLayer,
  onZoomToLayer,
  onZoomToFeature,
  onLoadSampleIndonesiaData,
  initialSubTab = 'semua',
  initialInspectedLayerId = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [subTab, setSubTab] = useState<'semua' | 'vektor' | 'raster' | 'proyek'>(initialSubTab);
  const [openMenuLayerId, setOpenMenuLayerId] = useState<string | null>(initialInspectedLayerId);
  const [inspectedLayerId, setInspectedLayerId] = useState<string | null>(initialInspectedLayerId);
  const [attrSearchQuery, setAttrSearchQuery] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isPackagingAndroid, setIsPackagingAndroid] = useState(false);

  const projectErrors = validateProjectDefinition(project);
  const inspectedLayer = layers.find((l) => l.id === inspectedLayerId) ?? null;

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsImporting(true);
    setImportStatus(null);
    const palette = ['#0F5EC4', '#16A34A', '#D97706', '#0F766E', '#7C3AED', '#DC2626'];
    const importedBatch: GeoLayer[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const result = await importVectorFile(files[i]);
        importedBatch.push({
          id: `layer-${Date.now()}-${i}`,
          name: result.name,
          sourceFormat: result.format,
          visible: true,
          opacity: 0.9,
          color: palette[(layers.length + i) % palette.length],
          data: result.data,
          createdAt: new Date().toISOString(),
        });
      }
      if (importedBatch.length > 0) {
        onAddLayersBatch(importedBatch);
      }
      setImportStatus({
        type: 'success',
        message: `${importedBatch.length} berkas vektor berhasil ditambahkan ke Layer Manager.`,
      });
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal membaca berkas geospasial.',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExportLayerGeoJson = (layer: GeoLayer) => {
    const blob = new Blob([JSON.stringify(layer.data, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.name.replace(/\s+/g, '_').toLowerCase()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F4F7FB] flex flex-col">
      {/* Bright Cobalt Blue Header matching Screen 3 */}
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
            {subTab === 'proyek' ? 'Proyek & Metadata' : 'Layer Manager'}
          </h1>
        </div>

        <button
          type="button"
          onClick={onLoadSampleIndonesiaData}
          className="px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 rounded-xl transition-colors whitespace-nowrap"
        >
          + Sampel Indonesia
        </button>
      </header>

      {/* Clean White Tab Strip matching Screen 3 */}
      <div className="bg-white border-b border-slate-200 px-2 sm:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-4">
          {(
            [
              { id: 'semua', label: 'Semua' },
              { id: 'vektor', label: 'Vektor' },
              { id: 'raster', label: 'Raster' },
              { id: 'proyek', label: 'Proyek' },
            ] as const
          ).map((t) => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  active
                    ? 'border-[#0F5EC4] text-[#0F5EC4]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-5xl w-full mx-auto px-4 py-5 flex-1 flex flex-col justify-between gap-5">
        <div className="space-y-4">
          {importStatus && (
            <div
              className={`px-4 py-3 rounded-2xl border text-xs font-medium ${
                importStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {importStatus.message}
            </div>
          )}

          {/* Vector + Raster List */}
          {subTab !== 'proyek' && (
            <div className="space-y-4">
              {/* Vector Section */}
              {(subTab === 'semua' || subTab === 'vektor') && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  {/* Bulk Vector Toolbar */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900">
                        Layer Vektor ({layers.filter((l) => l.visible).length}/{layers.length} aktif)
                      </span>
                      {activeLayerId && layers.some((l) => l.id === activeLayerId) && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#EFF5FC] text-[#0F5EC4] font-semibold text-[11px]">
                          Aktif: {layers.find((l) => l.id === activeLayerId)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => onToggleAllLayers(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Semua ON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleAllLayers(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Semua OFF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allVisible = layers
                            .filter((l) => l.visible)
                            .flatMap((l) => l.data.features);
                          const allBounds = computeFeatureCollectionBounds({
                            type: 'FeatureCollection',
                            features: allVisible,
                          });
                          if (allBounds) onZoomToLayer(allBounds);
                        }}
                        disabled={layers.filter((l) => l.visible).length === 0}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#0F5EC4] text-white hover:bg-[#0D4EA3] font-semibold disabled:opacity-40"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Zoom Semua Data</span>
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {layers.map((layer, index) => {
                      const featureCount = layer.data.features.length;
                      const bounds = computeFeatureCollectionBounds(layer.data);
                      const menuOpen = openMenuLayerId === layer.id;
                      const isInspected = inspectedLayerId === layer.id;
                      const isActive = activeLayerId === layer.id;
                      const sym = normalizeLayerSymbology(layer);

                      return (
                        <div
                          key={layer.id}
                          className={`p-3.5 sm:px-5 transition-colors ${
                            isActive ? 'bg-[#EFF5FC]/55' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => onToggleLayerVisibility(layer.id)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                                  layer.visible
                                    ? 'bg-[#0F5EC4] border-[#0F5EC4] text-white'
                                    : 'bg-white border-slate-300 text-transparent'
                                }`}
                                aria-label={`Tampilkan ${layer.name}`}
                              >
                                <Check className="w-4 h-4" strokeWidth={3} />
                              </button>

                              <LayerThumbnail color={layer.color} kind="vector" />

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900 truncate">
                                    {layer.name}
                                  </span>
                                  {isActive && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#0F5EC4] text-white rounded shrink-0">
                                      Layer Aktif
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                                  Urutan #{index + 1} · {layer.sourceFormat} · {featureCount} fitur ·
                                  Opasitas {Math.round(layer.opacity * 100)}%
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => onSelectActiveLayer(isActive ? null : layer.id)}
                                className={`hidden sm:inline-flex px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                                  isActive
                                    ? 'bg-[#0F5EC4] text-white'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                                title="Pilih sebagai layer aktif"
                              >
                                {isActive ? 'Aktif' : 'Pilih Aktif'}
                              </button>
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => onMoveLayer(layer.id, 'up')}
                                className="p-2 text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-30"
                                title="Naikkan urutan layer"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={index === layers.length - 1}
                                onClick={() => onMoveLayer(layer.id, 'down')}
                                className="p-2 text-slate-600 rounded-xl hover:bg-slate-100 disabled:opacity-30"
                                title="Turunkan urutan layer"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setOpenMenuLayerId(menuOpen ? null : layer.id)}
                                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
                                  menuOpen
                                    ? 'bg-[#0F5EC4] text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Simbol, warna, transparansi & aksi"
                              >
                                <MoreVertical className="w-5 h-5" />
                              </button>
                            </div>
                          </div>

                          {menuOpen && (
                            <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-slate-600 mr-1">
                                      Warna
                                    </span>
                                    {COLOR_SWATCHES.map((sw) => (
                                      <button
                                        key={sw}
                                        type="button"
                                        onClick={() => onUpdateLayerColor(layer.id, sw)}
                                        style={{ backgroundColor: sw }}
                                        className={`w-5 h-5 rounded-md border ${
                                          layer.color.toLowerCase() === sw.toLowerCase()
                                            ? 'border-slate-900 scale-110'
                                            : 'border-white shadow-sm'
                                        }`}
                                      />
                                    ))}
                                    <input
                                      type="color"
                                      value={layer.color}
                                      onChange={(e) => onUpdateLayerColor(layer.id, e.target.value)}
                                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer ml-1"
                                    />
                                  </div>

                                  <label className="flex items-center gap-2 text-xs text-slate-600">
                                    <span>Transparansi ({Math.round(layer.opacity * 100)}%)</span>
                                    <input
                                      type="range"
                                      min={0.1}
                                      max={1}
                                      step={0.05}
                                      value={layer.opacity}
                                      onChange={(e) =>
                                        onUpdateLayerOpacity(
                                          layer.id,
                                          Number.parseFloat(e.target.value)
                                        )
                                      }
                                      className="w-24 accent-[#0F5EC4]"
                                    />
                                  </label>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onSelectActiveLayer(isActive ? null : layer.id)}
                                    className={`sm:hidden px-2.5 py-1.5 rounded-xl text-xs font-semibold ${
                                      isActive
                                        ? 'bg-[#0F5EC4] text-white'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {isActive ? 'Aktif' : 'Pilih Aktif'}
                                  </button>
                                  {bounds && (
                                    <button
                                      type="button"
                                      onClick={() => onZoomToLayer(bounds)}
                                      className="p-2 text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100"
                                      title="Zoom ke layer"
                                    >
                                      <Maximize2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setInspectedLayerId(isInspected ? null : layer.id)
                                    }
                                    className={`p-2 rounded-xl ${
                                      isInspected
                                        ? 'bg-[#0F5EC4] text-white'
                                        : 'text-slate-700 bg-slate-50 hover:bg-slate-100'
                                    }`}
                                    title="Tabel atribut"
                                  >
                                    <Table2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleExportLayerGeoJson(layer)}
                                    className="p-2 text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100"
                                    title="Unduh GeoJSON"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteLayer(layer.id)}
                                    className="p-2 text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100"
                                    title="Hapus layer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Symbology Controls */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-slate-600">
                                    Simbol Titik
                                  </span>
                                  <select
                                    value={sym.pointShape}
                                    onChange={(e) =>
                                      onUpdateLayerSymbology(layer.id, {
                                        ...sym,
                                        pointShape: e.target.value as PointSymbolShape,
                                      })
                                    }
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                                  >
                                    <option value="circle">Lingkaran</option>
                                    <option value="square">Kotak</option>
                                    <option value="triangle">Segitiga</option>
                                    <option value="diamond">Belah Ketupat</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-slate-600">
                                    Ukuran Titik ({sym.pointSize}px)
                                  </span>
                                  <input
                                    type="range"
                                    min={4}
                                    max={14}
                                    step={0.5}
                                    value={sym.pointSize}
                                    onChange={(e) =>
                                      onUpdateLayerSymbology(layer.id, {
                                        ...sym,
                                        pointSize: Number.parseFloat(e.target.value),
                                      })
                                    }
                                    className="accent-[#0F5EC4] mt-1.5"
                                  />
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-slate-600">
                                    Gaya Garis
                                  </span>
                                  <select
                                    value={sym.lineDash}
                                    onChange={(e) =>
                                      onUpdateLayerSymbology(layer.id, {
                                        ...sym,
                                        lineDash: e.target.value as LineDashStyle,
                                      })
                                    }
                                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                                  >
                                    <option value="solid">Garis Utuh</option>
                                    <option value="dashed">Putus-putus</option>
                                    <option value="dotted">Titik-titik</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-slate-600">
                                    Tebal Garis ({sym.lineWidth}px)
                                  </span>
                                  <input
                                    type="range"
                                    min={1}
                                    max={8}
                                    step={0.5}
                                    value={sym.lineWidth}
                                    onChange={(e) =>
                                      onUpdateLayerSymbology(layer.id, {
                                        ...sym,
                                        lineWidth: Number.parseFloat(e.target.value),
                                      })
                                    }
                                    className="accent-[#0F5EC4] mt-1.5"
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {layers.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-sm font-semibold text-slate-800">
                          Belum ada layer vektor yang dimuat
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Seret beberapa file ke kotak di bawah atau tekan tombol + Tambah Beberapa
                          Layer Sekaligus.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raster / Basemap Layers (Grouped Satelit & Jalan) */}
              {(subTab === 'semua' || subTab === 'raster') && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Peta Dasar: Satelit & Jalan
                    </span>
                    <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          onChangeBasemap(
                            BASEMAP_CATALOG.find((b) => b.id === 'esri-satellite') ??
                              BASEMAP_CATALOG[0]
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                          basemap.category === 'satellite' || basemap.category === 'hybrid'
                            ? 'bg-[#0F5EC4] text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Satelit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeBasemap(
                            BASEMAP_CATALOG.find((b) => b.id === 'google-roadmap') ??
                              BASEMAP_CATALOG[3]
                          )
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                          basemap.category === 'street' || basemap.category === 'vector'
                            ? 'bg-[#0F5EC4] text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <MapIcon className="w-3.5 h-3.5" />
                        <span>Jalan</span>
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {BASEMAP_CATALOG.map((source) => {
                      const active = source.id === basemap.id;
                      return (
                        <div
                          key={source.id}
                          onClick={() => onChangeBasemap(source)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') onChangeBasemap(source);
                          }}
                          className="p-3.5 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center border shrink-0 ${
                                active
                                  ? 'bg-[#0F5EC4] border-[#0F5EC4] text-white'
                                  : 'bg-white border-slate-300 text-transparent'
                              }`}
                            >
                              <Check className="w-4 h-4" strokeWidth={3} />
                            </div>

                            <LayerThumbnail
                              color="#0F5EC4"
                              kind={
                                source.category === 'satellite' || source.category === 'hybrid'
                                  ? 'satellite'
                                  : 'raster'
                              }
                            />

                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {source.displayName}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                {source.category === 'satellite' || source.category === 'hybrid'
                                  ? 'Citra Satelit'
                                  : 'Peta Jalan & Vektor'}{' '}
                                · {source.attribution}
                              </div>
                            </div>
                          </div>

                          <span className="text-xs font-medium text-[#0F5EC4] shrink-0">
                            {active ? 'Aktif' : 'Pilih'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attribute Table Viewer with Search, Inline Editing & Zoom to Selected Object */}
          {inspectedLayer && subTab !== 'proyek' && (() => {
            const cols = Array.from(
              new Set(
                inspectedLayer.data.features.flatMap((feat) =>
                  Object.keys((feat.properties as Record<string, unknown>) ?? {})
                )
              )
            ).slice(0, 6);

            const q = attrSearchQuery.trim().toLowerCase();
            const indexedFeatures = inspectedLayer.data.features
              .map((feature, idx) => ({ feature, idx }))
              .filter(({ feature }) => {
                if (!q) return true;
                const gType = (feature.geometry?.type ?? '').toLowerCase();
                if (gType.includes(q)) return true;
                return Object.values((feature.properties as Record<string, unknown>) ?? {}).some(
                  (v) => String(v ?? '').toLowerCase().includes(q)
                );
              });

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={inspectedLayer.color}
                      onChange={(e) => onUpdateLayerColor(inspectedLayer.id, e.target.value)}
                      className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                      title="Ubah warna layer"
                    />
                    <h3 className="text-xs font-bold text-slate-900">
                      Tabel Atribut ({indexedFeatures.length}/{inspectedLayer.data.features.length}
                      ): {inspectedLayer.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={attrSearchQuery}
                        onChange={(e) => setAttrSearchQuery(e.target.value)}
                        placeholder="Cari atribut..."
                        className="pl-7 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F5EC4]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setInspectedLayerId(null)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Geometri</th>
                        <th className="py-2 px-3 whitespace-nowrap">Lat / Lon (WGS 84)</th>
                        <th className="py-2 px-3 whitespace-nowrap">Zona UTM</th>
                        {cols.map((col) => (
                          <th key={col} className="py-2 px-3 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                        <th className="py-2 px-2 text-right">Zoom / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {indexedFeatures.slice(0, 60).map(({ feature: f, idx }) => {
                        const props = (f.properties as Record<string, unknown>) ?? {};
                        const featBounds = computeSingleFeatureBounds(f);
                        const latLon = extractFeatureLatLon(f);
                        const featEpsg = latLon ? epsgFor(latLon.lat, latLon.lon) : null;
                        const featZone = latLon
                          ? formatUtmZoneLabel(latLon.lat, latLon.lon)
                          : '—';
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono tabular-nums text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-[#0F5EC4]">
                              {f.geometry?.type ?? 'Null'}
                            </td>
                            <td className="py-1.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {latLon
                                ? `${latLon.lat.toFixed(5)}°, ${latLon.lon.toFixed(5)}°`
                                : '—'}
                            </td>
                            <td className="py-1.5 px-3 font-mono tabular-nums text-[#0F5EC4] whitespace-nowrap">
                              {featZone}
                              {featEpsg ? ` · ${featEpsg}` : ''}
                            </td>
                            {cols.map((col) => (
                              <td key={col} className="py-1 px-2 min-w-[110px]">
                                <input
                                  type="text"
                                  value={
                                    props[col] === undefined || props[col] === null
                                      ? ''
                                      : String(props[col])
                                  }
                                  onChange={(e) => {
                                    onUpdateFeatureProperties(inspectedLayer.id, idx, {
                                      ...props,
                                      [col]: e.target.value,
                                    });
                                  }}
                                  className="w-full px-2 py-1 text-xs text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-[#0F5EC4] rounded-md focus:outline-none"
                                />
                              </td>
                            ))}
                            <td className="py-1 px-2 text-right whitespace-nowrap">
                              {featBounds && (
                                <button
                                  type="button"
                                  onClick={() => onZoomToFeature(featBounds)}
                                  className="p-1 text-[#0F5EC4] hover:bg-blue-50 rounded-lg mr-1"
                                  title="Zoom ke objek terpilih ini"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onDeleteLayerFeature(inspectedLayer.id, idx)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                                title="Hapus fitur ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Project Metadata Sub-Tab */}
          {subTab === 'proyek' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    Metadata Proyek (ProjectDefinition)
                  </h2>
                  <span
                    className={`text-xs font-semibold ${
                      projectErrors.length === 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {projectErrors.length === 0 ? '● Valid' : '✖ Perlu Perbaikan'}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">ID Proyek</label>
                    <input
                      type="text"
                      value={project.id}
                      onChange={(e) => onUpdateProject({ ...project, id: e.target.value })}
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">Nama Proyek</label>
                    <input
                      type="text"
                      value={project.name}
                      onChange={(e) => onUpdateProject({ ...project, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Otoritas CRS</label>
                      <input
                        type="text"
                        value={project.crsAuthority}
                        onChange={(e) =>
                          onUpdateProject({ ...project, crsAuthority: e.target.value })
                        }
                        className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">Kode EPSG</label>
                      <input
                        type="number"
                        value={project.crsCode}
                        onChange={(e) =>
                          onUpdateProject({
                            ...project,
                            crsCode: Number.parseInt(e.target.value || '0', 10),
                          })
                        }
                        className="w-full px-3 py-2 font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      Pengembang / Penanggung Jawab
                    </label>
                    <input
                      type="text"
                      value={project.author ?? 'ngek@'}
                      onChange={(e) =>
                        onUpdateProject({ ...project, author: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      Cakupan Wilayah
                    </label>
                    <input
                      type="text"
                      value={project.countryScope}
                      onChange={(e) =>
                        onUpdateProject({ ...project, countryScope: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                    />
                  </div>

                  {projectErrors.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 space-y-1">
                      {projectErrors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 text-xs text-slate-600 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Data Center Multi-Format</h3>
                <p>
                  <strong className="text-slate-800">GeoJSON (.geojson / .json):</strong> Titik,
                  garis, poligon, dan atribut lengkap.
                </p>
                <p>
                  <strong className="text-slate-800">KML & KMZ (.kml / .kmz):</strong> Impor
                  langsung dari Google Earth.
                </p>
                <p>
                  <strong className="text-slate-800">GPX (.gpx):</strong> Waypoint & track GPS
                  lapangan.
                </p>
                <p>
                  <strong className="text-slate-800">Shapefile (.zip):</strong> Arsip ZIP berisi
                  .shp, .dbf, .prj, dan .shx. Klik poliline, poligon, atau titik di peta untuk
                  melihat atribut dan mengubah warnanya.
                </p>
                <p>
                  <strong className="text-slate-800">CSV / TXT (.csv):</strong> Tabel koordinat
                  dengan kolom <code className="font-mono">latitude/lat</code> dan{' '}
                  <code className="font-mono">longitude/lon</code>.
                </p>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="font-bold text-slate-900">
                    Build APK v0.4.0 — GitHub & Android Studio (oleh ngek@)
                  </div>
                  <p className="text-slate-500">
                    Unduh proyek Gradle Kotlin lengkap dengan Gradle Wrapper 8.9 (
                    <code className="font-mono">gradlew</code>,{' '}
                    <code className="font-mono">gradlew.bat</code>,{' '}
                    <code className="font-mono">gradle-wrapper.jar</code>),{' '}
                    <code className="font-mono">.gitattributes</code>, serta workflow GitHub
                    Actions (<code className="font-mono">build-apk.yml</code>) yang membangun APK
                    Debug &amp; Release serta menerbitkan ke <strong>GitHub Releases</strong>.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>
                      <strong>GitHub:</strong> Push arsip ZIP ke branch{' '}
                      <code className="font-mono">main</code> lalu unduh{' '}
                      <code className="font-mono">DHY-Explorer-v0.4.0-debug.apk</code> dari{' '}
                      <strong>Releases</strong> atau <strong>Actions</strong>.
                    </li>
                    <li>
                      <strong>Android Studio:</strong> Buka folder{' '}
                      <code className="font-mono">android-studio-project</code> →{' '}
                      <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>.
                    </li>
                  </ul>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      disabled={isPackagingAndroid}
                      onClick={async () => {
                        setIsPackagingAndroid(true);
                        try {
                          await downloadAndroidGithubZip();
                          setImportStatus({
                            type: 'success',
                            message:
                              'Paket GitHub & Android Studio (.zip) berhasil diunduh.',
                          });
                        } catch (err) {
                          setImportStatus({
                            type: 'error',
                            message:
                              err instanceof Error
                                ? err.message
                                : 'Gagal membuat paket GitHub & Android Studio.',
                          });
                        } finally {
                          setIsPackagingAndroid(false);
                        }
                      }}
                      className="flex-1 h-10 px-3 rounded-xl bg-[#0F5EC4] hover:bg-[#0D4EA3] text-white font-semibold text-xs inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>
                        {isPackagingAndroid
                          ? 'Menyiapkan Arsip...'
                          : 'Unduh Paket GitHub & Android Studio (.zip)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadGithubWorkflowFile();
                        setImportStatus({
                          type: 'success',
                          message:
                            'Berkas workflow .github/workflows/build-apk.yml berhasil diunduh.',
                        });
                      }}
                      className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5 text-[#0F5EC4]" />
                      <span>build-apk.yml</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drag-and-Drop Multi-File Zone + Full-Width "+ Tambah Beberapa Layer Sekaligus" CTA */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFiles(true);
          }}
          onDragLeave={() => setIsDraggingFiles(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFiles(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-3 transition-colors ${
            isDraggingFiles
              ? 'border-[#0F5EC4] bg-[#EFF5FC]'
              : 'border-slate-300 bg-white/70'
          }`}
        >
          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-12 rounded-xl bg-[#0F5EC4] hover:bg-[#0D4EA3] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {isImporting ? (
              <FileUp className="w-4 h-4" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            <span>
              {isImporting
                ? 'Mengimpor Beberapa Layer...'
                : 'Tambah Beberapa Layer Sekaligus (GeoJSON, KML/KMZ, GPX, SHP ZIP, CSV)'}
            </span>
          </button>
          <p className="text-[11px] text-slate-500 text-center mt-2">
            Anda dapat memilih atau menyeret (drag & drop) banyak berkas sekaligus ke area ini.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".geojson,.json,.kml,.kmz,.gpx,.zip,.csv,.txt"
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

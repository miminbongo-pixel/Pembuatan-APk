import React, { useEffect, useRef, useState } from 'react';
import { Layers, Map, Menu, Wrench } from 'lucide-react';
import { GeoMapCanvas } from './components/GeoMapCanvas';
import { HomeMenuView } from './components/HomeMenuView';
import { UtmCoordinatesView } from './components/UtmCoordinatesView';
import { SurveyGpsView } from './components/SurveyGpsView';
import { DataLayersView } from './components/DataLayersView';
import { AnalysisToolsView } from './components/AnalysisToolsView';
import { MapLayoutView } from './components/MapLayoutView';
import { BASEMAP_CATALOG, BasemapSource, MAP_LIBRE_CONFIG } from './core/map/basemapCatalog';
import {
  GeoLayer,
  LayerSymbology,
  MapToolMode,
  ProjectDefinition,
  WorkspaceTab,
} from './core/project/projectDefinition';
import { createPointBufferPolygon, LngLatTuple } from './core/spatial/geodesy';
import { SurveyWaypoint } from './core/vector/waypointExporter';
import { downloadAndroidGithubZip } from './core/export/androidGithubExporter';

const STORAGE_KEY = 'geoexplorer_workspace_v2';

const DEFAULT_PROJECT: ProjectDefinition = {
  id: 'geo-id-01',
  name: 'Survei Lapangan Nusantara',
  crsAuthority: 'EPSG',
  crsCode: 4326,
  countryScope: 'Indonesia',
  author: 'ngek@',
};

const INITIAL_WAYPOINTS: SurveyWaypoint[] = [
  {
    id: 'wp-1',
    label: 'Makassar (Titik Kontrol 50S)',
    latitude: -5.1478,
    longitude: 119.4321,
    elevationM: 4.5,
    accuracyM: 3.2,
    category: 'Titik Kontrol',
    note: 'UTM Zone 50S · EPSG:32750',
    recordedAt: '2026-11-25T08:00:00.000Z',
  },
  {
    id: 'wp-2',
    label: 'Timika Papua Tengah',
    latitude: -4.0,
    longitude: 135.0,
    elevationM: 28.0,
    accuracyM: 4.0,
    category: 'Titik Kontrol',
    note: 'UTM Zone 53S · EPSG:32753',
    recordedAt: '2026-11-25T08:05:00.000Z',
  },
  {
    id: 'wp-3',
    label: 'Batam Kepulauan Riau',
    latitude: 1.0,
    longitude: 103.0,
    elevationM: 11.2,
    accuracyM: 2.8,
    category: 'Titik Kontrol',
    note: 'UTM Zone 48N · EPSG:32648',
    recordedAt: '2026-11-25T08:10:00.000Z',
  },
  {
    id: 'wp-4',
    label: 'Merauke Papua Selatan',
    latitude: -8.0,
    longitude: 140.0,
    elevationM: 6.1,
    accuracyM: 3.5,
    category: 'Titik Kontrol',
    note: 'UTM Zone 54S · EPSG:32754',
    recordedAt: '2026-11-25T08:15:00.000Z',
  },
];

const INITIAL_SAMPLE_LAYERS: GeoLayer[] = [
  {
    id: 'layer-batas-sulawesi',
    name: 'Batas Wilayah Survei (Makassar)',
    sourceFormat: 'GeoJSON',
    visible: true,
    opacity: 0.9,
    color: '#16A34A',
    createdAt: '2026-11-25T08:00:00.000Z',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            nama: 'Zona Survei Pesisir Makassar',
            luas_ha: 645.2,
            epsg: 32750,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [119.392, -5.115],
                [119.455, -5.115],
                [119.455, -5.175],
                [119.392, -5.175],
                [119.392, -5.115],
              ],
            ],
          },
        },
      ],
    },
  },
  {
    id: 'layer-jaringan-jalan',
    name: 'Jaringan Jalan & Transek',
    sourceFormat: 'GeoJSON',
    visible: true,
    opacity: 0.95,
    color: '#EF4444',
    createdAt: '2026-11-25T08:02:00.000Z',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            nama: 'Koridor Survei Utama',
            panjang_km: 12.6,
            zona_utm: 'Zona 50S',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [119.405, -5.11],
              [119.422, -5.138],
              [119.4321, -5.1478],
              [119.448, -5.172],
            ],
          },
        },
      ],
    },
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
  const [layersInitialSubTab, setLayersInitialSubTab] = useState<
    'semua' | 'vektor' | 'raster' | 'proyek'
  >('semua');
  const [inspectedLayerIdFromMap, setInspectedLayerIdFromMap] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapSource>(BASEMAP_CATALOG[0]);
  const [showUtmGrid, setShowUtmGrid] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.showUtmGrid === 'boolean') return parsed.showUtmGrid;
      }
    } catch {
      // Ignore storage errors
    }
    return true;
  });
  const [toolMode, setToolMode] = useState<MapToolMode>('inspect');

  const [project, setProject] = useState<ProjectDefinition>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.project) return parsed.project;
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_PROJECT;
  });

  const [waypoints, setWaypoints] = useState<SurveyWaypoint[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.waypoints)) return parsed.waypoints;
      }
    } catch {
      // Ignore storage errors
    }
    return INITIAL_WAYPOINTS;
  });

  const [layers, setLayers] = useState<GeoLayer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.layers)) return parsed.layers;
      }
    } catch {
      // Ignore storage errors
    }
    return INITIAL_SAMPLE_LAYERS;
  });

  const [activeLayerId, setActiveLayerId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.activeLayerId === 'string') return parsed.activeLayerId;
      }
    } catch {
      // Ignore storage errors
    }
    return INITIAL_SAMPLE_LAYERS[0]?.id ?? null;
  });

  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number;
    lon: number;
    zoom?: number;
    nonce: number;
  } | null>(null);

  const [fitBoundsTarget, setFitBoundsTarget] = useState<{
    bounds: [[number, number], [number, number]];
    maxZoom?: number;
    nonce: number;
  } | null>(null);

  const [mapSnapshot, setMapSnapshot] = useState<{
    dataUrl: string | null;
    centerLat: number;
    centerLon: number;
    zoom: number;
  }>({
    dataUrl: null,
    centerLat: -5.1478,
    centerLon: 119.4321,
    zoom: 7.2,
  });

  const [gpsPosition, setGpsPosition] = useState<{
    lat: number;
    lon: number;
    accuracy: number | null;
    altitude: number | null;
    timestamp: string;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<
    'prompt' | 'granted' | 'denied' | 'unsupported'
  >(() => (!navigator.geolocation ? 'unsupported' : 'prompt'));
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isTrackingGps, setIsTrackingGps] = useState(false);
  const [trackPoints, setTrackPoints] = useState<LngLatTuple[]>([]);
  const watchIdRef = useRef<number | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ project, waypoints, layers, activeLayerId, showUtmGrid })
      );
    } catch {
      // Ignore quota errors
    }
  }, [project, waypoints, layers, activeLayerId, showUtmGrid]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsPermissionState('unsupported');
      return;
    }
    let permStatus: PermissionStatus | null = null;
    const handlePermChange = () => {
      if (permStatus) {
        setGpsPermissionState(permStatus.state as 'prompt' | 'granted' | 'denied');
      }
    };
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        permStatus = status;
        setGpsPermissionState(status.state as 'prompt' | 'granted' | 'denied');
        status.addEventListener('change', handlePermChange);
      })
      .catch(() => {
        // Browser does not support Permissions API for geolocation
      });

    return () => {
      if (permStatus) {
        permStatus.removeEventListener('change', handlePermChange);
      }
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handleRequestGpsFix = () => {
    if (!navigator.geolocation) {
      setGpsPermissionState('unsupported');
      setGpsError('Browser ini tidak mendukung Geolocation API.');
      showToast('Browser tidak mendukung Geolocation API.');
      return;
    }
    setIsLocatingGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGpsPermissionState('granted');
        setGpsPosition({
          lat,
          lon,
          accuracy: pos.coords.accuracy ?? null,
          altitude: pos.coords.altitude ?? null,
          timestamp: new Date(pos.timestamp).toISOString(),
        });
        setIsLocatingGps(false);
        setFlyToTarget({ lat, lon, zoom: 15, nonce: Date.now() });
        showToast(`Posisi GNSS ditemukan (${lat.toFixed(5)}°, ${lon.toFixed(5)}°)`);
      },
      (err) => {
        setIsLocatingGps(false);
        if (err.code === 1) {
          setGpsPermissionState('denied');
        }
        const msg =
          err.code === 1
            ? 'Izin lokasi ditolak oleh pengguna. Aktifkan izin lokasi di pengaturan browser untuk melanjutkan.'
            : `Gagal membaca posisi GNSS: ${err.message}`;
        setGpsError(msg);
        showToast(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleToggleTracking = () => {
    if (!navigator.geolocation) {
      setGpsPermissionState('unsupported');
      setGpsError('Browser ini tidak mendukung perekaman lintasan GNSS.');
      return;
    }

    if (isTrackingGps) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsTrackingGps(false);
      showToast(`Perekaman track dihentikan (${trackPoints.length} titik terekam).`);
      return;
    }

    setGpsError(null);
    setTrackPoints([]);
    setIsTrackingGps(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setGpsPermissionState('granted');
        setGpsPosition({
          lat,
          lon,
          accuracy: pos.coords.accuracy ?? null,
          altitude: pos.coords.altitude ?? null,
          timestamp: new Date(pos.timestamp).toISOString(),
        });
        setTrackPoints((prev) => {
          const last = prev[prev.length - 1];
          if (last && Math.abs(last[0] - lon) < 1e-7 && Math.abs(last[1] - lat) < 1e-7) {
            return prev;
          }
          return [...prev, [lon, lat]];
        });
      },
      (err) => {
        if (err.code === 1) {
          setGpsPermissionState('denied');
          setGpsError('Izin lokasi ditolak saat merekam jalur perjalanan.');
        } else {
          setGpsError(`Kendala perekaman track: ${err.message}`);
        }
        setIsTrackingGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
  };

  const handleClearTrack = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingGps(false);
    setTrackPoints([]);
    showToast('Jalur perjalanan sementara dibersihkan.');
  };

  const handleSaveTrackToLayer = () => {
    if (trackPoints.length < 2) return;
    const newLayer: GeoLayer = {
      id: `layer-track-${Date.now()}`,
      name: `Track GNSS ${new Date().toLocaleTimeString('id-ID')}`,
      sourceFormat: 'GPX',
      visible: true,
      opacity: 0.95,
      color: '#16A34A',
      createdAt: new Date().toISOString(),
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              titik: trackPoints.length,
              direkam_pada: new Date().toISOString(),
            },
            geometry: {
              type: 'LineString',
              coordinates: trackPoints,
            },
          },
        ],
      },
    };
    setLayers((prev) => [newLayer, ...prev]);
    setTrackPoints([]);
    showToast('Lintasan track GNSS disimpan sebagai layer.');
  };

  const handleAddWaypointFromMap = (lat: number, lon: number, label?: string) => {
    const nextIdx = waypoints.length + 1;
    const wp: SurveyWaypoint = {
      id: `wp-${Date.now()}`,
      label: label || `Titik-${String(nextIdx).padStart(2, '0')}`,
      latitude: lat,
      longitude: lon,
      elevationM: null,
      accuracyM: null,
      category: 'Survei',
      note: 'Ditandai pada kanvas peta',
      recordedAt: new Date().toISOString(),
    };
    setWaypoints((prev) => [wp, ...prev]);
    showToast(`${wp.label} ditambahkan (${lat.toFixed(5)}°, ${lon.toFixed(5)}°)`);
  };

  const handleAddWaypointFromForm = (wpData: Omit<SurveyWaypoint, 'id' | 'recordedAt'>) => {
    const wp: SurveyWaypoint = {
      ...wpData,
      id: `wp-${Date.now()}`,
      recordedAt: new Date().toISOString(),
    };
    setWaypoints((prev) => [wp, ...prev]);
    showToast(`${wp.label} berhasil disimpan.`);
  };

  const handleUpdateWaypoint = (
    id: string,
    updates: Partial<Omit<SurveyWaypoint, 'id' | 'recordedAt'>>
  ) => {
    setWaypoints((prev) =>
      prev.map((wp) => (wp.id === id ? { ...wp, ...updates } : wp))
    );
    showToast('Atribut waypoint berhasil diperbarui.');
  };

  const handleSaveDigitizedFeature = (
    type: 'LineString' | 'Polygon',
    coordinates: LngLatTuple[],
    metrics: Record<string, string | number>,
    customName?: string
  ) => {
    const ringOrLine =
      type === 'Polygon' ? [[...coordinates, coordinates[0]]] : coordinates;
    const defaultName =
      type === 'Polygon'
        ? `Poligon Digitasi (${metrics.luas ?? ''})`
        : `Garis Digitasi (${metrics.panjang ?? ''})`;
    const newLayer: GeoLayer = {
      id: `layer-digitize-${Date.now()}`,
      name: customName || defaultName,
      sourceFormat: 'Digitasi',
      visible: true,
      opacity: 0.9,
      color: type === 'Polygon' ? '#0F766E' : '#D97706',
      createdAt: new Date().toISOString(),
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: metrics,
            geometry:
              type === 'Polygon'
                ? { type: 'Polygon', coordinates: ringOrLine as LngLatTuple[][] }
                : { type: 'LineString', coordinates: ringOrLine as LngLatTuple[] },
          },
        ],
      },
    };
    setLayers((prev) => [newLayer, ...prev]);
    showToast(`Hasil ${type === 'Polygon' ? 'poligon' : 'garis'} disimpan ke Layer Manager.`);
  };

  const handleUpdateFeatureProperties = (
    layerId: string,
    featureIndex: number,
    updatedProps: Record<string, unknown>
  ) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;
        const nextFeatures = layer.data.features.map((feat, idx) =>
          idx === featureIndex ? { ...feat, properties: updatedProps } : feat
        );
        return {
          ...layer,
          data: { ...layer.data, features: nextFeatures },
        };
      })
    );
    showToast('Atribut fitur diperbarui.');
  };

  const handleDeleteLayerFeature = (layerId: string, featureIndex: number) => {
    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== layerId) return layer;
        const nextFeatures = layer.data.features.filter((_, idx) => idx !== featureIndex);
        return {
          ...layer,
          data: { ...layer.data, features: nextFeatures },
        };
      })
    );
    showToast('Fitur berhasil dihapus dari layer.');
  };

  const handleCreateBufferAt = (
    lon: number,
    lat: number,
    radiusMeters: number,
    label: string
  ) => {
    const bufferPoly = createPointBufferPolygon(lon, lat, radiusMeters, label);
    const newLayer: GeoLayer = {
      id: `layer-buffer-${Date.now()}`,
      name: `Buffer ${radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`} · ${label}`,
      sourceFormat: 'Buffer',
      visible: true,
      opacity: 0.85,
      color: '#0F5EC4',
      createdAt: new Date().toISOString(),
      data: {
        type: 'FeatureCollection',
        features: [bufferPoly],
      },
    };
    setLayers((prev) => [newLayer, ...prev]);
    setActiveTab('map');
    setFlyToTarget({ lat, lon, zoom: 13, nonce: Date.now() });
    showToast(`Layer buffer ${radiusMeters} m dibuat di sekitar ${label}.`);
  };

  const handleFocusMapAt = (lat: number, lon: number, zoom?: number) => {
    setActiveTab('map');
    setFlyToTarget({ lat, lon, zoom: zoom ?? 13, nonce: Date.now() });
  };

  const handleZoomToLayer = (bounds: [[number, number], [number, number]]) => {
    setActiveTab('map');
    setFitBoundsTarget({ bounds, maxZoom: 15.5, nonce: Date.now() });
  };

  const handleZoomToFeature = (bounds: [[number, number], [number, number]]) => {
    setActiveTab('map');
    setFitBoundsTarget({ bounds, maxZoom: 17, nonce: Date.now() });
  };

  const handleAddLayersBatch = (newLayers: GeoLayer[]) => {
    if (newLayers.length === 0) return;
    setLayers((prev) => [...newLayers, ...prev]);
    setActiveLayerId(newLayers[0].id);
    showToast(`${newLayers.length} layer baru ditambahkan dan diaktifkan.`);
  };

  const handleToggleLayerVisibility = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
    );
  };

  const handleToggleAllLayers = (visible: boolean) => {
    setLayers((prev) => prev.map((l) => ({ ...l, visible })));
    showToast(visible ? 'Semua layer diaktifkan.' : 'Semua layer dinonaktifkan.');
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleDeleteLayer = (id: string) => {
    setLayers((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeLayerId === id) {
        setActiveLayerId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleUpdateLayerSymbology = (id: string, symbology: LayerSymbology) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, symbology } : l))
    );
  };

  const handleLoadSampleIndonesiaData = () => {
    let added = 0;
    INITIAL_SAMPLE_LAYERS.forEach((sample) => {
      if (!layers.some((l) => l.id === sample.id)) {
        setLayers((prev) => [sample, ...prev]);
        added++;
      }
    });
    setActiveTab('map');
    setFlyToTarget({ lat: -5.1478, lon: 119.4321, zoom: 12, nonce: Date.now() });
    showToast(
      added > 0
        ? 'Sampel layer survei Makassar dimuat ke peta.'
        : 'Sampel layer survei sudah aktif di Layer Manager.'
    );
  };

  const handleExportProjectBundle = () => {
    const payload = {
      schema: 'geoexplorer-project-v1',
      exportedAt: new Date().toISOString(),
      project,
      waypoints,
      layers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id || 'dhy_explorer'}_proyek.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Berkas proyek D H Y Explorer (.json) berhasil diekspor.');
  };

  const handleHomeNavigate = (
    dest: 'map' | 'layers' | 'project' | 'tools' | 'survey' | 'utm'
  ) => {
    if (dest === 'project') {
      setLayersInitialSubTab('proyek');
      setActiveTab('layers');
      return;
    }
    if (dest === 'layers') {
      setLayersInitialSubTab('semua');
      setActiveTab('layers');
      return;
    }
    setActiveTab(dest);
  };

  const bottomNavItems: {
    id: 'map' | 'layers' | 'tools' | 'home';
    label: string;
    icon: React.ReactNode;
    active: boolean;
  }[] = [
    {
      id: 'map',
      label: 'Peta',
      icon: <Map className="w-5 h-5" />,
      active: activeTab === 'map',
    },
    {
      id: 'layers',
      label: 'Layer',
      icon: <Layers className="w-5 h-5" />,
      active: activeTab === 'layers',
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench className="w-5 h-5" />,
      active:
        activeTab === 'tools' ||
        activeTab === 'utm' ||
        activeTab === 'survey' ||
        activeTab === 'layout',
    },
    {
      id: 'home',
      label: 'Menu',
      icon: <Menu className="w-5 h-5" />,
      active: activeTab === 'home',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB] text-slate-900 pb-16">
      <main className="flex-1">
        {activeTab === 'home' && (
          <HomeMenuView
            onNavigate={handleHomeNavigate}
            onExportProject={handleExportProjectBundle}
            onExportAndroidPackage={async () => {
              await downloadAndroidGithubZip();
              showToast('Paket GitHub & Android Studio (.zip) berhasil diunduh.');
            }}
            waypointCount={waypoints.length}
            layerCount={layers.length}
          />
        )}

        {activeTab === 'map' && (
          <GeoMapCanvas
            basemap={basemap}
            onChangeBasemap={setBasemap}
            showUtmGrid={showUtmGrid}
            onToggleUtmGrid={() => setShowUtmGrid((v) => !v)}
            waypoints={waypoints}
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectActiveLayer={setActiveLayerId}
            onAddLayersBatch={handleAddLayersBatch}
            onToggleLayerVisibility={handleToggleLayerVisibility}
            onToggleAllLayers={handleToggleAllLayers}
            onMoveLayer={handleMoveLayer}
            onDeleteLayer={handleDeleteLayer}
            toolMode={toolMode}
            onChangeToolMode={setToolMode}
            onAddWaypoint={handleAddWaypointFromMap}
            onSaveDigitizedFeature={handleSaveDigitizedFeature}
            onCreateBufferAt={handleCreateBufferAt}
            onUpdateLayerColor={(id, color) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, color } : l))
              );
              showToast(`Warna layer diperbarui (${color.toUpperCase()}).`);
            }}
            onUpdateLayerOpacity={(id, opacity) =>
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, opacity } : l))
              )
            }
            onUpdateLayerSymbology={handleUpdateLayerSymbology}
            onUpdateFeatureProperties={handleUpdateFeatureProperties}
            onDeleteLayerFeature={handleDeleteLayerFeature}
            onOpenLayerAttributes={(layerId) => {
              setLayersInitialSubTab('vektor');
              setInspectedLayerIdFromMap(layerId);
              setActiveTab('layers');
            }}
            flyToTarget={flyToTarget}
            fitBoundsTarget={fitBoundsTarget}
            onSnapshotCaptured={(dataUrl, centerLat, centerLon, zoom) =>
              setMapSnapshot({ dataUrl, centerLat, centerLon, zoom })
            }
            onRequestGpsFix={handleRequestGpsFix}
            gpsPosition={gpsPosition}
            gpsPermissionState={gpsPermissionState}
            gpsError={gpsError}
            isLocatingGps={isLocatingGps}
            trackPoints={trackPoints}
            isTrackingGps={isTrackingGps}
            onToggleTracking={handleToggleTracking}
            onSaveTrackToLayer={handleSaveTrackToLayer}
            onUpdateWaypoint={handleUpdateWaypoint}
            onOpenMenu={() => setActiveTab('home')}
            onOpenLayout={() => setActiveTab('layout')}
          />
        )}

        {activeTab === 'layers' && (
          <DataLayersView
            key={`${layersInitialSubTab}-${inspectedLayerIdFromMap ?? 'none'}`}
            onBack={() => setActiveTab('home')}
            basemap={basemap}
            onChangeBasemap={setBasemap}
            project={project}
            onUpdateProject={setProject}
            layers={layers}
            activeLayerId={activeLayerId}
            onSelectActiveLayer={setActiveLayerId}
            onAddLayersBatch={handleAddLayersBatch}
            onToggleLayerVisibility={handleToggleLayerVisibility}
            onToggleAllLayers={handleToggleAllLayers}
            onUpdateLayerOpacity={(id, opacity) =>
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, opacity } : l))
              )
            }
            onUpdateLayerColor={(id, color) =>
              setLayers((prev) =>
                prev.map((l) => (l.id === id ? { ...l, color } : l))
              )
            }
            onUpdateLayerSymbology={handleUpdateLayerSymbology}
            onUpdateFeatureProperties={handleUpdateFeatureProperties}
            onDeleteLayerFeature={handleDeleteLayerFeature}
            onMoveLayer={handleMoveLayer}
            onDeleteLayer={handleDeleteLayer}
            onZoomToLayer={handleZoomToLayer}
            onZoomToFeature={handleZoomToFeature}
            onLoadSampleIndonesiaData={handleLoadSampleIndonesiaData}
            initialSubTab={layersInitialSubTab}
            initialInspectedLayerId={inspectedLayerIdFromMap}
          />
        )}

        {activeTab === 'tools' && (
          <AnalysisToolsView
            onBack={() => setActiveTab('home')}
            onStartMapTool={(mode) => {
              setToolMode(mode);
              setActiveTab('map');
            }}
            onOpenUtm={() => setActiveTab('utm')}
            onOpenSurvey={() => setActiveTab('survey')}
            onOpenLayout={() => setActiveTab('layout')}
            waypoints={waypoints}
            layers={layers}
            onCreateBufferAt={handleCreateBufferAt}
            onAddSpatialSelectionLayer={(name, data, color) => {
              const newLayer: GeoLayer = {
                id: `layer-select-${Date.now()}`,
                name,
                sourceFormat: 'Seleksi Spasial',
                visible: true,
                opacity: 0.9,
                color: color ?? '#7C3AED',
                createdAt: new Date().toISOString(),
                data,
              };
              setLayers((prev) => [newLayer, ...prev]);
              setActiveTab('map');
              showToast(`Hasil seleksi spasial (${data.features.length} fitur) ditambahkan.`);
            }}
            onRepairLayerGeometry={(layerId, repairedData) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === layerId ? { ...l, data: repairedData } : l))
              );
              showToast('Topologi geometri layer berhasil diperbaiki.');
            }}
          />
        )}

        {activeTab === 'utm' && (
          <UtmCoordinatesView
            onBack={() => setActiveTab('tools')}
            onFocusMapAt={handleFocusMapAt}
          />
        )}

        {activeTab === 'survey' && (
          <SurveyGpsView
            onBack={() => setActiveTab('tools')}
            waypoints={waypoints}
            onAddWaypoint={handleAddWaypointFromForm}
            onUpdateWaypoint={handleUpdateWaypoint}
            onDeleteWaypoint={(id) =>
              setWaypoints((prev) => prev.filter((wp) => wp.id !== id))
            }
            onFocusMapAt={handleFocusMapAt}
            onCreateBufferAt={handleCreateBufferAt}
            gpsPosition={gpsPosition}
            gpsPermissionState={gpsPermissionState}
            gpsError={gpsError}
            isLocatingGps={isLocatingGps}
            isTrackingGps={isTrackingGps}
            trackPoints={trackPoints}
            onRequestGpsFix={handleRequestGpsFix}
            onToggleTracking={handleToggleTracking}
            onSaveTrackToLayer={handleSaveTrackToLayer}
            onClearTrack={handleClearTrack}
          />
        )}

        {activeTab === 'layout' && (
          <MapLayoutView
            onBack={() => setActiveTab('tools')}
            project={project}
            layers={layers}
            waypoints={waypoints}
            mapSnapshot={mapSnapshot}
            onGoToMap={() => setActiveTab('map')}
          />
        )}
      </main>

      {/* Fixed Bright 4-Tab Bottom Navigation Bar matching Screen 2 */}
      <nav
        aria-label="Navigasi Utama"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-4 items-center no-print"
      >
        {bottomNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.id === 'layers') {
                setLayersInitialSubTab('semua');
                setInspectedLayerIdFromMap(null);
              }
              setActiveTab(item.id);
            }}
            className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${
              item.active
                ? 'text-[#0F5EC4] font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {item.icon}
            <span className="text-[11px] leading-none whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Non-blocking status toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg no-print"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

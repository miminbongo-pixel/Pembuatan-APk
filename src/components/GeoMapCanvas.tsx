import React, { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  GeoJSONSource,
  MapMouseEvent,
  ErrorEvent as MapErrorEvent,
  setWorkerUrl,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Feature, FeatureCollection } from 'geojson';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Check,
  CircleDot,
  Compass,
  Crosshair,
  Edit3,
  Eye,
  EyeOff,
  FileUp,
  Globe,
  Layers,
  LocateFixed,
  Magnet,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Menu,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Ruler,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Table2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  BASEMAP_CATALOG,
  BasemapSource,
  buildBasemapStyle,
  MAP_LIBRE_CONFIG,
  OFFLINE_FALLBACK_STYLE,
} from '../core/map/basemapCatalog';
import {
  epsgFor,
  formatUtmZoneLabel,
  latLonToUtm,
} from '../core/coordinates/indonesiaUtmZones';
import {
  GeoLayer,
  LayerSymbology,
  LineDashStyle,
  MapToolMode,
  PointSymbolShape,
} from '../core/project/projectDefinition';
import {
  buildIndonesiaUtmGridGeoJson,
  compassDirectionId,
  computeFeatureCollectionBounds,
  computeSingleFeatureBounds,
  extractVerticesFromFeatureCollection,
  findNearestVertex,
  formatArea,
  formatDistance,
  initialBearingDegrees,
  LngLatTuple,
  normalizeLayerSymbology,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
  polylineDistanceMeters,
} from '../core/spatial/geodesy';
import {
  importVectorFile,
  SurveyWaypoint,
  waypointsToGeoJson,
} from '../core/vector/waypointExporter';
import { SlippyMapCanvas } from './SlippyMapCanvas';

interface GeoMapCanvasProps {
  basemap: BasemapSource;
  onChangeBasemap: (source: BasemapSource) => void;
  showUtmGrid: boolean;
  onToggleUtmGrid: () => void;
  waypoints: SurveyWaypoint[];
  layers: GeoLayer[];
  activeLayerId: string | null;
  onSelectActiveLayer: (id: string | null) => void;
  onAddLayersBatch: (newLayers: GeoLayer[]) => void;
  onToggleLayerVisibility: (id: string) => void;
  onToggleAllLayers: (visible: boolean) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
  toolMode: MapToolMode;
  onChangeToolMode: (mode: MapToolMode) => void;
  onAddWaypoint: (lat: number, lon: number, label?: string) => void;
  onSaveDigitizedFeature: (
    type: 'LineString' | 'Polygon',
    coordinates: LngLatTuple[],
    metrics: Record<string, string | number>,
    customName?: string
  ) => void;
  onCreateBufferAt: (lon: number, lat: number, radiusMeters: number, label: string) => void;
  onUpdateLayerColor: (id: string, color: string) => void;
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
  onUpdateLayerSymbology: (id: string, symbology: LayerSymbology) => void;
  onUpdateFeatureProperties: (
    layerId: string,
    featureIndex: number,
    updatedProps: Record<string, unknown>
  ) => void;
  onDeleteLayerFeature: (layerId: string, featureIndex: number) => void;
  onOpenLayerAttributes: (layerId: string) => void;
  flyToTarget: { lat: number; lon: number; zoom?: number; nonce: number } | null;
  fitBoundsTarget: { bounds: [[number, number], [number, number]]; maxZoom?: number; nonce: number } | null;
  onSnapshotCaptured: (dataUrl: string, centerLat: number, centerLon: number, zoom: number) => void;
  onRequestGpsFix: () => void;
  gpsPosition: {
    lat: number;
    lon: number;
    accuracy: number | null;
    altitude?: number | null;
    timestamp?: string;
  } | null;
  gpsPermissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
  gpsError: string | null;
  isLocatingGps: boolean;
  trackPoints: LngLatTuple[];
  isTrackingGps: boolean;
  onToggleTracking: () => void;
  onSaveTrackToLayer: () => void;
  onUpdateWaypoint: (
    id: string,
    updates: Partial<Omit<SurveyWaypoint, 'id' | 'recordedAt'>>
  ) => void;
  onOpenMenu: () => void;
  onOpenLayout: () => void;
}

interface SelectedFeatureInfo {
  layerId: string | null;
  featureIndex?: number;
  layerName: string;
  geometryType: string;
  properties: Record<string, unknown>;
  lon: number;
  lat: number;
}

const INSPECTOR_COLOR_SWATCHES = [
  '#0F5EC4',
  '#16A34A',
  '#EF4444',
  '#D97706',
  '#7C3AED',
  '#0F766E',
];

function ensureSymbolImages(map: MapLibreMap) {
  const shapes: ('square' | 'triangle' | 'diamond')[] = ['square', 'triangle', 'diamond'];
  const size = 48;
  shapes.forEach((shape) => {
    const id = `dhy-shape-${shape}`;
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    if (shape === 'square') {
      ctx.rect(8, 8, size - 16, size - 16);
    } else if (shape === 'triangle') {
      ctx.moveTo(size / 2, 6);
      ctx.lineTo(size - 6, size - 8);
      ctx.lineTo(6, size - 8);
      ctx.closePath();
    } else {
      ctx.moveTo(size / 2, 5);
      ctx.lineTo(size - 5, size / 2);
      ctx.lineTo(size / 2, size - 5);
      ctx.lineTo(5, size / 2);
      ctx.closePath();
    }
    ctx.fill();
    const imageData = ctx.getImageData(0, 0, size, size);
    map.addImage(id, imageData, { sdf: true });
  });
}

function getLineDashArray(dash: LineDashStyle): number[] | undefined {
  if (dash === 'dashed') return [4, 2.5];
  if (dash === 'dotted') return [1, 2];
  return undefined;
}

function normalizeBearingDeg(deg: number): number {
  const mod = ((deg % 360) + 360) % 360;
  return Number(mod.toFixed(1));
}

function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function formatScaleMetric(lat: number, zoom: number): {
  ratioText: string;
  barLabel: string;
  barHalfLabel: string;
  barWidthPx: number;
} {
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  const scaleDenominator = Math.max(500, Math.round(metersPerPixel * 3779.527559));
  const roundedDenom =
    scaleDenominator > 10000
      ? Math.round(scaleDenominator / 1000) * 1000
      : Math.round(scaleDenominator / 100) * 100;

  const targetMeters = metersPerPixel * 110;
  const steps = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const chosen = steps.find((s) => s >= targetMeters) ?? steps[steps.length - 1];
  const barWidthPx = Math.max(72, Math.min(130, Math.round(chosen / metersPerPixel)));

  const barLabel = chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`;
  const half = chosen / 2;
  const barHalfLabel = chosen >= 1000 ? `${half / 1000}` : `${half}`;

  return {
    ratioText: `1 : ${roundedDenom.toLocaleString('id-ID')}`,
    barLabel,
    barHalfLabel,
    barWidthPx,
  };
}

export const GeoMapCanvas: React.FC<GeoMapCanvasProps> = ({
  basemap,
  onChangeBasemap,
  showUtmGrid,
  onToggleUtmGrid,
  waypoints,
  layers,
  activeLayerId,
  onSelectActiveLayer,
  onAddLayersBatch,
  onToggleLayerVisibility,
  onToggleAllLayers,
  onMoveLayer,
  onDeleteLayer,
  toolMode,
  onChangeToolMode,
  onAddWaypoint,
  onSaveDigitizedFeature,
  onCreateBufferAt,
  onUpdateLayerColor,
  onUpdateLayerOpacity,
  onUpdateLayerSymbology,
  onUpdateFeatureProperties,
  onDeleteLayerFeature,
  onOpenLayerAttributes,
  flyToTarget,
  fitBoundsTarget,
  onSnapshotCaptured,
  onRequestGpsFix,
  gpsPosition,
  gpsPermissionState,
  gpsError,
  isLocatingGps,
  trackPoints,
  isTrackingGps,
  onToggleTracking,
  onSaveTrackToLayer,
  onUpdateWaypoint,
  onOpenMenu,
  onOpenLayout,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const quickImportInputRef = useRef<HTMLInputElement | null>(null);
  const styleLoadedRef = useRef(false);
  const offlineFallbackActiveRef = useRef(false);

  const [useCanvasFallback, setUseCanvasFallback] = useState<boolean>(() => !isWebGL2Available());
  const [fallbackView, setFallbackView] = useState<{ lat: number; lon: number; zoom: number }>({
    lat: -5.1478,
    lon: 119.4321,
    zoom: 7.2,
  });

  const [cursorCoords, setCursorCoords] = useState<{
    lat: number;
    lon: number;
    zoom: number;
    bearing: number;
    sourceStatus: string;
  }>({
    lat: -5.1478,
    lon: 119.4321,
    zoom: 7.2,
    bearing: 0,
    sourceStatus: `${basemap.displayName} aktif`,
  });

  const [compassSensorActive, setCompassSensorActive] = useState(false);
  const [compassStatusNote, setCompassStatusNote] = useState<string | null>(null);
  const [draftVertices, setDraftVertices] = useState<LngLatTuple[]>([]);
  const [draftFeatureName, setDraftFeatureName] = useState('');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [hoveredSnapVertex, setHoveredSnapVertex] = useState<LngLatTuple | null>(null);

  const [selectedFeature, setSelectedFeature] = useState<SelectedFeatureInfo | null>(null);
  const [isEditingAttrs, setIsEditingAttrs] = useState(false);
  const [draftAttrs, setDraftAttrs] = useState<Record<string, string>>({});
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');

  const [isEditingWp, setIsEditingWp] = useState(false);
  const [wpDraftLabel, setWpDraftLabel] = useState('');
  const [wpDraftCategory, setWpDraftCategory] = useState('Survei');
  const [wpDraftLat, setWpDraftLat] = useState('');
  const [wpDraftLon, setWpDraftLon] = useState('');
  const [wpDraftElev, setWpDraftElev] = useState('');
  const [wpDraftNote, setWpDraftNote] = useState('');
  const [dismissedPermBanner, setDismissedPermBanner] = useState(false);
  const [showWgs84Panel, setShowWgs84Panel] = useState(true);
  const [showMeasureCard, setShowMeasureCard] = useState(true);

  const [bufferRadiusM, setBufferRadiusM] = useState<number>(500);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showBasemapPicker, setShowBasemapPicker] = useState(false);
  const [showQuickLayerDrawer, setShowQuickLayerDrawer] = useState(false);
  const [expandedStyleLayerId, setExpandedStyleLayerId] = useState<string | null>(null);
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const [batchImportMsg, setBatchImportMsg] = useState<string | null>(null);
  const [quickJumpInput, setQuickJumpInput] = useState('');
  const [jumpError, setJumpError] = useState<string | null>(null);

  const toolModeRef = useRef(toolMode);
  toolModeRef.current = toolMode;

  const layersRef = useRef(layers);
  layersRef.current = layers;

  const activeLayerIdRef = useRef(activeLayerId);
  activeLayerIdRef.current = activeLayerId;

  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

  const showUtmGridRef = useRef(showUtmGrid);
  showUtmGridRef.current = showUtmGrid;

  const draftVerticesRef = useRef(draftVertices);
  draftVerticesRef.current = draftVertices;

  const snapEnabledRef = useRef(snapEnabled);
  snapEnabledRef.current = snapEnabled;

  const hoveredSnapRef = useRef(hoveredSnapVertex);
  hoveredSnapRef.current = hoveredSnapVertex;

  const gpsPositionRef = useRef(gpsPosition);
  gpsPositionRef.current = gpsPosition;

  const trackPointsRef = useRef(trackPoints);
  trackPointsRef.current = trackPoints;

  const onAddWaypointRef = useRef(onAddWaypoint);
  onAddWaypointRef.current = onAddWaypoint;

  const findSnappedCoord = (rawLon: number, rawLat: number, zoomLevel: number): LngLatTuple | null => {
    if (!snapEnabledRef.current) return null;
    const allLists: LngLatTuple[][] = [
      waypointsRef.current.map((w) => [w.longitude, w.latitude]),
      draftVerticesRef.current,
      ...layersRef.current
        .filter((l) => l.visible)
        .map((l) => extractVerticesFromFeatureCollection(l.data)),
    ];
    const thresholdDeg = Math.min(0.25, Math.max(0.00018, 18 / (Math.pow(2, zoomLevel) * 0.7)));
    return findNearestVertex([rawLon, rawLat], allLists, thresholdDeg);
  };

  const syncMapOverlays = (map: MapLibreMap) => {
    if (!styleLoadedRef.current) return;

    ensureSymbolImages(map);

    // 1. UTM Grid Overlay
    const utmGridData = buildIndonesiaUtmGridGeoJson();
    const utmSourceId = 'geoexplorer-utm-grid';
    if (!map.getSource(utmSourceId)) {
      map.addSource(utmSourceId, { type: 'geojson', data: utmGridData });
      map.addLayer({
        id: 'geoexplorer-utm-lines',
        type: 'line',
        source: utmSourceId,
        filter: ['!=', ['get', 'kind'], 'zone-label'],
        paint: {
          'line-color': ['case', ['==', ['get', 'kind'], 'equator'], '#F59E0B', '#38BDF8'],
          'line-width': ['case', ['==', ['get', 'kind'], 'equator'], 1.8, 1],
          'line-dasharray': [4, 3],
          'line-opacity': 0.78,
        },
        layout: {
          visibility: showUtmGridRef.current ? 'visible' : 'none',
        },
      });
      map.addLayer({
        id: 'geoexplorer-utm-labels',
        type: 'symbol',
        source: utmSourceId,
        filter: ['==', ['get', 'kind'], 'zone-label'],
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-allow-overlap': true,
          visibility: showUtmGridRef.current ? 'visible' : 'none',
        },
        paint: {
          'text-color': '#0F5EC4',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.8,
        },
      });
    } else {
      const vis = showUtmGridRef.current ? 'visible' : 'none';
      if (map.getLayer('geoexplorer-utm-lines')) {
        map.setLayoutProperty('geoexplorer-utm-lines', 'visibility', vis);
      }
      if (map.getLayer('geoexplorer-utm-labels')) {
        map.setLayoutProperty('geoexplorer-utm-labels', 'visibility', vis);
      }
    }

    // 2. Imported & Digitized User Vector Layers
    const activeIds = new Set(layersRef.current.map((l) => l.id));
    const existingStyleLayers = map.getStyle()?.layers ?? [];
    existingStyleLayers.forEach((sl) => {
      if (sl.id.startsWith('user-layer-')) {
        const layerId = sl.id.replace(/^user-layer-(fill|line|point|label)-/, '');
        if (!activeIds.has(layerId)) {
          if (map.getLayer(sl.id)) map.removeLayer(sl.id);
        }
      }
    });

    [...layersRef.current].reverse().forEach((layer) => {
      const srcId = `user-src-${layer.id}`;
      const existingSrc = map.getSource(srcId) as GeoJSONSource | undefined;
      if (!existingSrc) {
        map.addSource(srcId, { type: 'geojson', data: layer.data, generateId: true });
      } else {
        existingSrc.setData(layer.data);
      }

      const vis = layer.visible ? 'visible' : 'none';
      const sym = normalizeLayerSymbology(layer);
      const isActive = layer.id === activeLayerIdRef.current;
      const fillId = `user-layer-fill-${layer.id}`;
      const lineId = `user-layer-line-${layer.id}`;
      const pointId = `user-layer-point-${layer.id}`;

      if (!map.getLayer(fillId)) {
        map.addLayer({
          id: fillId,
          type: 'fill',
          source: srcId,
          filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
          paint: {
            'fill-color': layer.color,
            'fill-opacity': Math.max(0.08, layer.opacity * 0.35),
          },
          layout: { visibility: vis },
        });
      } else {
        map.setPaintProperty(fillId, 'fill-color', layer.color);
        map.setPaintProperty(fillId, 'fill-opacity', Math.max(0.08, layer.opacity * 0.35));
        map.setLayoutProperty(fillId, 'visibility', vis);
      }

      const dashArr = getLineDashArray(sym.lineDash);
      const effectiveLineWidth = isActive ? sym.lineWidth + 0.8 : sym.lineWidth;
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: 'line',
          source: srcId,
          filter: [
            'in',
            ['geometry-type'],
            ['literal', ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']],
          ],
          paint: {
            'line-color': layer.color,
            'line-width': effectiveLineWidth,
            'line-opacity': layer.opacity,
            ...(dashArr ? { 'line-dasharray': dashArr } : {}),
          },
          layout: { visibility: vis },
        });
      } else {
        map.setPaintProperty(lineId, 'line-color', layer.color);
        map.setPaintProperty(lineId, 'line-width', effectiveLineWidth);
        map.setPaintProperty(lineId, 'line-opacity', layer.opacity);
        map.setPaintProperty(lineId, 'line-dasharray', dashArr as never);
        map.setLayoutProperty(lineId, 'visibility', vis);
      }

      const desiredPointType = sym.pointShape === 'circle' ? 'circle' : 'symbol';
      const existingPointLayer = map.getLayer(pointId);
      if (existingPointLayer && existingPointLayer.type !== desiredPointType) {
        map.removeLayer(pointId);
      }

      if (!map.getLayer(pointId)) {
        if (desiredPointType === 'circle') {
          map.addLayer({
            id: pointId,
            type: 'circle',
            source: srcId,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            paint: {
              'circle-radius': sym.pointSize,
              'circle-color': layer.color,
              'circle-stroke-color': isActive ? '#F59E0B' : '#FFFFFF',
              'circle-stroke-width': isActive ? 2.6 : 2,
              'circle-opacity': layer.opacity,
            },
            layout: { visibility: vis },
          });
        } else {
          map.addLayer({
            id: pointId,
            type: 'symbol',
            source: srcId,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            layout: {
              'icon-image': `dhy-shape-${sym.pointShape}`,
              'icon-size': Math.max(0.28, sym.pointSize / 14),
              'icon-allow-overlap': true,
              visibility: vis,
            },
            paint: {
              'icon-color': layer.color,
              'icon-halo-color': isActive ? '#F59E0B' : '#FFFFFF',
              'icon-halo-width': isActive ? 2.2 : 1.5,
              'icon-opacity': layer.opacity,
            },
          });
        }
      } else if (desiredPointType === 'circle') {
        map.setPaintProperty(pointId, 'circle-radius', sym.pointSize);
        map.setPaintProperty(pointId, 'circle-color', layer.color);
        map.setPaintProperty(pointId, 'circle-stroke-color', isActive ? '#F59E0B' : '#FFFFFF');
        map.setPaintProperty(pointId, 'circle-stroke-width', isActive ? 2.6 : 2);
        map.setPaintProperty(pointId, 'circle-opacity', layer.opacity);
        map.setLayoutProperty(pointId, 'visibility', vis);
      } else {
        map.setLayoutProperty(pointId, 'icon-image', `dhy-shape-${sym.pointShape}`);
        map.setLayoutProperty(pointId, 'icon-size', Math.max(0.28, sym.pointSize / 14));
        map.setPaintProperty(pointId, 'icon-color', layer.color);
        map.setPaintProperty(pointId, 'icon-halo-color', isActive ? '#F59E0B' : '#FFFFFF');
        map.setPaintProperty(pointId, 'icon-halo-width', isActive ? 2.2 : 1.5);
        map.setPaintProperty(pointId, 'icon-opacity', layer.opacity);
        map.setLayoutProperty(pointId, 'visibility', vis);
      }
    });

    // 3. Survey Waypoints
    const wpData = waypointsToGeoJson(waypointsRef.current);
    const wpSrcId = 'geoexplorer-waypoints';
    const existingWpSrc = map.getSource(wpSrcId) as GeoJSONSource | undefined;
    if (!existingWpSrc) {
      map.addSource(wpSrcId, { type: 'geojson', data: wpData });
      map.addLayer({
        id: 'geoexplorer-waypoints-circle',
        type: 'circle',
        source: wpSrcId,
        paint: {
          'circle-radius': 7.5,
          'circle-color': '#DC2626',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2.2,
        },
      });
      map.addLayer({
        id: 'geoexplorer-waypoints-label',
        type: 'symbol',
        source: wpSrcId,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#0F172A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.8,
        },
      });
    } else {
      existingWpSrc.setData(wpData);
    }

    // Enforce exact MapLibre Z-Order matching layers[] order (bottom-to-top below waypoints)
    const waypointAnchor = map.getLayer('geoexplorer-waypoints-circle')
      ? 'geoexplorer-waypoints-circle'
      : undefined;
    [...layersRef.current].reverse().forEach((layer) => {
      const fillId = `user-layer-fill-${layer.id}`;
      const lineId = `user-layer-line-${layer.id}`;
      const pointId = `user-layer-point-${layer.id}`;
      if (map.getLayer(fillId)) map.moveLayer(fillId, waypointAnchor);
      if (map.getLayer(lineId)) map.moveLayer(lineId, waypointAnchor);
      if (map.getLayer(pointId)) map.moveLayer(pointId, waypointAnchor);
    });

    // 4. Live GPS Position Marker
    const gpsFc: FeatureCollection = gpsPositionRef.current
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { label: 'Posisi GNSS' },
              geometry: {
                type: 'Point',
                coordinates: [gpsPositionRef.current.lon, gpsPositionRef.current.lat],
              },
            },
          ],
        }
      : { type: 'FeatureCollection', features: [] };
    const gpsSrcId = 'geoexplorer-gps';
    const existingGps = map.getSource(gpsSrcId) as GeoJSONSource | undefined;
    if (!existingGps) {
      map.addSource(gpsSrcId, { type: 'geojson', data: gpsFc });
      map.addLayer({
        id: 'geoexplorer-gps-halo',
        type: 'circle',
        source: gpsSrcId,
        paint: {
          'circle-radius': 15,
          'circle-color': '#0F5EC4',
          'circle-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'geoexplorer-gps-dot',
        type: 'circle',
        source: gpsSrcId,
        paint: {
          'circle-radius': 6.5,
          'circle-color': '#0F5EC4',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2.2,
        },
      });
    } else {
      existingGps.setData(gpsFc);
    }

    // 4b. Live Track Recording Polyline
    const trkPts = trackPointsRef.current;
    const trackFc: FeatureCollection =
      trkPts.length >= 2
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { tipe: 'live-track' },
                geometry: { type: 'LineString', coordinates: trkPts },
              },
            ],
          }
        : { type: 'FeatureCollection', features: [] };
    const trackSrcId = 'geoexplorer-live-track';
    const existingTrack = map.getSource(trackSrcId) as GeoJSONSource | undefined;
    if (!existingTrack) {
      map.addSource(trackSrcId, { type: 'geojson', data: trackFc });
      map.addLayer({
        id: 'geoexplorer-live-track-line',
        type: 'line',
        source: trackSrcId,
        paint: {
          'line-color': '#7C3AED',
          'line-width': 3.5,
          'line-opacity': 0.92,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    } else {
      existingTrack.setData(trackFc);
    }

    // 5. Draft Digitizing / Measurement Geometry
    const verts = draftVerticesRef.current;
    const draftFeatures: Feature[] = [];
    verts.forEach((coord, index) => {
      draftFeatures.push({
        type: 'Feature',
        properties: { index: index + 1 },
        geometry: { type: 'Point', coordinates: coord },
      });
    });

    if (verts.length >= 2) {
      if (
        (toolModeRef.current === 'digitize-polygon' || toolModeRef.current === 'measure-area') &&
        verts.length >= 3
      ) {
        draftFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[...verts, verts[0]]],
          },
        });
      } else {
        draftFeatures.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: verts,
          },
        });
      }
    }

    const snapPt = hoveredSnapRef.current;
    if (snapPt) {
      draftFeatures.push({
        type: 'Feature',
        properties: { snap: true },
        geometry: { type: 'Point', coordinates: snapPt },
      });
    }

    const draftFc: FeatureCollection = { type: 'FeatureCollection', features: draftFeatures };
    const draftSrcId = 'geoexplorer-draft';
    const existingDraft = map.getSource(draftSrcId) as GeoJSONSource | undefined;
    if (!existingDraft) {
      map.addSource(draftSrcId, { type: 'geojson', data: draftFc });
      map.addLayer({
        id: 'geoexplorer-draft-fill',
        type: 'fill',
        source: draftSrcId,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#F59E0B',
          'fill-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'geoexplorer-draft-line',
        type: 'line',
        source: draftSrcId,
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        paint: {
          'line-color': '#F59E0B',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'geoexplorer-draft-pts',
        type: 'circle',
        source: draftSrcId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['==', ['get', 'snap'], true], 8, 5.5],
          'circle-color': ['case', ['==', ['get', 'snap'], true], '#06B6D4', '#F59E0B'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    } else {
      existingDraft.setData(draftFc);
    }
  };

  useEffect(() => {
    if (useCanvasFallback || !containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      setWorkerUrl(new URL(maplibreWorkerUrl, window.location.href).href);
      map = new MapLibreMap({
        container: containerRef.current,
        style: buildBasemapStyle(basemap),
        center: [119.4321, -5.1478],
        zoom: 7.2,
        canvasContextAttributes: { preserveDrawingBuffer: true },
        attributionControl: false,
      });
    } catch {
      // Gracefully switch to 2D Slippy Tile Canvas when WebGL2 initialization fails
      setUseCanvasFallback(true);
      return;
    }

    mapRef.current = map;

    map.on('style.load', () => {
      styleLoadedRef.current = true;
      syncMapOverlays(map);
      const center = map.getCenter();
      setCursorCoords({
        lat: center.lat,
        lon: center.lng,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        sourceStatus: offlineFallbackActiveRef.current
          ? 'Kanvas offline MapLibre'
          : `${basemap.displayName} aktif`,
      });
      try {
        const snapshot = map.getCanvas().toDataURL('image/png');
        onSnapshotCaptured(snapshot, center.lat, center.lng, map.getZoom());
      } catch {
        // Ignore CORS tainted canvas
      }
    });

    map.on('error', (e: MapErrorEvent) => {
      const msg = e.error?.message?.toLowerCase() ?? '';
      if (msg.includes('worker')) {
        setUseCanvasFallback(true);
        return;
      }
      if (e.error && !styleLoadedRef.current && !offlineFallbackActiveRef.current) {
        offlineFallbackActiveRef.current = true;
        map.setStyle(OFFLINE_FALLBACK_STYLE);
      }
    });

    map.on('mousemove', (e: MapMouseEvent) => {
      const z = map.getZoom();
      setCursorCoords((prev) => ({
        ...prev,
        lat: e.lngLat.lat,
        lon: e.lngLat.lng,
        zoom: z,
        bearing: map.getBearing(),
      }));
      const mode = toolModeRef.current;
      if (
        mode === 'digitize-line' ||
        mode === 'digitize-polygon' ||
        mode === 'measure-distance' ||
        mode === 'measure-area'
      ) {
        setHoveredSnapVertex(findSnappedCoord(e.lngLat.lng, e.lngLat.lat, z));
      } else if (hoveredSnapRef.current !== null) {
        setHoveredSnapVertex(null);
      }
    });

    map.on('rotate', () => {
      setCursorCoords((prev) => ({
        ...prev,
        bearing: map.getBearing(),
      }));
    });

    map.on('moveend', () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      setCursorCoords((prev) => ({
        ...prev,
        lat: center.lat,
        lon: center.lng,
        zoom,
        bearing: map.getBearing(),
      }));
      try {
        const snapshot = map.getCanvas().toDataURL('image/png');
        onSnapshotCaptured(snapshot, center.lat, center.lng, zoom);
      } catch {
        // Ignore CORS tainted canvas
      }
    });

    map.on('click', (e: MapMouseEvent) => {
      const mode = toolModeRef.current;
      const z = map.getZoom();
      const snapped =
        mode === 'digitize-line' ||
        mode === 'digitize-polygon' ||
        mode === 'measure-distance' ||
        mode === 'measure-area'
          ? findSnappedCoord(e.lngLat.lng, e.lngLat.lat, z)
          : null;
      const lon = snapped ? Number(snapped[0].toFixed(6)) : Number(e.lngLat.lng.toFixed(6));
      const lat = snapped ? Number(snapped[1].toFixed(6)) : Number(e.lngLat.lat.toFixed(6));

      if (mode === 'add-waypoint') {
        onAddWaypointRef.current(lat, lon);
        return;
      }

      if (
        mode === 'digitize-line' ||
        mode === 'digitize-polygon' ||
        mode === 'measure-distance' ||
        mode === 'measure-area'
      ) {
        setDraftVertices((prev) => [...prev, [lon, lat]]);
        return;
      }

      const interactiveLayerIds = [
        'geoexplorer-waypoints-circle',
        ...layersRef.current.flatMap((l) => [
          `user-layer-point-${l.id}`,
          `user-layer-line-${l.id}`,
          `user-layer-fill-${l.id}`,
        ]),
      ].filter((id) => Boolean(map.getLayer(id)));

      if (interactiveLayerIds.length > 0) {
        const bbox: [[number, number], [number, number]] = [
          [e.point.x - 8, e.point.y - 8],
          [e.point.x + 8, e.point.y + 8],
        ];
        const hits = map.queryRenderedFeatures(bbox, { layers: interactiveLayerIds });
        if (hits.length > 0) {
          // Prioritize points & lines over background polygon fills
          const hit =
            hits.find((h) => h.layer.id === 'geoexplorer-waypoints-circle') ??
            hits.find((h) => h.layer.id.startsWith('user-layer-point-')) ??
            hits.find((h) => h.layer.id.startsWith('user-layer-line-')) ??
            hits[0];

          const isWp = hit.layer.id === 'geoexplorer-waypoints-circle';
          const layerIdMatch = isWp
            ? null
            : hit.layer.id.replace(/^user-layer-(fill|line|point)-/, '');
          const matchedLayer = layerIdMatch
            ? layersRef.current.find((l) => l.id === layerIdMatch)
            : undefined;
          let featureIndex: number | undefined = undefined;
          if (matchedLayer) {
            if (
              typeof hit.id === 'number' &&
              hit.id >= 0 &&
              hit.id < matchedLayer.data.features.length
            ) {
              featureIndex = hit.id;
            } else {
              const hitProps = JSON.stringify(hit.properties ?? {});
              const found = matchedLayer.data.features.findIndex(
                (f) => JSON.stringify(f.properties ?? {}) === hitProps
              );
              if (found >= 0) featureIndex = found;
            }
          }
          setSelectedFeature({
            layerId: matchedLayer?.id ?? null,
            featureIndex,
            layerName: isWp ? 'Titik Survei (Waypoint)' : matchedLayer?.name ?? 'Fitur Vektor',
            geometryType: hit.geometry?.type ?? 'Feature',
            properties: (hit.properties as Record<string, unknown>) ?? {},
            lon,
            lat,
          });
          setIsEditingAttrs(false);
          return;
        }
      }

      setSelectedFeature(null);
      setIsEditingAttrs(false);
      setCursorCoords((prev) => ({
        ...prev,
        lat,
        lon,
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        sourceStatus: 'Titik klik pada peta',
      }));
    });

    return () => {
      styleLoadedRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [useCanvasFallback]);

  useEffect(() => {
    if (useCanvasFallback) return;
    const map = mapRef.current;
    if (!map) return;
    offlineFallbackActiveRef.current = false;
    styleLoadedRef.current = false;
    setCursorCoords((prev) => ({
      ...prev,
      sourceStatus: `Memuat ${basemap.displayName}...`,
    }));
    map.setStyle(buildBasemapStyle(basemap));
  }, [basemap, useCanvasFallback]);

  useEffect(() => {
    if (!useCanvasFallback && mapRef.current && styleLoadedRef.current) {
      syncMapOverlays(mapRef.current);
    }
  }, [
    waypoints,
    layers,
    activeLayerId,
    showUtmGrid,
    draftVertices,
    hoveredSnapVertex,
    toolMode,
    gpsPosition,
    trackPoints,
    useCanvasFallback,
  ]);

  const moveMapTo = (lat: number, lon: number, zoom?: number) => {
    if (useCanvasFallback) {
      const z = zoom ?? fallbackView.zoom;
      setFallbackView({ lat, lon, zoom: z });
      setCursorCoords((prev) => ({ ...prev, lat, lon, zoom: z }));
      return;
    }
    mapRef.current?.flyTo({
      center: [lon, lat],
      zoom: zoom ?? Math.max(mapRef.current.getZoom(), 11),
      duration: 850,
    });
  };

  const fitMapToBounds = (bounds: [[number, number], [number, number]], maxZoom = 16) => {
    const [[minLon, minLat], [maxLon, maxLat]] = bounds;
    if (useCanvasFallback) {
      const centerLat = (minLat + maxLat) / 2;
      const centerLon = (minLon + maxLon) / 2;
      const span = Math.max(Math.abs(maxLon - minLon), Math.abs(maxLat - minLat));
      const estZoom =
        span > 20
          ? 4.2
          : span > 5
            ? 6.5
            : span > 1
              ? 9
              : span > 0.2
                ? 11.5
                : span > 0.04
                  ? 13.5
                  : span > 0.01
                    ? 15
                    : Math.min(maxZoom, 16.5);
      moveMapTo(centerLat, centerLon, estZoom);
      return;
    }
    mapRef.current?.fitBounds(bounds, {
      padding: 52,
      duration: 750,
      maxZoom,
    });
  };

  useEffect(() => {
    if (!flyToTarget) return;
    moveMapTo(flyToTarget.lat, flyToTarget.lon, flyToTarget.zoom);
  }, [flyToTarget]);

  useEffect(() => {
    if (!fitBoundsTarget) return;
    fitMapToBounds(fitBoundsTarget.bounds, fitBoundsTarget.maxZoom ?? 16);
  }, [fitBoundsTarget]);

  useEffect(() => {
    if (toolMode === 'inspect' || toolMode === 'add-waypoint') {
      setDraftVertices([]);
      setHoveredSnapVertex(null);
    } else {
      setShowMeasureCard(true);
    }
  }, [toolMode]);

  const activeEpsg = epsgFor(cursorCoords.lat, cursorCoords.lon);
  const activeZoneLabel = formatUtmZoneLabel(cursorCoords.lat, cursorCoords.lon);
  const activeUtm = latLonToUtm(cursorCoords.lat, cursorCoords.lon);
  const scaleInfo = formatScaleMetric(cursorCoords.lat, cursorCoords.zoom);

  const isLineDraft = toolMode === 'digitize-line' || toolMode === 'measure-distance';
  const isPolyDraft = toolMode === 'digitize-polygon' || toolMode === 'measure-area';

  const draftDistanceM = polylineDistanceMeters(draftVertices);
  const draftLastBearing =
    draftVertices.length >= 2
      ? initialBearingDegrees(
          draftVertices[draftVertices.length - 2],
          draftVertices[draftVertices.length - 1]
        )
      : null;
  const draftAreaSqM = isPolyDraft ? polygonAreaSquareMeters(draftVertices) : 0;
  const draftPerimeterM = isPolyDraft ? polygonPerimeterMeters(draftVertices) : 0;

  const handleSaveDraft = () => {
    const cleanName = draftFeatureName.trim();
    if (isLineDraft && draftVertices.length >= 2) {
      onSaveDigitizedFeature(
        'LineString',
        draftVertices,
        {
          ...(cleanName ? { nama: cleanName } : {}),
          panjang: formatDistance(draftDistanceM),
          panjang_m: Number(draftDistanceM.toFixed(2)),
          azimuth_akhir_deg: draftLastBearing != null ? Number(draftLastBearing.toFixed(1)) : 0,
        },
        cleanName || undefined
      );
      setDraftVertices([]);
      setDraftFeatureName('');
      setHoveredSnapVertex(null);
    } else if (isPolyDraft && draftVertices.length >= 3) {
      onSaveDigitizedFeature(
        'Polygon',
        draftVertices,
        {
          ...(cleanName ? { nama: cleanName } : {}),
          luas: formatArea(draftAreaSqM),
          luas_m2: Number(draftAreaSqM.toFixed(2)),
          keliling: formatDistance(draftPerimeterM),
        },
        cleanName || undefined
      );
      setDraftVertices([]);
      setDraftFeatureName('');
      setHoveredSnapVertex(null);
    }
  };

  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    setJumpError(null);
    const cleaned = quickJumpInput.trim();
    const parts = cleaned.split(/[\s,;]+/).map((p) => Number.parseFloat(p));
    if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
      setJumpError('Format: lat, lon (contoh: -5.1478, 119.4321)');
      return;
    }
    const [lat, lon] = parts;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setJumpError('Koordinat di luar rentang bumi.');
      return;
    }
    moveMapTo(lat, lon, 12);
    setShowSearchBar(false);
  };

  const handleZoomStep = (delta: number) => {
    if (useCanvasFallback) {
      const nextZoom = Math.max(2, Math.min(18, Number((fallbackView.zoom + delta).toFixed(2))));
      setFallbackView((prev) => ({ ...prev, zoom: nextZoom }));
      setCursorCoords((prev) => ({ ...prev, zoom: nextZoom }));
      return;
    }
    if (delta > 0) mapRef.current?.zoomIn({ duration: 250 });
    else mapRef.current?.zoomOut({ duration: 250 });
  };

  useEffect(() => {
    if (!compassSensorActive) return;

    let receivedEvent = false;
    const handleOrientation = (ev: DeviceOrientationEvent) => {
      const webkitHeading = (ev as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      let heading: number | null = null;
      if (typeof webkitHeading === 'number' && Number.isFinite(webkitHeading)) {
        heading = webkitHeading;
      } else if (typeof ev.alpha === 'number' && Number.isFinite(ev.alpha)) {
        heading = (360 - ev.alpha) % 360;
      }
      if (heading === null) return;
      receivedEvent = true;
      setCompassStatusNote(null);
      const normalized = normalizeBearingDeg(heading);
      setCursorCoords((prev) => ({ ...prev, bearing: normalized }));
      if (!useCanvasFallback) {
        mapRef.current?.setBearing(normalized);
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
    window.addEventListener('deviceorientation', handleOrientation);

    const fallbackTimer = window.setTimeout(() => {
      if (!receivedEvent) {
        setCompassStatusNote('Sensor perangkat tidak tersedia; gunakan tombol putar ±15°');
      }
    }, 1500);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [compassSensorActive, useCanvasFallback]);

  const handleToggleCompassSensor = async () => {
    if (compassSensorActive) {
      setCompassSensorActive(false);
      setCompassStatusNote(null);
      return;
    }

    const DevOrient = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
      | undefined;

    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const res = await DevOrient.requestPermission();
        if (res !== 'granted') {
          setCompassStatusNote('Izin sensor orientasi ditolak.');
          return;
        }
      } catch {
        setCompassStatusNote('Sensor orientasi tidak didukung.');
        return;
      }
    }

    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setCompassStatusNote('Perangkat tidak memiliki sensor kompas.');
      return;
    }

    setCompassStatusNote('Membaca sensor kompas...');
    setCompassSensorActive(true);
  };

  const handleRotateBearingStep = (deltaDeg: number) => {
    setCompassSensorActive(false);
    setCompassStatusNote(null);
    const nextBearing = normalizeBearingDeg(cursorCoords.bearing + deltaDeg);
    setCursorCoords((prev) => ({ ...prev, bearing: nextBearing }));
    if (!useCanvasFallback) {
      mapRef.current?.easeTo({ bearing: nextBearing, duration: 220 });
    }
  };

  const handleResetNorthAndCenter = () => {
    setCompassSensorActive(false);
    setCompassStatusNote(null);
    setCursorCoords((prev) => ({ ...prev, bearing: 0 }));
    if (useCanvasFallback) return;
    mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 300 });
  };

  const handleCaptureToLayout = () => {
    if (useCanvasFallback) {
      const canvas = containerRef.current?.querySelector('canvas');
      if (canvas) {
        try {
          onSnapshotCaptured(
            canvas.toDataURL('image/png'),
            fallbackView.lat,
            fallbackView.lon,
            fallbackView.zoom
          );
        } catch {
          // Ignore tainted canvas
        }
      }
      onOpenLayout();
      return;
    }
    const map = mapRef.current;
    if (map) {
      const c = map.getCenter();
      try {
        const dataUrl = map.getCanvas().toDataURL('image/png');
        onSnapshotCaptured(dataUrl, c.lat, c.lng, map.getZoom());
      } catch {
        // Ignore tainted canvas
      }
    }
    onOpenLayout();
  };

  const handleZoomToAllData = () => {
    const allFeatures = [
      ...waypointsToGeoJson(waypoints).features,
      ...layers.filter((l) => l.visible).flatMap((l) => l.data.features),
    ];
    const bounds = computeFeatureCollectionBounds({
      type: 'FeatureCollection',
      features: allFeatures,
    });
    if (!bounds) return;
    fitMapToBounds(bounds, 15.5);
  };

  const handleQuickBatchImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsImportingBatch(true);
    setBatchImportMsg(null);
    const palette = ['#0F5EC4', '#16A34A', '#D97706', '#0F766E', '#7C3AED', '#DC2626'];
    const imported: GeoLayer[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const result = await importVectorFile(files[i]);
        imported.push({
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
      onAddLayersBatch(imported);
      const combinedBounds = computeFeatureCollectionBounds({
        type: 'FeatureCollection',
        features: imported.flatMap((l) => l.data.features),
      });
      if (combinedBounds) {
        fitMapToBounds(combinedBounds, 15.5);
      }
      setBatchImportMsg(`${imported.length} layer berhasil ditambahkan.`);
    } catch (err) {
      setBatchImportMsg(err instanceof Error ? err.message : 'Gagal membaca berkas vektor.');
    } finally {
      setIsImportingBatch(false);
      if (quickImportInputRef.current) {
        quickImportInputRef.current.value = '';
      }
    }
  };

  const isSatelliteMode = basemap.category === 'satellite' || basemap.category === 'hybrid';
  const defaultSatelliteBasemap =
    BASEMAP_CATALOG.find((b) => b.id === 'esri-satellite') ?? BASEMAP_CATALOG[0];
  const defaultStreetBasemap =
    BASEMAP_CATALOG.find((b) => b.id === 'google-roadmap') ?? BASEMAP_CATALOG[3];

  const latHemisphere = cursorCoords.lat < 0 ? 'S' : 'N';
  const lonHemisphere = cursorCoords.lon >= 0 ? 'E' : 'W';
  const activeLayerObj = layers.find((l) => l.id === activeLayerId) ?? null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-[#F4F7FB]">
      {/* Bright Cobalt Blue Top App Bar */}
      <header className="h-14 bg-[#0F5EC4] text-white px-3 sm:px-5 flex items-center justify-between gap-2 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 transition-colors"
            title="Kembali ke Beranda"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-base sm:text-lg font-bold tracking-tight whitespace-nowrap truncate">
            D H Y Explorer
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Quick 1-Tap Satelit / Jalan Switcher */}
          <div className="hidden md:inline-flex items-center bg-white/15 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => onChangeBasemap(defaultSatelliteBasemap)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                isSatelliteMode ? 'bg-white text-[#0F5EC4]' : 'text-white/90 hover:text-white'
              }`}
              title="Peta Dasar Satelit"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Satelit</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeBasemap(defaultStreetBasemap)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                !isSatelliteMode ? 'bg-white text-[#0F5EC4]' : 'text-white/90 hover:text-white'
              }`}
              title="Peta Dasar Jalan"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Jalan</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowQuickLayerDrawer((v) => !v);
              setShowBasemapPicker(false);
            }}
            className={`min-h-[40px] px-2.5 flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
              showQuickLayerDrawer ? 'bg-white text-[#0F5EC4]' : 'bg-white/15 hover:bg-white/25'
            }`}
            title="Panel Kontrol Layer, Urutan, Simbol & Opasitas"
          >
            <Layers className="w-4 h-4" />
            <span>Layer ({layers.filter((l) => l.visible).length}/{layers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowBasemapPicker((v) => !v);
              setShowQuickLayerDrawer(false);
            }}
            className={`min-h-[40px] px-2.5 flex items-center gap-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              showBasemapPicker ? 'bg-white/25' : 'hover:bg-white/15'
            }`}
            title="Pilih sumber peta dasar Satelit & Jalan"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{basemap.shortLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSearchBar((v) => !v)}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
              showSearchBar ? 'bg-white/25' : 'hover:bg-white/15'
            }`}
            title="Cari atau loncat ke koordinat"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onRequestGpsFix}
            disabled={isLocatingGps}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white/15 disabled:opacity-60 transition-colors"
            title="Pusatkan ke lokasi GNSS"
          >
            <LocateFixed className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Full-Bleed Map Viewport */}
      <div className="relative flex-1 bg-[#DCE8F5] overflow-hidden">
        {useCanvasFallback ? (
          <div ref={containerRef} className="w-full h-full">
            <SlippyMapCanvas
              basemap={basemap}
              center={{ lat: fallbackView.lat, lon: fallbackView.lon }}
              zoom={fallbackView.zoom}
              bearing={cursorCoords.bearing}
              showUtmGrid={showUtmGrid}
              waypoints={waypoints}
              layers={layers}
              activeLayerId={activeLayerId}
              draftVertices={draftVertices}
              snappedVertex={hoveredSnapVertex}
              toolMode={toolMode}
              gpsPosition={gpsPosition}
              trackPoints={trackPoints}
              onCenterZoomChange={(lat, lon, zoom) => {
                setFallbackView({ lat, lon, zoom });
                setCursorCoords((prev) => ({
                  ...prev,
                  lat,
                  lon,
                  zoom,
                  sourceStatus: `${basemap.displayName} (Kanvas 2D)`,
                }));
              }}
              onCursorMove={(lat, lon) => {
                setCursorCoords((prev) => ({ ...prev, lat, lon }));
                const mode = toolModeRef.current;
                if (
                  mode === 'digitize-line' ||
                  mode === 'digitize-polygon' ||
                  mode === 'measure-distance' ||
                  mode === 'measure-area'
                ) {
                  setHoveredSnapVertex(findSnappedCoord(lon, lat, fallbackView.zoom));
                } else if (hoveredSnapRef.current !== null) {
                  setHoveredSnapVertex(null);
                }
              }}
              onMapClick={(lat, lon, hitFeature) => {
                const mode = toolModeRef.current;
                if (mode === 'add-waypoint') {
                  onAddWaypointRef.current(lat, lon);
                  return;
                }
                if (
                  mode === 'digitize-line' ||
                  mode === 'digitize-polygon' ||
                  mode === 'measure-distance' ||
                  mode === 'measure-area'
                ) {
                  const snapped = findSnappedCoord(lon, lat, fallbackView.zoom);
                  const finalLon = snapped ? Number(snapped[0].toFixed(6)) : Number(lon.toFixed(6));
                  const finalLat = snapped ? Number(snapped[1].toFixed(6)) : Number(lat.toFixed(6));
                  setDraftVertices((prev) => [...prev, [finalLon, finalLat]]);
                  return;
                }
                if (hitFeature) {
                  setSelectedFeature({
                    layerId: hitFeature.layerId,
                    featureIndex: hitFeature.featureIndex,
                    layerName: hitFeature.layerName,
                    geometryType: hitFeature.geometryType,
                    properties: hitFeature.properties,
                    lon,
                    lat,
                  });
                  setIsEditingAttrs(false);
                  return;
                }
                setSelectedFeature(null);
                setIsEditingAttrs(false);
              }}
              onSnapshotReady={onSnapshotCaptured}
            />
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full cursor-crosshair" />
        )}

        {/* Top-Left Floating Coordinate Card (Toggleable Show/Hide) + Track & Active Layer */}
        <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 max-w-[275px]">
          {showWgs84Panel ? (
            <div className="w-full bg-white/92 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/85 px-3.5 py-2.5 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-900">Koordinat (WGS 84)</div>
                <button
                  type="button"
                  onClick={() => setShowWgs84Panel(false)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                  title="Sembunyikan panel Koordinat WGS 84"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Sembunyikan</span>
                </button>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-800 mt-1">
                {latHemisphere}: {Math.abs(cursorCoords.lat).toFixed(4)}°, {lonHemisphere}:{' '}
                {Math.abs(cursorCoords.lon).toFixed(4)}°
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-700 mt-0.5">
                UTM Zone: {activeZoneLabel.replace('Zona ', '')}
              </div>
              <div className="text-xs font-mono tabular-nums font-semibold text-[#0F5EC4] mt-0.5">
                {activeEpsg ? `EPSG: ${activeEpsg}` : 'Di luar zona 46–54'}
              </div>
              {activeUtm && (
                <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1 pt-1 border-t border-slate-100">
                  {activeUtm.easting.toFixed(0)} mT · {activeUtm.northing.toFixed(0)} mU
                </div>
              )}
              {gpsPosition && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-emerald-700">● GNSS Aktif</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    Akurasi: {gpsPosition.accuracy != null ? `±${gpsPosition.accuracy.toFixed(1)} m` : '—'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowWgs84Panel(true)}
              className="inline-flex items-center gap-1.5 bg-white/92 backdrop-blur-md rounded-xl shadow-md border border-slate-200/85 px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-white transition-colors"
              title="Tampilkan koordinat WGS 84 & zona UTM"
            >
              <Eye className="w-3.5 h-3.5 text-[#0F5EC4]" />
              <span>Koordinat WGS 84</span>
              {gpsPosition && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
            </button>
          )}

          {/* Live Track Pill & Quick Record Control */}
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/80 px-2.5 py-1.5 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onToggleTracking}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                isTrackingGps
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-[#EFF5FC] text-[#0F5EC4] hover:bg-blue-100'
              }`}
            >
              {isTrackingGps ? `● Stop Track (${trackPoints.length})` : '● Rekam Jalur'}
            </button>
            {trackPoints.length >= 2 && (
              <>
                <span className="text-[11px] font-mono tabular-nums font-bold text-[#7C3AED]">
                  {formatDistance(polylineDistanceMeters(trackPoints))}
                </span>
                <button
                  type="button"
                  onClick={onSaveTrackToLayer}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Simpan
                </button>
              </>
            )}
          </div>

          {gpsPermissionState === 'denied' && !dismissedPermBanner && (
            <div className="bg-rose-50/95 backdrop-blur-md rounded-xl shadow-md border border-rose-200 p-2.5 text-[11px] text-rose-800 space-y-1.5">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5 font-bold text-rose-900">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Izin Lokasi Ditolak</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedPermBanner(true)}
                  className="text-rose-500 hover:text-rose-800"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="leading-snug text-rose-700">
                {gpsError || 'Izinkan akses lokasi pada ikon gembok/pengaturan situs di browser untuk memakai GPS.'}
              </p>
              <button
                type="button"
                onClick={onRequestGpsFix}
                className="w-full py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700"
              >
                Coba Minta Izin Lagi
              </button>
            </div>
          )}

          {activeLayerObj && (
            <button
              type="button"
              onClick={() => setShowQuickLayerDrawer(true)}
              className="bg-white/95 backdrop-blur-md rounded-xl shadow-sm border border-slate-200/80 px-3 py-1.5 flex items-center gap-2 text-left hover:bg-slate-50 transition-colors"
              title="Klik untuk kelola layer aktif"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 border border-slate-300"
                style={{ backgroundColor: activeLayerObj.color }}
              />
              <span className="text-[11px] font-semibold text-slate-800 truncate">
                Aktif: {activeLayerObj.name}
              </span>
            </button>
          )}
        </div>

        {/* Top-Right Real-Time Orientation Compass & Grid UTM Toggle */}
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-slate-200/80 p-2 flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleRotateBearingStep(-15)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                title="Putar kiri 15°"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleResetNorthAndCenter}
                className="relative w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                title="Klik untuk reset arah Utara (0°)"
              >
                <span className="absolute top-0.5 text-[8px] font-bold text-rose-600 leading-none">
                  U
                </span>
                <span className="absolute bottom-0.5 text-[8px] font-bold text-slate-400 leading-none">
                  S
                </span>
                <span className="absolute left-1 text-[8px] font-bold text-slate-400 leading-none">
                  B
                </span>
                <span className="absolute right-1 text-[8px] font-bold text-slate-400 leading-none">
                  T
                </span>
                <svg
                  width="20"
                  height="26"
                  viewBox="0 0 24 32"
                  style={{
                    transform: `rotate(${-cursorCoords.bearing}deg)`,
                    transition: compassSensorActive ? 'none' : 'transform 150ms ease-out',
                  }}
                  aria-hidden="true"
                >
                  <polygon points="12,3 17,16 12,14" fill="#DC2626" />
                  <polygon points="12,3 7,16 12,14" fill="#EF4444" />
                  <polygon points="12,29 17,16 12,18" fill="#CBD5E1" />
                  <polygon points="12,29 7,16 12,18" fill="#94A3B8" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleRotateBearingStep(15)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
                title="Putar kanan 15°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-full flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-mono tabular-nums font-bold text-slate-800">
                {Math.round(normalizeBearingDeg(cursorCoords.bearing))}°{' '}
                {compassDirectionId(normalizeBearingDeg(cursorCoords.bearing))}
              </span>
              <button
                type="button"
                onClick={handleToggleCompassSensor}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors whitespace-nowrap ${
                  compassSensorActive
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Aktifkan sensor kompas perangkat secara real-time"
              >
                <Compass className="w-3 h-3" />
                <span>{compassSensorActive ? 'Live' : 'Sensor'}</span>
              </button>
            </div>

            {compassStatusNote && (
              <div className="max-w-[140px] text-[10px] text-amber-700 text-center leading-tight px-1">
                {compassStatusNote}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleUtmGrid}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-md border transition-colors whitespace-nowrap ${
              showUtmGrid
                ? 'bg-[#0F5EC4] text-white border-[#0F5EC4]'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            Grid UTM {showUtmGrid ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Floating Search Jump Modal */}
        {showSearchBar && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,380px)] bg-white rounded-2xl shadow-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900">
                Loncat ke Koordinat (Lat, Lon)
              </span>
              <button
                type="button"
                onClick={() => setShowSearchBar(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickJump} className="flex gap-2">
              <input
                type="text"
                value={quickJumpInput}
                onChange={(e) => setQuickJumpInput(e.target.value)}
                placeholder="-5.1478, 119.4321"
                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-[#0F5EC4] text-white rounded-xl hover:bg-[#0D4EA3]"
              >
                Pergi
              </button>
            </form>
            {jumpError && <p className="text-xs text-rose-600 mt-1.5">{jumpError}</p>}
          </div>
        )}

        {/* Floating Basemap Picker Popover (Categorized Satelit & Jalan) */}
        {showBasemapPicker && (
          <div className="absolute top-3 right-3 sm:right-16 z-20 w-64 bg-white rounded-2xl shadow-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900">Peta Dasar (Satelit & Jalan)</span>
              <button
                type="button"
                onClick={() => setShowBasemapPicker(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Citra Satelit & Hybrid
                </div>
                <div className="space-y-0.5">
                  {BASEMAP_CATALOG.filter((s) => s.category === 'satellite' || s.category === 'hybrid').map(
                    (source) => {
                      const active = source.id === basemap.id;
                      return (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => {
                            onChangeBasemap(source);
                            setShowBasemapPicker(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                            active
                              ? 'bg-[#EFF5FC] text-[#0F5EC4] font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{source.displayName}</span>
                          {active && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Peta Jalan & Vektor
                </div>
                <div className="space-y-0.5">
                  {BASEMAP_CATALOG.filter((s) => s.category === 'street' || s.category === 'vector').map(
                    (source) => {
                      const active = source.id === basemap.id;
                      return (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => {
                            onChangeBasemap(source);
                            setShowBasemapPicker(false);
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-between ${
                            active
                              ? 'bg-[#EFF5FC] text-[#0F5EC4] font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{source.displayName}</span>
                          {active && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Layer Control Drawer on Map */}
        {showQuickLayerDrawer && (
          <div className="absolute top-3 right-3 z-20 w-[min(94vw,370px)] max-h-[calc(100%-76px)] bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-[#0F5EC4] shrink-0" />
                <span className="text-xs font-bold text-slate-900 truncate">
                  Panel Layer ({layers.length})
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isImportingBatch}
                  onClick={() => quickImportInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#0F5EC4] text-white rounded-lg hover:bg-[#0D4EA3] disabled:opacity-50 whitespace-nowrap"
                  title="Tambah beberapa file vektor sekaligus"
                >
                  <FileUp className="w-3 h-3" />
                  <span>{isImportingBatch ? 'Mengimpor...' : '+ Banyak Layer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickLayerDrawer(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                ref={quickImportInputRef}
                type="file"
                multiple
                accept=".geojson,.json,.kml,.kmz,.gpx,.zip,.csv,.txt"
                onChange={(e) => handleQuickBatchImport(e.target.files)}
                className="hidden"
              />
            </div>

            {/* Bulk visibility & zoom bar */}
            <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between gap-1.5 text-[11px] shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onToggleAllLayers(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  <Eye className="w-3 h-3" />
                  <span>Semua ON</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleAllLayers(false)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Semua OFF</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleZoomToAllData}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EFF5FC] text-[#0F5EC4] font-semibold hover:bg-blue-100 whitespace-nowrap"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Zoom Semua</span>
              </button>
            </div>

            {batchImportMsg && (
              <div className="px-3.5 py-1.5 bg-emerald-50 border-b border-emerald-200 text-[11px] font-medium text-emerald-800 shrink-0">
                {batchImportMsg}
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {layers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Belum ada layer vektor. Gunakan <strong>+ Banyak Layer</strong> untuk menambahkan beberapa file sekaligus.
                </div>
              ) : (
                layers.map((layer, index) => {
                  const sym = normalizeLayerSymbology(layer);
                  const isActive = layer.id === activeLayerId;
                  const styleExpanded = expandedStyleLayerId === layer.id;
                  const layerBounds = computeFeatureCollectionBounds(layer.data);

                  return (
                    <div
                      key={layer.id}
                      className={`p-3 transition-colors ${isActive ? 'bg-[#EFF5FC]/70' : 'bg-white'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onToggleLayerVisibility(layer.id)}
                            className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              layer.visible
                                ? 'bg-[#0F5EC4] border-[#0F5EC4] text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}
                            title={layer.visible ? 'Nonaktifkan layer' : 'Aktifkan layer'}
                          >
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectActiveLayer(isActive ? null : layer.id)}
                            className="min-w-0 flex-1 text-left"
                            title="Pilih sebagai layer aktif"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-sm shrink-0 border border-slate-300"
                                style={{ backgroundColor: layer.color }}
                              />
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {layer.name}
                              </span>
                              {isActive && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#0F5EC4] text-white rounded shrink-0">
                                  AKTIF
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {layer.sourceFormat} · {layer.data.features.length} fitur ·{' '}
                              {Math.round(layer.opacity * 100)}%
                            </div>
                          </button>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => onMoveLayer(layer.id, 'up')}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                            title="Geser layer ke atas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === layers.length - 1}
                            onClick={() => onMoveLayer(layer.id, 'down')}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-30"
                            title="Geser layer ke bawah"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          {layerBounds && (
                            <button
                              type="button"
                              onClick={() => fitMapToBounds(layerBounds, 16)}
                              className="p-1.5 text-[#0F5EC4] hover:bg-blue-50 rounded-lg"
                              title="Zoom ke seluruh objek layer"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStyleLayerId(styleExpanded ? null : layer.id)
                            }
                            className={`p-1.5 rounded-lg ${
                              styleExpanded
                                ? 'bg-[#0F5EC4] text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Atur simbol, warna & transparansi"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {styleExpanded && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 space-y-2.5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              {INSPECTOR_COLOR_SWATCHES.map((sw) => (
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
                                className="w-5 h-5 rounded border border-slate-200 cursor-pointer ml-1"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenLayerAttributes(layer.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                                title="Buka Tabel Atribut"
                              >
                                <Table2 className="w-3 h-3" />
                                <span>Atribut</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteLayer(layer.id)}
                                className="p-1 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg"
                                title="Hapus layer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <label className="flex items-center justify-between gap-2 text-slate-700">
                            <span className="font-medium">Transparansi</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0.1}
                                max={1}
                                step={0.05}
                                value={layer.opacity}
                                onChange={(e) =>
                                  onUpdateLayerOpacity(layer.id, Number.parseFloat(e.target.value))
                                }
                                className="w-28 accent-[#0F5EC4]"
                              />
                              <span className="font-mono w-9 text-right">
                                {Math.round(layer.opacity * 100)}%
                              </span>
                            </div>
                          </label>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-600 font-medium">Simbol Titik</span>
                              <select
                                value={sym.pointShape}
                                onChange={(e) =>
                                  onUpdateLayerSymbology(layer.id, {
                                    ...sym,
                                    pointShape: e.target.value as PointSymbolShape,
                                  })
                                }
                                className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                              >
                                <option value="circle">Lingkaran</option>
                                <option value="square">Kotak</option>
                                <option value="triangle">Segitiga</option>
                                <option value="diamond">Belah Ketupat</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-600 font-medium">
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
                                className="accent-[#0F5EC4] mt-1"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-600 font-medium">Gaya Garis</span>
                              <select
                                value={sym.lineDash}
                                onChange={(e) =>
                                  onUpdateLayerSymbology(layer.id, {
                                    ...sym,
                                    lineDash: e.target.value as LineDashStyle,
                                  })
                                }
                                className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                              >
                                <option value="solid">Garis Utuh</option>
                                <option value="dashed">Putus-putus</option>
                                <option value="dotted">Titik-titik</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-600 font-medium">
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
                                className="accent-[#0F5EC4] mt-1"
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Active Tool / Drawing Floating Bar */}
        {/* Bottom-Left Clean Cartographic Scale Bar (Desktop/Tablet) */}
        <div className="hidden sm:inline-flex flex-col absolute bottom-12 left-3 z-10 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1.5 rounded-xl shadow-sm pointer-events-none">
          <div className="flex justify-between text-[10px] font-mono tabular-nums leading-none mb-1 gap-3">
            <span>0</span>
            <span>{scaleInfo.barHalfLabel}</span>
            <span>{scaleInfo.barLabel}</span>
          </div>
          <div
            style={{ width: `${scaleInfo.barWidthPx}px` }}
            className="h-1.5 border border-white flex"
          >
            <div className="w-1/2 h-full bg-white" />
            <div className="w-1/2 h-full bg-transparent" />
          </div>
        </div>

        {/* Bottom-Center Balanced Dock: Measurement HUD + Segmented Tool Bar (Inspeksi, Titik, Jarak, Luas) */}
        <div className="absolute bottom-12 left-3 sm:left-1/2 sm:-translate-x-1/2 z-10 flex flex-col items-start sm:items-center gap-2 max-w-[calc(100vw-80px)] sm:max-w-[440px]">
          {toolMode === 'add-waypoint' && (
            <div className="bg-white/92 backdrop-blur-md rounded-xl shadow-md border border-blue-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0F5EC4] shrink-0" />
              <span>Ketuk peta untuk menandai Titik Waypoint baru</span>
            </div>
          )}

          {(isLineDraft || isPolyDraft) && (
            showMeasureCard ? (
              <div className="bg-white/92 backdrop-blur-md rounded-2xl shadow-lg border border-amber-300/90 p-3 w-[min(calc(100vw-80px),330px)]">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900">
                  <span>{isLineDraft ? 'Digitasi & Ukur Garis' : 'Digitasi & Ukur Poligon'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSnapEnabled((s) => !s)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors whitespace-nowrap ${
                        snapEnabled
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Aktifkan/nonaktifkan Snap ke simpul terdekat"
                    >
                      <Magnet className="w-3 h-3" />
                      <span>Snap {snapEnabled ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMeasureCard(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                      title="Perkecil kartu pengukuran"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {draftVertices.length === 0 ? (
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Ketuk titik pada peta untuk mulai mengukur {isLineDraft ? 'jarak' : 'luas'}.
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-1 text-xs font-mono tabular-nums text-slate-800">
                    <div className="flex justify-between text-[11px] text-amber-700">
                      <span className="font-sans text-slate-500">Simpul</span>
                      <span className="font-semibold">{draftVertices.length} titik</span>
                    </div>
                    {isLineDraft && (
                      <>
                        <div className="flex justify-between">
                          <span className="font-sans text-slate-500">Jarak Total</span>
                          <span className="font-bold text-[#0F5EC4]">
                            {formatDistance(draftDistanceM)}
                          </span>
                        </div>
                        {draftLastBearing !== null && (
                          <div className="flex justify-between">
                            <span className="font-sans text-slate-500">Azimuth</span>
                            <span>
                              {draftLastBearing.toFixed(1)}° ({compassDirectionId(draftLastBearing)})
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {isPolyDraft && (
                      <>
                        <div className="flex justify-between">
                          <span className="font-sans text-slate-500">Luas Geodetik</span>
                          <span className="font-bold text-[#0F5EC4]">
                            {formatArea(draftAreaSqM)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-sans text-slate-500">Keliling</span>
                          <span>{formatDistance(draftPerimeterM)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  value={draftFeatureName}
                  onChange={(e) => setDraftFeatureName(e.target.value)}
                  placeholder="Nama fitur (opsional, mis. Blok A)"
                  className="mt-2 w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0F5EC4]"
                />

                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={
                      (isLineDraft && draftVertices.length < 2) ||
                      (isPolyDraft && draftVertices.length < 3)
                    }
                    onClick={handleSaveDraft}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-[#0F5EC4] text-white disabled:opacity-40 hover:bg-[#0D4EA3]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Layer</span>
                  </button>
                  <button
                    type="button"
                    disabled={draftVertices.length === 0}
                    onClick={() => setDraftVertices((prev) => prev.slice(0, -1))}
                    className="p-1.5 text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-40"
                    title="Urungkan"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={draftVertices.length === 0}
                    onClick={() => setDraftVertices([])}
                    className="p-1.5 text-rose-700 bg-rose-50 rounded-xl hover:bg-rose-100 disabled:opacity-40"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowMeasureCard(true)}
                className="inline-flex items-center gap-2 bg-white/92 backdrop-blur-md rounded-xl shadow-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white"
              >
                <span className="text-amber-700">{draftVertices.length} titik</span>
                <span className="font-mono text-[#0F5EC4]">
                  {isLineDraft ? formatDistance(draftDistanceM) : formatArea(draftAreaSqM)}
                </span>
                <span className="text-[10px] text-slate-500">Buka Panel</span>
              </button>
            )
          )}

          <div className="inline-flex items-center gap-1 bg-white/92 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/90 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => onChangeToolMode('inspect')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                toolMode === 'inspect'
                  ? 'bg-[#0F5EC4] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Inspeksi</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeToolMode('add-waypoint')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                toolMode === 'add-waypoint'
                  ? 'bg-[#0F5EC4] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Titik</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeToolMode('measure-distance')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                toolMode === 'measure-distance' || toolMode === 'digitize-line'
                  ? 'bg-[#0F5EC4] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Jarak</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeToolMode('measure-area')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                toolMode === 'measure-area' || toolMode === 'digitize-polygon'
                  ? 'bg-[#0F5EC4] text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>Luas</span>
            </button>
          </div>
        </div>

        {/* Bottom-Right Stacked Zoom + Utility Controls */}
        <div className="absolute bottom-12 right-3 z-10 flex flex-col gap-2">
          <div className="flex flex-col bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden">
            <button
              type="button"
              onClick={() => handleZoomStep(1)}
              className="w-11 h-11 flex items-center justify-center text-slate-800 hover:bg-slate-100 border-b border-slate-200"
              title="Perbesar"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoomStep(-1)}
              className="w-11 h-11 flex items-center justify-center text-slate-800 hover:bg-slate-100"
              title="Perkecil"
            >
              <Minus className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col bg-white rounded-2xl shadow-md border border-slate-200/80 overflow-hidden">
            <button
              type="button"
              onClick={() =>
                moveMapTo(
                  MAP_LIBRE_CONFIG.DEFAULT_LATITUDE,
                  MAP_LIBRE_CONFIG.DEFAULT_LONGITUDE,
                  MAP_LIBRE_CONFIG.DEFAULT_ZOOM
                )
              }
              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-100 border-b border-slate-200"
              title="Lihat seluruh Indonesia"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomToAllData}
              className="w-11 h-11 flex items-center justify-center text-slate-700 hover:bg-slate-100 border-b border-slate-200"
              title="Zoom ke seluruh data"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCaptureToLayout}
              className="w-11 h-11 flex items-center justify-center text-[#0F5EC4] hover:bg-slate-100"
              title="Tangkap peta untuk Layout PDF"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selected Feature Inspector Drawer (Attribute Table + Waypoint Editor + Color Styling + Buffer) */}
        {selectedFeature && (() => {
          const matchedLayer = selectedFeature.layerId
            ? layers.find((l) => l.id === selectedFeature.layerId) ?? null
            : null;
          const wpId =
            !matchedLayer && typeof selectedFeature.properties.id === 'string'
              ? selectedFeature.properties.id
              : null;
          const matchedWaypoint = wpId
            ? waypoints.find((w) => w.id === wpId) ?? null
            : null;
          const entries = Object.entries(selectedFeature.properties);

          return (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-16 sm:bottom-12 z-20 w-[min(94vw,340px)] max-h-[60vh] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-3.5">
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {matchedLayer && (
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-slate-300"
                        style={{ backgroundColor: matchedLayer.color }}
                      />
                    )}
                    <span className="text-xs font-bold text-[#0F5EC4] truncate">
                      {matchedWaypoint ? matchedWaypoint.label : selectedFeature.layerName}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {selectedFeature.geometryType} · {selectedFeature.lat.toFixed(5)}°,{' '}
                    {selectedFeature.lon.toFixed(5)}°
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFeature(null);
                    setIsEditingWp(false);
                    setIsEditingAttrs(false);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Attribute Table + Inline Editor */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {matchedWaypoint ? 'Atribut Waypoint' : 'Tabel Atribut Fitur'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const feat =
                          matchedLayer && selectedFeature.featureIndex !== undefined
                            ? matchedLayer.data.features[selectedFeature.featureIndex]
                            : undefined;
                        const featBounds = feat ? computeSingleFeatureBounds(feat) : null;
                        if (featBounds) {
                          fitMapToBounds(featBounds, 17);
                        } else {
                          moveMapTo(selectedFeature.lat, selectedFeature.lon, 16);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                      title="Zoom ke objek terpilih"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Zoom Objek</span>
                    </button>
                    {matchedWaypoint && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEditingWp) {
                            setWpDraftLabel(matchedWaypoint.label);
                            setWpDraftCategory(matchedWaypoint.category ?? 'Survei');
                            setWpDraftLat(matchedWaypoint.latitude.toFixed(6));
                            setWpDraftLon(matchedWaypoint.longitude.toFixed(6));
                            setWpDraftElev(
                              matchedWaypoint.elevationM != null
                                ? String(matchedWaypoint.elevationM)
                                : ''
                            );
                            setWpDraftNote(matchedWaypoint.note ?? '');
                            setIsEditingWp(true);
                          } else {
                            setIsEditingWp(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline whitespace-nowrap"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isEditingWp ? 'Batal' : 'Edit'}</span>
                      </button>
                    )}
                    {matchedLayer && selectedFeature.featureIndex !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isEditingAttrs) {
                            const init: Record<string, string> = {};
                            Object.entries(selectedFeature.properties).forEach(([k, v]) => {
                              init[k] = v === null || v === undefined ? '' : String(v);
                            });
                            setDraftAttrs(init);
                            setNewAttrKey('');
                            setNewAttrVal('');
                            setIsEditingAttrs(true);
                          } else {
                            setIsEditingAttrs(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:underline whitespace-nowrap"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isEditingAttrs ? 'Batal' : 'Edit'}</span>
                      </button>
                    )}
                    {matchedLayer && (
                      <button
                        type="button"
                        onClick={() => onOpenLayerAttributes(matchedLayer.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F5EC4] hover:underline whitespace-nowrap"
                      >
                        <Table2 className="w-3 h-3" />
                        <span>Tabel ({matchedLayer.data.features.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {isEditingWp && matchedWaypoint ? (
                  <div className="space-y-2 text-xs">
                    <input
                      type="text"
                      value={wpDraftLabel}
                      onChange={(e) => setWpDraftLabel(e.target.value)}
                      placeholder="Nama / Label Waypoint"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F5EC4]"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={wpDraftCategory}
                        onChange={(e) => setWpDraftCategory(e.target.value)}
                        className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value="Titik Kontrol">Titik Kontrol</option>
                        <option value="Batas Lahan">Batas Lahan</option>
                        <option value="Infrastruktur">Infrastruktur</option>
                        <option value="Survei">Survei</option>
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        value={wpDraftElev}
                        onChange={(e) => setWpDraftElev(e.target.value)}
                        placeholder="Elevasi (m)"
                        className="px-2 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="number"
                        step="0.000001"
                        value={wpDraftLat}
                        onChange={(e) => setWpDraftLat(e.target.value)}
                        placeholder="Latitude"
                        className="px-2 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                      <input
                        type="number"
                        step="0.000001"
                        value={wpDraftLon}
                        onChange={(e) => setWpDraftLon(e.target.value)}
                        placeholder="Longitude"
                        className="px-2 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <input
                      type="text"
                      value={wpDraftNote}
                      onChange={(e) => setWpDraftNote(e.target.value)}
                      placeholder="Catatan lapangan"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F5EC4]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const lat = Number.parseFloat(wpDraftLat);
                        const lon = Number.parseFloat(wpDraftLon);
                        const elev = wpDraftElev.trim() ? Number.parseFloat(wpDraftElev) : null;
                        if (!wpDraftLabel.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)) {
                          return;
                        }
                        onUpdateWaypoint(matchedWaypoint.id, {
                          label: wpDraftLabel.trim(),
                          category: wpDraftCategory,
                          latitude: lat,
                          longitude: lon,
                          elevationM: Number.isFinite(elev) ? elev : null,
                          note: wpDraftNote.trim(),
                        });
                        setSelectedFeature((prev) =>
                          prev
                            ? {
                                ...prev,
                                lat,
                                lon,
                                properties: {
                                  ...prev.properties,
                                  label: wpDraftLabel.trim(),
                                  kategori: wpDraftCategory,
                                  catatan: wpDraftNote.trim(),
                                },
                              }
                            : null
                        );
                        setIsEditingWp(false);
                      }}
                      className="w-full py-1.5 text-xs font-semibold bg-[#0F5EC4] text-white rounded-lg hover:bg-[#0D4EA3]"
                    >
                      Simpan Perubahan Waypoint
                    </button>
                  </div>
                ) : isEditingAttrs && matchedLayer && selectedFeature.featureIndex !== undefined ? (
                  <div className="space-y-2">
                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {Object.entries(draftAttrs).map(([k, val]) => (
                        <div key={k} className="flex items-center gap-1.5 px-2 py-1 text-xs">
                          <span className="w-24 shrink-0 text-slate-600 font-medium truncate">
                            {k}
                          </span>
                          <input
                            type="text"
                            value={val}
                            onChange={(e) =>
                              setDraftAttrs((prev) => ({ ...prev, [k]: e.target.value }))
                            }
                            className="flex-1 px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F5EC4]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newAttrKey}
                        onChange={(e) => setNewAttrKey(e.target.value)}
                        placeholder="Kolom baru"
                        className="w-24 px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg"
                      />
                      <input
                        type="text"
                        value={newAttrVal}
                        onChange={(e) => setNewAttrVal(e.target.value)}
                        placeholder="Nilai baru"
                        className="flex-1 px-2 py-1 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const merged: Record<string, unknown> = { ...draftAttrs };
                          const cleanKey = newAttrKey.trim();
                          if (cleanKey) merged[cleanKey] = newAttrVal.trim();
                          onUpdateFeatureProperties(
                            matchedLayer.id,
                            selectedFeature.featureIndex!,
                            merged
                          );
                          setSelectedFeature((prev) =>
                            prev ? { ...prev, properties: merged } : null
                          );
                          setIsEditingAttrs(false);
                        }}
                        className="flex-1 py-1.5 text-xs font-semibold bg-[#0F5EC4] text-white rounded-lg hover:bg-[#0D4EA3]"
                      >
                        Simpan Atribut
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteLayerFeature(matchedLayer.id, selectedFeature.featureIndex!);
                          setSelectedFeature(null);
                          setIsEditingAttrs(false);
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 rounded-lg hover:bg-rose-100"
                        title="Hapus fitur ini dari layer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : entries.length === 0 ? (
                  <p className="text-xs text-slate-500 py-1.5">Tidak ada atribut tambahan.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-600">
                          <th className="py-1.5 px-2.5">Kolom</th>
                          <th className="py-1.5 px-2.5">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {entries.map(([k, v]) => (
                          <tr key={k} className="hover:bg-slate-50">
                            <td className="py-1 px-2.5 text-slate-600 font-medium">{k}</td>
                            <td className="py-1 px-2.5 font-mono text-slate-900 break-all">
                              {String(v ?? '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Layer Color & Opacity Controls for Polylines, Polygons, Points, SHP */}
              {matchedLayer && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-700">
                      Warna {matchedLayer.sourceFormat} ({selectedFeature.geometryType})
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-600 cursor-pointer">
                      <span>{matchedLayer.color.toUpperCase()}</span>
                      <input
                        type="color"
                        value={matchedLayer.color}
                        onChange={(e) => onUpdateLayerColor(matchedLayer.id, e.target.value)}
                        className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                        title="Pilih warna khusus"
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {INSPECTOR_COLOR_SWATCHES.map((swatch) => {
                        const active =
                          matchedLayer.color.toLowerCase() === swatch.toLowerCase();
                        return (
                          <button
                            key={swatch}
                            type="button"
                            onClick={() => onUpdateLayerColor(matchedLayer.id, swatch)}
                            style={{ backgroundColor: swatch }}
                            className={`w-6 h-6 rounded-lg border transition-transform ${
                              active
                                ? 'border-slate-900 scale-110 ring-2 ring-[#0F5EC4]/30'
                                : 'border-white shadow-sm hover:scale-105'
                            }`}
                            title={`Ubah warna ke ${swatch}`}
                          />
                        );
                      })}
                    </div>

                    <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span>Opasitas</span>
                      <input
                        type="range"
                        min={0.15}
                        max={1}
                        step={0.05}
                        value={matchedLayer.opacity}
                        onChange={(e) =>
                          onUpdateLayerOpacity(matchedLayer.id, Number.parseFloat(e.target.value))
                        }
                        className="w-16 accent-[#0F5EC4]"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
                <select
                  value={bufferRadiusM}
                  onChange={(e) => setBufferRadiusM(Number(e.target.value))}
                  className="flex-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5"
                >
                  <option value={100}>Buffer 100 m</option>
                  <option value={500}>Buffer 500 m</option>
                  <option value={1000}>Buffer 1 km</option>
                  <option value={5000}>Buffer 5 km</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const label = String(
                      selectedFeature.properties.label ??
                        selectedFeature.properties.name ??
                        selectedFeature.properties.nama ??
                        selectedFeature.layerName
                    );
                    onCreateBufferAt(selectedFeature.lon, selectedFeature.lat, bufferRadiusM, label);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#0F5EC4] text-white rounded-xl hover:bg-[#0D4EA3] whitespace-nowrap"
                >
                  <CircleDot className="w-3.5 h-3.5" />
                  <span>Buat</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Bottom White Strip: Skala & Zoom */}
        <div className="absolute bottom-0 left-0 right-0 h-9 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-3 sm:px-5 flex items-center justify-between text-xs font-mono tabular-nums text-slate-800 z-10">
          <span>Skala {scaleInfo.ratioText}</span>
          <span className="hidden sm:inline font-sans text-slate-500">{basemap.displayName}</span>
          <span>Zoom: {cursorCoords.zoom.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};

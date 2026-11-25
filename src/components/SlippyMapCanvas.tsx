import React, { useEffect, useRef } from 'react';
import type { Feature, Geometry } from 'geojson';
import { BasemapSource } from '../core/map/basemapCatalog';
import { GeoLayer, LayerSymbology, MapToolMode } from '../core/project/projectDefinition';
import {
  buildIndonesiaUtmGridGeoJson,
  LngLatTuple,
  normalizeLayerSymbology,
} from '../core/spatial/geodesy';
import { SurveyWaypoint } from '../core/vector/waypointExporter';

export interface HitFeatureResult {
  layerId: string | null;
  featureIndex?: number;
  layerName: string;
  geometryType: string;
  properties: Record<string, unknown>;
}

interface SlippyMapCanvasProps {
  basemap: BasemapSource;
  center: { lat: number; lon: number };
  zoom: number;
  bearing?: number;
  showUtmGrid: boolean;
  waypoints: SurveyWaypoint[];
  layers: GeoLayer[];
  activeLayerId?: string | null;
  draftVertices: LngLatTuple[];
  snappedVertex?: LngLatTuple | null;
  toolMode: MapToolMode;
  gpsPosition: { lat: number; lon: number; accuracy: number | null } | null;
  trackPoints?: LngLatTuple[];
  onCenterZoomChange: (lat: number, lon: number, zoom: number, status?: string) => void;
  onCursorMove: (lat: number, lon: number) => void;
  onMapClick: (lat: number, lon: number, hitFeature?: HitFeatureResult) => void;
  onSnapshotReady: (dataUrl: string, lat: number, lon: number, zoom: number) => void;
}

const TILE_SIZE = 256;

function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom) * TILE_SIZE;
}

function latToWorldY(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const n = Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return ((1 - n / Math.PI) / 2) * Math.pow(2, zoom) * TILE_SIZE;
}

function worldXToLon(x: number, zoom: number): number {
  return (x / (Math.pow(2, zoom) * TILE_SIZE)) * 360 - 180;
}

function worldYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (Math.pow(2, zoom) * TILE_SIZE);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function distToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

function isPointInRing(px: number, py: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function resolveTileUrl(template: string | null, z: number, x: number, y: number): string {
  const tpl = template ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return tpl
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

export const SlippyMapCanvas: React.FC<SlippyMapCanvasProps> = ({
  basemap,
  center,
  zoom,
  bearing = 0,
  showUtmGrid,
  waypoints,
  layers,
  activeLayerId = null,
  draftVertices,
  snappedVertex = null,
  toolMode,
  gpsPosition,
  trackPoints = [],
  onCenterZoomChange,
  onCursorMove,
  onMapClick,
  onSnapshotReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tileCacheRef = useRef<Map<string, HTMLImageElement | 'loading' | 'error'>>(new Map());
  const dragRef = useRef<{
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startCenterX: number;
    startCenterY: number;
  } | null>(null);

  const stateRef = useRef({
    basemap,
    center,
    zoom,
    bearing,
    showUtmGrid,
    waypoints,
    layers,
    activeLayerId,
    draftVertices,
    snappedVertex,
    toolMode,
    gpsPosition,
    trackPoints,
  });
  stateRef.current = {
    basemap,
    center,
    zoom,
    bearing,
    showUtmGrid,
    waypoints,
    layers,
    activeLayerId,
    draftVertices,
    snappedVertex,
    toolMode,
    gpsPosition,
    trackPoints,
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#CFE2F5';
    ctx.fillRect(0, 0, width, height);

    const {
      center: c,
      zoom: z,
      bearing: b,
      basemap: bm,
      showUtmGrid: utmVis,
      layers: lyrs,
      activeLayerId: actLayerId,
      waypoints: wps,
      draftVertices: draft,
      snappedVertex: snapPt,
      toolMode: mode,
      gpsPosition: gps,
      trackPoints: trkPts,
    } = stateRef.current;

    if (b !== 0) {
      ctx.translate(width / 2, height / 2);
      ctx.rotate((-b * Math.PI) / 180);
      ctx.translate(-width / 2, -height / 2);
    }

    const tileZ = Math.max(1, Math.min(bm.maxZoom, Math.round(z)));
    const scaleFactor = Math.pow(2, z - tileZ);
    const scaledTile = TILE_SIZE * scaleFactor;

    const centerWorldX = lonToWorldX(c.lon, z);
    const centerWorldY = latToWorldY(c.lat, z);

    const topLeftWorldX = centerWorldX - width / 2;
    const topLeftWorldY = centerWorldY - height / 2;

    const padTiles = b !== 0 ? 2 : 0;
    const minTileX = Math.floor(topLeftWorldX / scaledTile) - padTiles;
    const maxTileX = Math.floor((topLeftWorldX + width) / scaledTile) + padTiles;
    const minTileY = Math.floor(topLeftWorldY / scaledTile) - padTiles;
    const maxTileY = Math.floor((topLeftWorldY + height) / scaledTile) + padTiles;
    const numTiles = Math.pow(2, tileZ);

    for (let ty = minTileY; ty <= maxTileY; ty++) {
      if (ty < 0 || ty >= numTiles) continue;
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const wrappedX = ((tx % numTiles) + numTiles) % numTiles;
        const url = resolveTileUrl(bm.tileUrlTemplate, tileZ, wrappedX, ty);
        const cacheKey = `${bm.id}:${tileZ}/${wrappedX}/${ty}`;
        const drawX = tx * scaledTile - topLeftWorldX;
        const drawY = ty * scaledTile - topLeftWorldY;

        const cached = tileCacheRef.current.get(cacheKey);
        if (cached instanceof HTMLImageElement && cached.complete) {
          ctx.drawImage(cached, drawX, drawY, scaledTile + 0.5, scaledTile + 0.5);
        } else {
          ctx.strokeStyle = 'rgba(15, 94, 196, 0.08)';
          ctx.strokeRect(drawX, drawY, scaledTile, scaledTile);
          if (!cached) {
            tileCacheRef.current.set(cacheKey, 'loading');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              tileCacheRef.current.set(cacheKey, img);
              requestAnimationFrame(renderCanvas);
            };
            img.onerror = () => {
              tileCacheRef.current.set(cacheKey, 'error');
            };
            img.src = url;
          }
        }
      }
    }

    const toScreen = (lon: number, lat: number): [number, number] => [
      lonToWorldX(lon, z) - topLeftWorldX,
      latToWorldY(lat, z) - topLeftWorldY,
    ];

    const tracePointShape = (
      sx: number,
      sy: number,
      shape: LayerSymbology['pointShape'],
      radius: number
    ) => {
      ctx.beginPath();
      if (shape === 'square') {
        ctx.rect(sx - radius, sy - radius, radius * 2, radius * 2);
      } else if (shape === 'triangle') {
        const r = radius * 1.25;
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r * 0.866, sy + r * 0.6);
        ctx.lineTo(sx - r * 0.866, sy + r * 0.6);
        ctx.closePath();
      } else if (shape === 'diamond') {
        const r = radius * 1.25;
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r, sy);
        ctx.lineTo(sx, sy + r);
        ctx.lineTo(sx - r, sy);
        ctx.closePath();
      } else {
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      }
    };

    const drawGeometry = (
      geom: Geometry,
      strokeColor: string,
      fillColor: string,
      opacity: number,
      lineWidth = 2.8,
      dashStyle: LayerSymbology['lineDash'] = 'solid',
      pointShape: LayerSymbology['pointShape'] = 'circle',
      pointSize = 6.5,
      isActiveLayer = false
    ) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      if (dashStyle === 'dashed') ctx.setLineDash([8, 5]);
      else if (dashStyle === 'dotted') ctx.setLineDash([2, 4]);

      const borderStroke = isActiveLayer ? '#F59E0B' : '#FFFFFF';
      const borderWidth = isActiveLayer ? 2.6 : 2;

      if (geom.type === 'Point') {
        const [sx, sy] = toScreen(geom.coordinates[0], geom.coordinates[1]);
        tracePointShape(sx, sy, pointShape, pointSize);
        ctx.fillStyle = strokeColor;
        ctx.fill();
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = borderStroke;
        ctx.stroke();
      } else if (geom.type === 'MultiPoint') {
        geom.coordinates.forEach((pt) => {
          const [sx, sy] = toScreen(pt[0], pt[1]);
          tracePointShape(sx, sy, pointShape, pointSize);
          ctx.fillStyle = strokeColor;
          ctx.fill();
          ctx.lineWidth = borderWidth;
          ctx.strokeStyle = borderStroke;
          ctx.stroke();
        });
      } else if (geom.type === 'LineString') {
        ctx.beginPath();
        geom.coordinates.forEach((pt, idx) => {
          const [sx, sy] = toScreen(pt[0], pt[1]);
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        if (isActiveLayer) {
          ctx.save();
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = lineWidth + 3.5;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      } else if (geom.type === 'MultiLineString') {
        geom.coordinates.forEach((line) => {
          ctx.beginPath();
          line.forEach((pt, idx) => {
            const [sx, sy] = toScreen(pt[0], pt[1]);
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          if (isActiveLayer) {
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
            ctx.lineWidth = lineWidth + 3.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = lineWidth;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.stroke();
        });
      } else if (geom.type === 'Polygon') {
        geom.coordinates.forEach((ring) => {
          ctx.beginPath();
          ring.forEach((pt, idx) => {
            const [sx, sy] = toScreen(pt[0], pt[1]);
            if (idx === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          });
          ctx.closePath();
          ctx.fillStyle = fillColor;
          ctx.globalAlpha = Math.max(0.1, opacity * 0.34);
          ctx.fill();
          ctx.globalAlpha = opacity;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = isActiveLayer ? lineWidth + 0.8 : lineWidth;
          ctx.stroke();
        });
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly) => {
          poly.forEach((ring) => {
            ctx.beginPath();
            ring.forEach((pt, idx) => {
              const [sx, sy] = toScreen(pt[0], pt[1]);
              if (idx === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            });
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.globalAlpha = Math.max(0.1, opacity * 0.34);
            ctx.fill();
            ctx.globalAlpha = opacity;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isActiveLayer ? lineWidth + 0.8 : lineWidth;
            ctx.stroke();
          });
        });
      }
      ctx.restore();
    };

    if (utmVis) {
      const grid = buildIndonesiaUtmGridGeoJson();
      grid.features.forEach((f) => {
        if (!f.geometry) return;
        const kind = f.properties?.kind;
        if (kind === 'zone-label' && f.geometry.type === 'Point') {
          const [sx, sy] = toScreen(f.geometry.coordinates[0], f.geometry.coordinates[1]);
          ctx.font = '600 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#FFFFFF';
          ctx.strokeText(String(f.properties?.label ?? ''), sx, sy);
          ctx.fillStyle = '#0F5EC4';
          ctx.fillText(String(f.properties?.label ?? ''), sx, sy);
        } else {
          drawGeometry(
            f.geometry,
            kind === 'equator' ? '#F59E0B' : '#0EA5E9',
            '#0EA5E9',
            0.8,
            kind === 'equator' ? 2 : 1.2,
            'dashed'
          );
        }
      });
    }

    [...lyrs]
      .reverse()
      .filter((l) => l.visible)
      .forEach((layer) => {
        const sym = normalizeLayerSymbology(layer);
        const isActive = layer.id === actLayerId;
        layer.data.features.forEach((f: Feature) => {
          if (f.geometry) {
            drawGeometry(
              f.geometry,
              layer.color,
              layer.color,
              layer.opacity,
              sym.lineWidth,
              sym.lineDash,
              sym.pointShape,
              sym.pointSize,
              isActive
            );
          }
        });
      });

    wps.forEach((wp) => {
      const [sx, sy] = toScreen(wp.longitude, wp.latitude);
      ctx.beginPath();
      ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#DC2626';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(wp.label, sx, sy + 19);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(wp.label, sx, sy + 19);
    });

    if (trkPts.length >= 2) {
      drawGeometry(
        { type: 'LineString', coordinates: trkPts },
        '#7C3AED',
        '#7C3AED',
        0.95,
        3.2,
        'solid'
      );
      const [sx0, sy0] = toScreen(trkPts[0][0], trkPts[0][1]);
      ctx.beginPath();
      ctx.arc(sx0, sy0, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#16A34A';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    if (gps) {
      const [gx, gy] = toScreen(gps.lon, gps.lat);
      ctx.beginPath();
      ctx.arc(gx, gy, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 94, 196, 0.22)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx, gy, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#0F5EC4';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      if (gps.accuracy != null) {
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        const accLabel = `GNSS ±${gps.accuracy.toFixed(1)}m`;
        ctx.strokeText(accLabel, gx, gy - 12);
        ctx.fillStyle = '#0F5EC4';
        ctx.fillText(accLabel, gx, gy - 12);
      }
    }

    if (draft.length > 0) {
      const isPoly = mode === 'digitize-polygon' || mode === 'measure-area';
      if (draft.length >= 2) {
        if (isPoly && draft.length >= 3) {
          drawGeometry(
            { type: 'Polygon', coordinates: [[...draft, draft[0]]] },
            '#F59E0B',
            '#F59E0B',
            0.9,
            2.5,
            'dashed'
          );
        } else {
          drawGeometry(
            { type: 'LineString', coordinates: draft },
            '#F59E0B',
            '#F59E0B',
            0.95,
            2.5,
            'dashed'
          );
        }
      }
      draft.forEach((pt) => {
        const [sx, sy] = toScreen(pt[0], pt[1]);
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B';
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      });
    }

    if (snapPt) {
      const [sx, sy] = toScreen(snapPt[0], snapPt[1]);
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#06B6D4';
      ctx.fill();
    }

    ctx.restore();
  };

  useEffect(() => {
    renderCanvas();
  }, [
    basemap,
    center,
    zoom,
    bearing,
    showUtmGrid,
    waypoints,
    layers,
    activeLayerId,
    draftVertices,
    snappedVertex,
    toolMode,
    gpsPosition,
    trackPoints,
  ]);

  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener('resize', handleResize);
    const timer = window.setTimeout(() => {
      try {
        if (canvasRef.current) {
          onSnapshotReady(canvasRef.current.toDataURL('image/png'), center.lat, center.lon, zoom);
        }
      } catch {
        // Ignore CORS tainted canvas
      }
    }, 600);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.clearTimeout(timer);
    };
  }, [center.lat, center.lon, zoom, bearing, basemap.id]);

  const unrotatePoint = (px: number, py: number, width: number, height: number): [number, number] => {
    if (bearing === 0) return [px, py];
    const cx = width / 2;
    const cy = height / 2;
    const rad = (bearing * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };

  const screenToLatLon = (clientX: number, clientY: number): { lat: number; lon: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const [px, py] = unrotatePoint(clientX - rect.left, clientY - rect.top, rect.width, rect.height);
    const centerWorldX = lonToWorldX(center.lon, zoom);
    const centerWorldY = latToWorldY(center.lat, zoom);
    const wx = centerWorldX - rect.width / 2 + px;
    const wy = centerWorldY - rect.height / 2 + py;
    return {
      lat: Math.max(-85, Math.min(85, worldYToLat(wy, zoom))),
      lon: ((worldXToLon(wx, zoom) + 540) % 360) - 180,
    };
  };

  const hitTestFeatures = (
    clickX: number,
    clickY: number,
    topLeftX: number,
    topLeftY: number
  ): HitFeatureResult | undefined => {
    const toScreen = (lon: number, lat: number): [number, number] => [
      lonToWorldX(lon, zoom) - topLeftX,
      latToWorldY(lat, zoom) - topLeftY,
    ];

    // 1. Check Waypoints first
    const hitWp = waypoints.find((wp) => {
      const [wx, wy] = toScreen(wp.longitude, wp.latitude);
      return Math.hypot(wx - clickX, wy - clickY) <= 14;
    });
    if (hitWp) {
      return {
        layerId: null,
        layerName: 'Titik Survei (Waypoint)',
        geometryType: 'Point',
        properties: {
          id: hitWp.id,
          label: hitWp.label,
          kategori: hitWp.category ?? 'Survei',
          catatan: hitWp.note ?? '',
        },
      };
    }

    // 2. Check User Layers (Points -> Lines -> Polygons)
    const visibleLayers = layers.filter((l) => l.visible);

    for (const layer of visibleLayers) {
      for (let fIdx = 0; fIdx < layer.data.features.length; fIdx++) {
        const feat = layer.data.features[fIdx];
        if (!feat.geometry) continue;
        const g = feat.geometry;
        if (g.type === 'Point') {
          const [sx, sy] = toScreen(g.coordinates[0], g.coordinates[1]);
          if (Math.hypot(sx - clickX, sy - clickY) <= 14) {
            return {
              layerId: layer.id,
              featureIndex: fIdx,
              layerName: layer.name,
              geometryType: 'Point',
              properties: (feat.properties as Record<string, unknown>) ?? {},
            };
          }
        } else if (g.type === 'MultiPoint') {
          for (const pt of g.coordinates) {
            const [sx, sy] = toScreen(pt[0], pt[1]);
            if (Math.hypot(sx - clickX, sy - clickY) <= 14) {
              return {
                layerId: layer.id,
                featureIndex: fIdx,
                layerName: layer.name,
                geometryType: 'MultiPoint',
                properties: (feat.properties as Record<string, unknown>) ?? {},
              };
            }
          }
        }
      }
    }

    for (const layer of visibleLayers) {
      for (let fIdx = 0; fIdx < layer.data.features.length; fIdx++) {
        const feat = layer.data.features[fIdx];
        if (!feat.geometry) continue;
        const g = feat.geometry;
        const lines =
          g.type === 'LineString'
            ? [g.coordinates]
            : g.type === 'MultiLineString'
              ? g.coordinates
              : [];
        for (const line of lines) {
          for (let i = 1; i < line.length; i++) {
            const [x1, y1] = toScreen(line[i - 1][0], line[i - 1][1]);
            const [x2, y2] = toScreen(line[i][0], line[i][1]);
            if (distToSegmentSq(clickX, clickY, x1, y1, x2, y2) <= 144) {
              return {
                layerId: layer.id,
                featureIndex: fIdx,
                layerName: layer.name,
                geometryType: g.type,
                properties: (feat.properties as Record<string, unknown>) ?? {},
              };
            }
          }
        }
      }
    }

    for (const layer of visibleLayers) {
      for (let fIdx = 0; fIdx < layer.data.features.length; fIdx++) {
        const feat = layer.data.features[fIdx];
        if (!feat.geometry) continue;
        const g = feat.geometry;
        const polys =
          g.type === 'Polygon'
            ? [g.coordinates]
            : g.type === 'MultiPolygon'
              ? g.coordinates
              : [];
        for (const poly of polys) {
          if (!poly[0]) continue;
          const screenRing = poly[0].map((pt) => toScreen(pt[0], pt[1]));
          if (isPointInRing(clickX, clickY, screenRing)) {
            return {
              layerId: layer.id,
              featureIndex: fIdx,
              layerName: layer.name,
              geometryType: g.type,
              properties: (feat.properties as Record<string, unknown>) ?? {},
            };
          }
        }
      }
    }

    return undefined;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      startCenterX: lonToWorldX(center.lon, zoom),
      startCenterY: latToWorldY(center.lat, zoom),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.dragging) {
      const rawDx = e.clientX - dragRef.current.startX;
      const rawDy = e.clientY - dragRef.current.startY;
      if (Math.hypot(rawDx, rawDy) > 4) {
        dragRef.current.moved = true;
      }
      const rad = (bearing * Math.PI) / 180;
      const dx = bearing === 0 ? rawDx : rawDx * Math.cos(rad) - rawDy * Math.sin(rad);
      const dy = bearing === 0 ? rawDy : rawDx * Math.sin(rad) + rawDy * Math.cos(rad);
      const nextLon = worldXToLon(dragRef.current.startCenterX - dx, zoom);
      const nextLat = Math.max(-85, Math.min(85, worldYToLat(dragRef.current.startCenterY - dy, zoom)));
      onCenterZoomChange(nextLat, ((nextLon + 540) % 360) - 180, zoom);
      return;
    }

    const pos = screenToLatLon(e.clientX, e.clientY);
    if (pos) onCursorMove(pos.lat, pos.lon);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current?.moved ?? false;
    dragRef.current = null;
    if (!wasMoved) {
      const pos = screenToLatLon(e.clientX, e.clientY);
      if (!pos) return;
      const canvas = canvasRef.current;
      if (canvas && toolMode === 'inspect') {
        const rect = canvas.getBoundingClientRect();
        const [clickX, clickY] = unrotatePoint(
          e.clientX - rect.left,
          e.clientY - rect.top,
          rect.width,
          rect.height
        );
        const centerWorldX = lonToWorldX(center.lon, zoom);
        const centerWorldY = latToWorldY(center.lat, zoom);
        const topLeftX = centerWorldX - rect.width / 2;
        const topLeftY = centerWorldY - rect.height / 2;
        const hit = hitTestFeatures(clickX, clickY, topLeftX, topLeftY);
        if (hit) {
          onMapClick(pos.lat, pos.lon, hit);
          return;
        }
      }
      onMapClick(pos.lat, pos.lon);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.5 : -0.5;
    const nextZoom = Math.max(2, Math.min(18, Number((zoom + delta).toFixed(2))));
    onCenterZoomChange(center.lat, center.lon, nextZoom);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className="w-full h-full block touch-none cursor-crosshair"
    />
  );
};

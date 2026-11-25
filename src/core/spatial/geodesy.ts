import type { Feature, FeatureCollection, Polygon } from 'geojson';
import { INDONESIA_UTM_ZONES } from '../coordinates/indonesiaUtmZones';
import {
  DEFAULT_LAYER_SYMBOLOGY,
  GeoLayer,
  LayerSymbology,
} from '../project/projectDefinition';

const EARTH_RADIUS_M = 6371008.8;

export type LngLatTuple = [number, number];

export function haversineDistanceMeters(a: LngLatTuple, b: LngLatTuple): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function polylineDistanceMeters(coords: LngLatTuple[]): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistanceMeters(coords[i - 1], coords[i]);
  }
  return total;
}

export function initialBearingDegrees(a: LngLatTuple, b: LngLatTuple): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function compassDirectionId(bearingDeg: number): string {
  const dirs = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'];
  return dirs[Math.round(bearingDeg / 45) % 8];
}

/**
 * Geodesic polygon area on a sphere (Chamberlain-Duquette algorithm).
 */
export function polygonAreaSquareMeters(coords: LngLatTuple[]): number {
  if (coords.length < 3) return 0;
  const closed =
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];

  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [lon1, lat1] = closed[i];
    const [lon2, lat2] = closed[i + 1];
    const p1Lon = (lon1 * Math.PI) / 180;
    const p1Lat = (lat1 * Math.PI) / 180;
    const p2Lon = (lon2 * Math.PI) / 180;
    const p2Lat = (lat2 * Math.PI) / 180;
    total += (p2Lon - p1Lon) * (2 + Math.sin(p1Lat) + Math.sin(p2Lat));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function polygonPerimeterMeters(coords: LngLatTuple[]): number {
  if (coords.length < 2) return 0;
  const closed =
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];
  return polylineDistanceMeters(closed);
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(3)} km`;
  }
  return `${meters.toFixed(1)} m`;
}

export function formatArea(sqMeters: number): string {
  if (sqMeters >= 1_000_000) {
    return `${(sqMeters / 1_000_000).toFixed(3)} km² (${(sqMeters / 10_000).toFixed(2)} ha)`;
  }
  if (sqMeters >= 10_000) {
    return `${(sqMeters / 10_000).toFixed(3)} ha`;
  }
  return `${sqMeters.toFixed(1)} m²`;
}

/**
 * Generates a geodesic circular buffer polygon around a coordinate.
 */
export function createPointBufferPolygon(
  centerLon: number,
  centerLat: number,
  radiusMeters: number,
  label: string,
  steps = 48
): Feature<Polygon> {
  const latRad = (centerLat * Math.PI) / 180;
  const lonRad = (centerLon * Math.PI) / 180;
  const angularDist = radiusMeters / EARTH_RADIUS_M;

  const ring: LngLatTuple[] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) +
        Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing)
    );
    const destLon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
        Math.cos(angularDist) - Math.sin(latRad) * Math.sin(destLat)
      );
    ring.push([
      Number(((destLon * 180) / Math.PI).toFixed(6)),
      Number(((destLat * 180) / Math.PI).toFixed(6)),
    ]);
  }

  return {
    type: 'Feature',
    properties: {
      name: `Buffer ${formatDistance(radiusMeters)} — ${label}`,
      radius_m: radiusMeters,
      area_ha: Number((polygonAreaSquareMeters(ring) / 10000).toFixed(2)),
    },
    geometry: {
      type: 'Polygon',
      coordinates: [ring],
    },
  };
}

export function computeFeatureCollectionBounds(
  fc: FeatureCollection
): [[number, number], [number, number]] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visitCoords = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const lon = coords[0];
      const lat = coords[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      coords.forEach(visitCoords);
    }
  };

  fc.features.forEach((f) => {
    if (f.geometry && 'coordinates' in f.geometry) {
      visitCoords(f.geometry.coordinates);
    }
  });

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) {
    return null;
  }

  if (minLon === maxLon && minLat === maxLat) {
    return [
      [minLon - 0.02, minLat - 0.02],
      [maxLon + 0.02, maxLat + 0.02],
    ];
  }

  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

export function computeSingleFeatureBounds(
  feature: Feature
): [[number, number], [number, number]] | null {
  const bounds = computeFeatureCollectionBounds({
    type: 'FeatureCollection',
    features: [feature],
  });
  if (!bounds) return null;
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  if (feature.geometry?.type === 'Point') {
    return [
      [minLon - 0.004, minLat - 0.004],
      [maxLon + 0.004, maxLat + 0.004],
    ];
  }
  return bounds;
}

export function normalizeLayerSymbology(layer?: Pick<GeoLayer, 'symbology'> | null): LayerSymbology {
  const s = layer?.symbology;
  return {
    pointShape: s?.pointShape ?? DEFAULT_LAYER_SYMBOLOGY.pointShape,
    pointSize:
      typeof s?.pointSize === 'number' && Number.isFinite(s.pointSize)
        ? Math.max(3, Math.min(16, s.pointSize))
        : DEFAULT_LAYER_SYMBOLOGY.pointSize,
    lineWidth:
      typeof s?.lineWidth === 'number' && Number.isFinite(s.lineWidth)
        ? Math.max(1, Math.min(10, s.lineWidth))
        : DEFAULT_LAYER_SYMBOLOGY.lineWidth,
    lineDash: s?.lineDash ?? DEFAULT_LAYER_SYMBOLOGY.lineDash,
  };
}

export function buildIndonesiaUtmGridGeoJson(): FeatureCollection {
  const features: Feature[] = [];
  const minLat = -12;
  const maxLat = 8;

  // Vertical zone boundaries 90°..144° BT
  for (let lon = 90; lon <= 144; lon += 6) {
    features.push({
      type: 'Feature',
      properties: { kind: 'meridian', label: `${lon}° BT` },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon, minLat],
          [lon, maxLat],
        ],
      },
    });
  }

  // Equator separating 326xx (North) and 327xx (South)
  features.push({
    type: 'Feature',
    properties: { kind: 'equator', label: 'Khatulistiwa (0°)' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [90, 0],
        [144, 0],
      ],
    },
  });

  // Zone center labels (North & South)
  INDONESIA_UTM_ZONES.forEach((z) => {
    features.push({
      type: 'Feature',
      properties: {
        kind: 'zone-label',
        label: `Z${z.number}N · ${32600 + z.number}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [z.centralMeridian, 4.5],
      },
    });
    features.push({
      type: 'Feature',
      properties: {
        kind: 'zone-label',
        label: `Z${z.number}S · ${32700 + z.number}`,
      },
      geometry: {
        type: 'Point',
        coordinates: [z.centralMeridian, -4.5],
      },
    });
  });

  return { type: 'FeatureCollection', features };
}

export function findNearestVertex(
  target: LngLatTuple,
  layerCoordsList: LngLatTuple[][],
  maxDegreesThreshold: number
): LngLatTuple | null {
  let bestCoord: LngLatTuple | null = null;
  let bestDist = maxDegreesThreshold;

  for (const list of layerCoordsList) {
    for (const pt of list) {
      const dist = Math.hypot(pt[0] - target[0], pt[1] - target[1]);
      if (dist <= bestDist) {
        bestDist = dist;
        bestCoord = [pt[0], pt[1]];
      }
    }
  }
  return bestCoord;
}

export function extractVerticesFromFeatureCollection(fc: FeatureCollection): LngLatTuple[] {
  const vertices: LngLatTuple[] = [];
  const visit = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      vertices.push([coords[0], coords[1]]);
    } else {
      coords.forEach(visit);
    }
  };
  fc.features.forEach((f) => {
    if (f.geometry && 'coordinates' in f.geometry) {
      visit(f.geometry.coordinates);
    }
  });
  return vertices;
}

export function isPointInGeoRing(point: LngLatTuple, ring: LngLatTuple[]): boolean {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getFeatureTestPoints(feature: Feature): LngLatTuple[] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Point') return [g.coordinates as LngLatTuple];
  if (g.type === 'MultiPoint') return g.coordinates as LngLatTuple[];
  if (g.type === 'LineString') return g.coordinates as LngLatTuple[];
  if (g.type === 'MultiLineString') return g.coordinates.flat() as LngLatTuple[];
  if (g.type === 'Polygon') {
    const outer = (g.coordinates[0] ?? []) as LngLatTuple[];
    if (outer.length === 0) return [];
    const avgLon = outer.reduce((s, p) => s + p[0], 0) / outer.length;
    const avgLat = outer.reduce((s, p) => s + p[1], 0) / outer.length;
    return [[avgLon, avgLat], ...outer];
  }
  if (g.type === 'MultiPolygon') {
    const pts: LngLatTuple[] = [];
    g.coordinates.forEach((poly) => {
      const outer = (poly[0] ?? []) as LngLatTuple[];
      if (outer.length > 0) {
        const avgLon = outer.reduce((s, p) => s + p[0], 0) / outer.length;
        const avgLat = outer.reduce((s, p) => s + p[1], 0) / outer.length;
        pts.push([avgLon, avgLat], ...outer);
      }
    });
    return pts;
  }
  return [];
}

function isPointInsideMaskCollection(pt: LngLatTuple, maskFc: FeatureCollection): boolean {
  for (const maskFeat of maskFc.features) {
    const g = maskFeat.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      const outer = (g.coordinates[0] ?? []) as LngLatTuple[];
      if (outer.length >= 3 && isPointInGeoRing(pt, outer)) {
        const inHole = g.coordinates
          .slice(1)
          .some((hole) => isPointInGeoRing(pt, hole as LngLatTuple[]));
        if (!inHole) return true;
      }
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        const outer = (poly[0] ?? []) as LngLatTuple[];
        if (outer.length >= 3 && isPointInGeoRing(pt, outer)) {
          const inHole = poly
            .slice(1)
            .some((hole) => isPointInGeoRing(pt, hole as LngLatTuple[]));
          if (!inHole) return true;
        }
      }
    }
  }
  return false;
}

export function selectFeaturesInsideMask(
  sourceFc: FeatureCollection,
  maskFc: FeatureCollection
): FeatureCollection {
  const matched = sourceFc.features.filter((feat) => {
    const pts = getFeatureTestPoints(feat);
    return pts.some((pt) => isPointInsideMaskCollection(pt, maskFc));
  });
  return {
    type: 'FeatureCollection',
    features: matched.map((f) => ({
      ...f,
      properties: { ...(f.properties ?? {}) },
    })),
  };
}

export interface GeometryIssue {
  featureIndex: number;
  geometryType: string;
  issue: string;
}

export function validateFeatureCollectionGeometries(fc: FeatureCollection): GeometryIssue[] {
  const issues: GeometryIssue[] = [];

  fc.features.forEach((feat, idx) => {
    const g = feat.geometry;
    if (!g) {
      issues.push({ featureIndex: idx, geometryType: 'Null', issue: 'Geometri kosong' });
      return;
    }

    const hasBadCoords = (coords: unknown): boolean => {
      if (!Array.isArray(coords)) return true;
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const [lon, lat] = coords;
        return (
          !Number.isFinite(lon) ||
          !Number.isFinite(lat) ||
          lon < -180 ||
          lon > 180 ||
          lat < -90 ||
          lat > 90
        );
      }
      return coords.some(hasBadCoords);
    };

    if ('coordinates' in g && hasBadCoords(g.coordinates)) {
      issues.push({
        featureIndex: idx,
        geometryType: g.type,
        issue: 'Koordinat NaN atau di luar batas bumi',
      });
    }

    if (g.type === 'LineString') {
      if (g.coordinates.length < 2) {
        issues.push({
          featureIndex: idx,
          geometryType: g.type,
          issue: 'Garis memiliki kurang dari 2 simpul',
        });
      }
      for (let i = 1; i < g.coordinates.length; i++) {
        if (
          g.coordinates[i][0] === g.coordinates[i - 1][0] &&
          g.coordinates[i][1] === g.coordinates[i - 1][1]
        ) {
          issues.push({
            featureIndex: idx,
            geometryType: g.type,
            issue: 'Terdapat simpul duplikat berurutan',
          });
          break;
        }
      }
    }

    if (g.type === 'Polygon') {
      const ring = g.coordinates[0] ?? [];
      if (ring.length < 4) {
        issues.push({
          featureIndex: idx,
          geometryType: g.type,
          issue: 'Ring poligon kurang dari 4 titik',
        });
      } else {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          issues.push({
            featureIndex: idx,
            geometryType: g.type,
            issue: 'Ring poligon belum tertutup sempurna',
          });
        }
      }
    }
  });

  return issues;
}

function dedupeRingOrLine(coords: number[][]): number[][] {
  const result: number[][] = [];
  for (const pt of coords) {
    if (
      !Number.isFinite(pt[0]) ||
      !Number.isFinite(pt[1]) ||
      pt[0] < -180 ||
      pt[0] > 180 ||
      pt[1] < -90 ||
      pt[1] > 90
    ) {
      continue;
    }
    const prev = result[result.length - 1];
    if (!prev || prev[0] !== pt[0] || prev[1] !== pt[1]) {
      result.push([pt[0], pt[1]]);
    }
  }
  return result;
}

export function repairFeatureCollectionGeometries(fc: FeatureCollection): FeatureCollection {
  const repairedFeatures: Feature[] = [];

  for (const feat of fc.features) {
    const g = feat.geometry;
    if (!g) continue;

    if (g.type === 'LineString') {
      const cleaned = dedupeRingOrLine(g.coordinates);
      if (cleaned.length >= 2) {
        repairedFeatures.push({
          ...feat,
          geometry: { type: 'LineString', coordinates: cleaned },
        });
      }
    } else if (g.type === 'Polygon') {
      const cleanedRings = g.coordinates
        .map((ring) => {
          const deduped = dedupeRingOrLine(ring);
          if (deduped.length < 3) return null;
          const first = deduped[0];
          const last = deduped[deduped.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            deduped.push([first[0], first[1]]);
          }
          return deduped;
        })
        .filter((r): r is number[][] => r !== null && r.length >= 4);

      if (cleanedRings.length > 0) {
        repairedFeatures.push({
          ...feat,
          geometry: { type: 'Polygon', coordinates: cleanedRings },
        });
      }
    } else {
      repairedFeatures.push(feat);
    }
  }

  return {
    type: 'FeatureCollection',
    features: repairedFeatures,
  };
}

export interface ElevationSlopeSegment {
  label: string;
  elevationM: number;
  cumulativeDistanceM: number;
  segmentDistanceM: number;
  deltaElevationM: number;
  slopePercent: number;
  slopeDegrees: number;
}

export function computeElevationSlopeProfile(
  points: { label: string; latitude: number; longitude: number; elevationM?: number | null }[]
): ElevationSlopeSegment[] {
  const valid = points.filter(
    (p): p is { label: string; latitude: number; longitude: number; elevationM: number } =>
      typeof p.elevationM === 'number' && Number.isFinite(p.elevationM)
  );
  if (valid.length === 0) return [];

  let cumulativeDistanceM = 0;
  return valid.map((pt, index) => {
    if (index === 0) {
      return {
        label: pt.label,
        elevationM: pt.elevationM,
        cumulativeDistanceM: 0,
        segmentDistanceM: 0,
        deltaElevationM: 0,
        slopePercent: 0,
        slopeDegrees: 0,
      };
    }
    const prev = valid[index - 1];
    const segDist = haversineDistanceMeters(
      [prev.longitude, prev.latitude],
      [pt.longitude, pt.latitude]
    );
    cumulativeDistanceM += segDist;
    const deltaElev = pt.elevationM - prev.elevationM;
    const slopePercent = segDist > 0.1 ? (deltaElev / segDist) * 100 : 0;
    const slopeDegrees =
      segDist > 0.1 ? (Math.atan2(deltaElev, segDist) * 180) / Math.PI : 0;

    return {
      label: pt.label,
      elevationM: pt.elevationM,
      cumulativeDistanceM,
      segmentDistanceM: segDist,
      deltaElevationM: deltaElev,
      slopePercent,
      slopeDegrees,
    };
  });
}

import { kml, gpx } from '@tmcw/togeojson';
import type { Feature, FeatureCollection, GeoJsonObject } from 'geojson';
import JSZip from 'jszip';
import shp from 'shpjs';
import { epsgFor, formatUtmZoneLabel } from '../coordinates/indonesiaUtmZones';
import { formatDistance, LngLatTuple, polylineDistanceMeters } from '../spatial/geodesy';

export interface SurveyWaypoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  elevationM?: number | null;
  accuracyM?: number | null;
  category?: string;
  note?: string;
  recordedAt: string;
}

function escapeCsv(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function waypointsToCsv(
  waypoints: SurveyWaypoint[],
  trackPoints: LngLatTuple[] = []
): string {
  const header =
    'id,label,latitude,longitude,utm_zone,epsg,elevation_m,accuracy_m,category,note,recorded_at';
  if (waypoints.length === 0 && trackPoints.length < 2) return header;

  const rows = waypoints.map((wp) => {
    const lat = wp.latitude.toFixed(6);
    const lon = wp.longitude.toFixed(6);
    const epsg = epsgFor(wp.latitude, wp.longitude);
    const zoneLabel = formatUtmZoneLabel(wp.latitude, wp.longitude);
    return [
      escapeCsv(wp.id),
      escapeCsv(wp.label),
      lat,
      lon,
      escapeCsv(zoneLabel),
      epsg ? String(epsg) : '',
      wp.elevationM != null ? wp.elevationM.toFixed(1) : '',
      wp.accuracyM != null ? wp.accuracyM.toFixed(1) : '',
      escapeCsv(wp.category ?? 'Survei'),
      escapeCsv(wp.note ?? ''),
      escapeCsv(wp.recordedAt),
    ].join(',');
  });

  if (trackPoints.length >= 2) {
    const totalDistLabel = formatDistance(polylineDistanceMeters(trackPoints));
    trackPoints.forEach(([lon, lat], idx) => {
      const epsg = epsgFor(lat, lon);
      const zoneLabel = formatUtmZoneLabel(lat, lon);
      rows.push(
        [
          `TRK-${String(idx + 1).padStart(3, '0')}`,
          escapeCsv(`Jalur Perjalanan #${idx + 1}`),
          lat.toFixed(6),
          lon.toFixed(6),
          escapeCsv(zoneLabel),
          epsg ? String(epsg) : '',
          '',
          '',
          'Track GNSS',
          escapeCsv(`Total jarak jalur: ${totalDistLabel}`),
          '',
        ].join(',')
      );
    });
  }

  return [header, ...rows].join('\n');
}

export function waypointsToGeoJson(
  waypoints: SurveyWaypoint[],
  trackPoints: LngLatTuple[] = []
): FeatureCollection {
  const features: Feature[] = waypoints.map((wp) => {
    const epsg = epsgFor(wp.latitude, wp.longitude);
    const zoneLabel = formatUtmZoneLabel(wp.latitude, wp.longitude);
    return {
      type: 'Feature',
      properties: {
        id: wp.id,
        label: wp.label,
        latitude: Number(wp.latitude.toFixed(6)),
        longitude: Number(wp.longitude.toFixed(6)),
        utm_zone: zoneLabel,
        epsg,
        elevation_m: wp.elevationM ?? null,
        accuracy_m: wp.accuracyM ?? null,
        category: wp.category ?? 'Survei',
        note: wp.note ?? '',
        recorded_at: wp.recordedAt,
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(wp.longitude.toFixed(6)), Number(wp.latitude.toFixed(6))],
      },
    };
  });

  if (trackPoints.length >= 2) {
    const distMeters = polylineDistanceMeters(trackPoints);
    features.push({
      type: 'Feature',
      properties: {
        id: 'track-gnss',
        label: 'Jalur Perjalanan GNSS',
        tipe: 'track',
        jumlah_titik: trackPoints.length,
        jarak_m: Number(distMeters.toFixed(2)),
        jarak_label: formatDistance(distMeters),
      },
      geometry: {
        type: 'LineString',
        coordinates: trackPoints.map(([lon, lat]) => [
          Number(lon.toFixed(6)),
          Number(lat.toFixed(6)),
        ]),
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function waypointsToGpx(
  waypoints: SurveyWaypoint[],
  projectName = 'D H Y Explorer Survey',
  trackPoints: LngLatTuple[] = []
): string {
  const escXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const wpts = waypoints
    .map((wp) => {
      const eleTag = wp.elevationM != null ? `\n    <ele>${wp.elevationM.toFixed(2)}</ele>` : '';
      const descTag = wp.note ? `\n    <desc>${escXml(wp.note)}</desc>` : '';
      return `  <wpt lat="${wp.latitude.toFixed(6)}" lon="${wp.longitude.toFixed(6)}">${eleTag}\n    <time>${escXml(wp.recordedAt)}</time>\n    <name>${escXml(wp.label)}</name>${descTag}\n  </wpt>`;
    })
    .join('\n');

  const trkBlock =
    trackPoints.length >= 2
      ? `\n  <trk>\n    <name>Jalur Perjalanan (${escXml(formatDistance(polylineDistanceMeters(trackPoints)))})</name>\n    <trkseg>\n${trackPoints
          .map(([lon, lat]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}" />`)
          .join('\n')}\n    </trkseg>\n  </trk>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="D H Y Explorer GIS Indonesia" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escXml(projectName)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}${trkBlock}
</gpx>`;
}

export function extractFeatureLatLon(feature: Feature): { lat: number; lon: number } | null {
  const g = feature.geometry;
  if (!g) return null;
  if (g.type === 'Point') {
    return { lon: g.coordinates[0], lat: g.coordinates[1] };
  }
  const coords: LngLatTuple[] = [];
  const visit = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      coords.push([arr[0], arr[1]]);
    } else {
      arr.forEach(visit);
    }
  };
  if ('coordinates' in g) {
    visit(g.coordinates);
  }
  if (coords.length === 0) return null;
  const sum = coords.reduce(
    (acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }),
    { lon: 0, lat: 0 }
  );
  return {
    lon: sum.lon / coords.length,
    lat: sum.lat / coords.length,
  };
}

function normalizeToFeatureCollection(obj: GeoJsonObject): FeatureCollection {
  if (obj.type === 'FeatureCollection') {
    return obj as FeatureCollection;
  }
  if (obj.type === 'Feature') {
    return { type: 'FeatureCollection', features: [obj as Feature] };
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: obj as Feature['geometry'],
      },
    ],
  };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsvToFeatureCollection(text: string): FeatureCollection {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('Berkas CSV tidak memiliki baris data.');
  }

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, '').trim());
  const lowerHeaders = headers.map((h) => h.toLowerCase());

  const latIdx = lowerHeaders.findIndex((h) =>
    ['lat', 'latitude', 'y', 'lintang', 'northing_deg'].includes(h)
  );
  const lonIdx = lowerHeaders.findIndex((h) =>
    ['lon', 'lng', 'long', 'longitude', 'x', 'bujur'].includes(h)
  );

  if (latIdx === -1 || lonIdx === -1) {
    throw new Error('Kolom koordinat (latitude/lat dan longitude/lon/lng) tidak ditemukan pada CSV.');
  }

  const features: Feature[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const lat = Number.parseFloat(cols[latIdx]?.replace(',', '.'));
    const lon = Number.parseFloat(cols[lonIdx]?.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const props: Record<string, string | number | null> = {};
    headers.forEach((h, idx) => {
      props[h] = cols[idx] ?? '';
    });

    features.push({
      type: 'Feature',
      properties: props,
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
    });
  }

  if (features.length === 0) {
    throw new Error('Tidak ada baris dengan pasangan koordinat valid pada CSV.');
  }

  return { type: 'FeatureCollection', features };
}

export interface ImportedVectorResult {
  name: string;
  format: 'GeoJSON' | 'KML' | 'KMZ' | 'GPX' | 'SHP' | 'CSV';
  data: FeatureCollection;
}

export async function importVectorFile(file: File): Promise<ImportedVectorResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const baseName = file.name.replace(/\.[^.]+$/, '');

  if (ext === 'geojson' || ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text) as GeoJsonObject;
    return {
      name: baseName,
      format: 'GeoJSON',
      data: normalizeToFeatureCollection(parsed),
    };
  }

  if (ext === 'kml') {
    const text = await file.text();
    const dom = new DOMParser().parseFromString(text, 'text/xml');
    const fc = kml(dom);
    return {
      name: baseName,
      format: 'KML',
      data: normalizeToFeatureCollection(fc),
    };
  }

  if (ext === 'kmz') {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const kmlFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.kml'));
    if (!kmlFile) {
      throw new Error('Arsip KMZ tidak mengandung berkas .kml.');
    }
    const text = await kmlFile.async('string');
    const dom = new DOMParser().parseFromString(text, 'text/xml');
    const fc = kml(dom);
    return {
      name: baseName,
      format: 'KMZ',
      data: normalizeToFeatureCollection(fc),
    };
  }

  if (ext === 'gpx') {
    const text = await file.text();
    const dom = new DOMParser().parseFromString(text, 'text/xml');
    const fc = gpx(dom);
    return {
      name: baseName,
      format: 'GPX',
      data: normalizeToFeatureCollection(fc),
    };
  }

  if (ext === 'zip') {
    const buffer = await file.arrayBuffer();
    const result = await shp(buffer);
    const merged: Feature[] = [];
    if (Array.isArray(result)) {
      result.forEach((fc) => {
        if (fc.features) merged.push(...fc.features);
      });
    } else if (result?.features) {
      merged.push(...result.features);
    }
    if (merged.length === 0) {
      throw new Error('Arsip ZIP Shapefile tidak memuat fitur geometri.');
    }
    return {
      name: baseName,
      format: 'SHP',
      data: { type: 'FeatureCollection', features: merged },
    };
  }

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    return {
      name: baseName,
      format: 'CSV',
      data: parseCsvToFeatureCollection(text),
    };
  }

  throw new Error(
    `Format .${ext || '?'} belum didukung. Gunakan GeoJSON, KML, KMZ, GPX, Shapefile (.zip), atau CSV.`
  );
}

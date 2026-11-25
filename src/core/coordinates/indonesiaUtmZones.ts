export interface UtmZone {
  number: number;
  westLongitude: number;
  eastLongitude: number;
  centralMeridian: number;
}

export interface UtmCoordinate {
  zone: number;
  hemisphere: 'N' | 'S';
  epsg: number;
  easting: number;
  northing: number;
  centralMeridian: number;
  scaleFactor: number;
}

export interface CoordinateBenchmark {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_K0 = 0.9996;

export const INDONESIA_UTM_ZONES: UtmZone[] = [
  { number: 46, westLongitude: 90.0, eastLongitude: 96.0, centralMeridian: 93.0 },
  { number: 47, westLongitude: 96.0, eastLongitude: 102.0, centralMeridian: 99.0 },
  { number: 48, westLongitude: 102.0, eastLongitude: 108.0, centralMeridian: 105.0 },
  { number: 49, westLongitude: 108.0, eastLongitude: 114.0, centralMeridian: 111.0 },
  { number: 50, westLongitude: 114.0, eastLongitude: 120.0, centralMeridian: 117.0 },
  { number: 51, westLongitude: 120.0, eastLongitude: 126.0, centralMeridian: 123.0 },
  { number: 52, westLongitude: 126.0, eastLongitude: 132.0, centralMeridian: 129.0 },
  { number: 53, westLongitude: 132.0, eastLongitude: 138.0, centralMeridian: 135.0 },
  { number: 54, westLongitude: 138.0, eastLongitude: 144.0, centralMeridian: 141.0 },
];

export const INDONESIA_UTM_BENCHMARKS: CoordinateBenchmark[] = [
  { name: 'Sabang', region: 'Aceh (Zona 46N)', latitude: 5.8934, longitude: 95.3214 },
  { name: 'Batam', region: 'Kepulauan Riau (Zona 48N)', latitude: 1.0, longitude: 103.0 },
  { name: 'Jakarta', region: 'DKI Jakarta (Zona 48S)', latitude: -6.1754, longitude: 106.8272 },
  { name: 'Balikpapan', region: 'Kalimantan Timur (Zona 50S)', latitude: -1.2379, longitude: 116.8529 },
  { name: 'Makassar', region: 'Sulawesi Selatan (Zona 50S)', latitude: -5.1, longitude: 119.0 },
  { name: 'Ambon', region: 'Maluku (Zona 52S)', latitude: -3.6954, longitude: 128.1814 },
  { name: 'Timika', region: 'Papua Tengah (Zona 53S)', latitude: -4.0, longitude: 135.0 },
  { name: 'Merauke', region: 'Papua Selatan (Zona 54S)', latitude: -8.0, longitude: 140.0 },
];

export function zoneFor(longitude: number): UtmZone | null {
  if (!Number.isFinite(longitude) || longitude < 90.0 || longitude > 144.0) {
    return null;
  }
  return (
    INDONESIA_UTM_ZONES.find(
      (z) =>
        longitude >= z.westLongitude &&
        (longitude < z.eastLongitude || (z.number === 54 && longitude <= z.eastLongitude))
    ) ?? null
  );
}

export function epsgForZone(zoneNumber: number, isNorthernHemisphere: boolean): number {
  return (isNorthernHemisphere ? 32600 : 32700) + zoneNumber;
}

/**
 * Returns the WGS 84 / UTM EPSG code for coordinates inside Indonesia's starter coverage
 * (90°–144° BT, -80° to 84° latitude).
 */
export function epsgFor(latitude: number, longitude: number): number | null {
  if (!Number.isFinite(latitude) || latitude < -80.0 || latitude > 84.0) {
    return null;
  }
  const zone = zoneFor(longitude);
  if (!zone) return null;
  return epsgForZone(zone.number, latitude >= 0.0);
}

export function formatUtmZoneLabel(latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || latitude < -80.0 || latitude > 84.0) {
    return 'Di luar rentang lintang UTM';
  }
  const zone = zoneFor(longitude);
  if (!zone) {
    return 'Di luar cakupan starter (90°–144° BT)';
  }
  const hemi = latitude >= 0.0 ? 'N' : 'S';
  return `Zona ${zone.number}${hemi}`;
}

/**
 * Standard global UTM zone calculation (1–60) + WGS 84 Transverse Mercator projection
 * so Easting & Northing coordinates are accurate even outside Indonesia's 46–54 filter.
 */
export function latLonToUtm(
  latitude: number,
  longitude: number,
  forcedZone?: number
): UtmCoordinate | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -80.0 ||
    latitude > 84.0 ||
    longitude < -180.0 ||
    longitude > 180.0
  ) {
    return null;
  }

  const normalizedLon = longitude === 180.0 ? -180.0 : longitude;
  const zone = forcedZone ?? Math.floor((normalizedLon + 180.0) / 6.0) + 1;
  const centralMeridian = (zone - 1) * 6 - 180 + 3;

  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  const lon0Rad = (centralMeridian * Math.PI) / 180;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = WGS84_EP2 * cosLat * cosLat;
  const aVal = cosLat * (lonRad - lon0Rad);

  const e4 = WGS84_E2 * WGS84_E2;
  const e6 = e4 * WGS84_E2;

  const m =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latRad -
      ((3 * WGS84_E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * latRad) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latRad) -
      ((35 * e6) / 3072) * Math.sin(6 * latRad));

  const easting =
    UTM_K0 *
      n *
      (aVal +
        ((1 - t + c) * Math.pow(aVal, 3)) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * WGS84_EP2) * Math.pow(aVal, 5)) / 120) +
    500000.0;

  let northing =
    UTM_K0 *
    (m +
      n *
        tanLat *
        ((aVal * aVal) / 2 +
          ((5 - t + 9 * c + 4 * c * c) * Math.pow(aVal, 4)) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * WGS84_EP2) * Math.pow(aVal, 6)) / 720));

  const isNorthern = latitude >= 0.0;
  if (!isNorthern) {
    northing += 10000000.0;
  }

  const scaleFactor =
    UTM_K0 *
    (1 +
      ((1 + c) * aVal * aVal) / 2 +
      ((5 - 4 * t + 42 * c + 13 * c * c - 28 * WGS84_EP2) * Math.pow(aVal, 4)) / 24);

  return {
    zone,
    hemisphere: isNorthern ? 'N' : 'S',
    epsg: epsgForZone(zone, isNorthern),
    easting,
    northing,
    centralMeridian,
    scaleFactor,
  };
}

export function utmToLatLon(
  easting: number,
  northing: number,
  zone: number,
  isNorthern: boolean
): { latitude: number; longitude: number } | null {
  if (
    !Number.isFinite(easting) ||
    !Number.isFinite(northing) ||
    !Number.isFinite(zone) ||
    zone < 1 ||
    zone > 60
  ) {
    return null;
  }

  const x = easting - 500000.0;
  const y = isNorthern ? northing : northing - 10000000.0;

  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const e4 = WGS84_E2 * WGS84_E2;
  const e6 = e4 * WGS84_E2;

  const m = y / UTM_K0;
  const mu = m / (WGS84_A * (1 - WGS84_E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
    ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu) +
    ((1097 * Math.pow(e1, 4)) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1Rad);
  const cosPhi1 = Math.cos(phi1Rad);
  const tanPhi1 = Math.tan(phi1Rad);

  const n1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi1 * sinPhi1);
  const t1 = tanPhi1 * tanPhi1;
  const c1 = WGS84_EP2 * cosPhi1 * cosPhi1;
  const r1 = (WGS84_A * (1 - WGS84_E2)) / Math.pow(1 - WGS84_E2 * sinPhi1 * sinPhi1, 1.5);
  const d = x / (n1 * UTM_K0);

  const latRad =
    phi1Rad -
    ((n1 * tanPhi1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * WGS84_EP2) * Math.pow(d, 4)) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * WGS84_EP2 - 3 * c1 * c1) *
          Math.pow(d, 6)) /
          720);

  const lonOrigin = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const lonRad =
    lonOrigin +
    (d -
      ((1 + 2 * t1 + c1) * Math.pow(d, 3)) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * WGS84_EP2 + 24 * t1 * t1) * Math.pow(d, 5)) /
        120) /
      cosPhi1;

  return {
    latitude: (latRad * 180) / Math.PI,
    longitude: (lonRad * 180) / Math.PI,
  };
}

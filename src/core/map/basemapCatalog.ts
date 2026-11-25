import type { StyleSpecification } from 'maplibre-gl';

export const MAP_LIBRE_CONFIG = {
  DEFAULT_LATITUDE: -2.5,
  DEFAULT_LONGITUDE: 118.0,
  DEFAULT_ZOOM: 4.2,
  DEFAULT_STYLE_URL: 'https://demotiles.maplibre.org/style.json',
} as const;

export const OFFLINE_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: 'D H Y Explorer Offline Canvas',
  sources: {},
  layers: [
    {
      id: 'geoexplorer-background',
      type: 'background',
      paint: {
        'background-color': '#DCE8F5',
      },
    },
  ],
};

export interface BasemapSource {
  id: string;
  displayName: string;
  shortLabel: string;
  tileUrlTemplate: string | null;
  styleUri: string | null;
  attribution: string;
  maxZoom: number;
  category: 'satellite' | 'hybrid' | 'street' | 'vector';
}

export const BASEMAP_CATALOG: BasemapSource[] = [
  {
    id: 'esri-satellite',
    displayName: 'Satelit Esri',
    shortLabel: 'Esri Satelit',
    tileUrlTemplate:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    styleUri: null,
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
    category: 'satellite',
  },
  {
    id: 'google-satellite',
    displayName: 'Satelit Google Earth',
    shortLabel: 'Google Earth',
    tileUrlTemplate: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    styleUri: null,
    attribution: 'Google Satellite XYZ',
    maxZoom: 20,
    category: 'satellite',
  },
  {
    id: 'google-hybrid',
    displayName: 'Satelit Google Hybrid',
    shortLabel: 'Google Hybrid',
    tileUrlTemplate: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    styleUri: null,
    attribution: 'Google Hybrid XYZ',
    maxZoom: 20,
    category: 'hybrid',
  },
  {
    id: 'google-roadmap',
    displayName: 'Peta Google Maps',
    shortLabel: 'Google Maps',
    tileUrlTemplate: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    styleUri: null,
    attribution: 'Google Maps XYZ',
    maxZoom: 20,
    category: 'street',
  },
  {
    id: 'osm-map',
    displayName: 'Peta OpenStreetMap',
    shortLabel: 'OpenStreetMap',
    tileUrlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    styleUri: null,
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    category: 'street',
  },
  {
    id: 'maplibre-vector',
    displayName: 'Peta Vektor MapLibre',
    shortLabel: 'MapLibre Vektor',
    tileUrlTemplate: null,
    styleUri: MAP_LIBRE_CONFIG.DEFAULT_STYLE_URL,
    attribution: 'MapLibre Demo Tiles',
    maxZoom: 18,
    category: 'vector',
  },
];

export function buildBasemapStyle(source: BasemapSource): StyleSpecification | string {
  if (source.styleUri) {
    return source.styleUri;
  }
  if (!source.tileUrlTemplate) {
    return OFFLINE_FALLBACK_STYLE;
  }
  return {
    version: 8,
    name: source.displayName,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [source.tileUrlTemplate],
        tileSize: 256,
        maxzoom: source.maxZoom,
        attribution: source.attribution,
      },
    },
    layers: [
      {
        id: 'basemap-raster',
        type: 'raster',
        source: 'basemap',
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  };
}

import type { FeatureCollection } from 'geojson';

export interface ProjectDefinition {
  id: string;
  name: string;
  crsAuthority: string;
  crsCode: number;
  countryScope: string;
  author?: string;
  updatedAt?: string;
}

export function validateProjectDefinition(project: ProjectDefinition): string[] {
  const errors: string[] = [];
  if (!project.id.trim()) errors.push('ID proyek tidak boleh kosong');
  if (!project.name.trim()) errors.push('Nama proyek tidak boleh kosong');
  if (!project.crsAuthority.trim()) errors.push('Otoritas CRS tidak boleh kosong');
  if (!Number.isFinite(project.crsCode) || project.crsCode <= 0) {
    errors.push('Kode CRS harus berupa bilangan positif');
  }
  if (!project.countryScope.trim()) errors.push('Cakupan wilayah tidak boleh kosong');
  return errors;
}

export type PointSymbolShape = 'circle' | 'square' | 'triangle' | 'diamond';
export type LineDashStyle = 'solid' | 'dashed' | 'dotted';

export interface LayerSymbology {
  pointShape: PointSymbolShape;
  pointSize: number;
  lineWidth: number;
  lineDash: LineDashStyle;
}

export const DEFAULT_LAYER_SYMBOLOGY: LayerSymbology = {
  pointShape: 'circle',
  pointSize: 6.5,
  lineWidth: 2.5,
  lineDash: 'solid',
};

export interface GeoLayer {
  id: string;
  name: string;
  sourceFormat:
    | 'GeoJSON'
    | 'KML'
    | 'KMZ'
    | 'GPX'
    | 'SHP'
    | 'CSV'
    | 'Digitasi'
    | 'Buffer'
    | 'Seleksi Spasial';
  visible: boolean;
  opacity: number;
  color: string;
  symbology?: LayerSymbology;
  data: FeatureCollection;
  createdAt: string;
}

export type MapToolMode = 'inspect' | 'add-waypoint' | 'digitize-line' | 'digitize-polygon' | 'measure-distance' | 'measure-area';

export type WorkspaceTab = 'home' | 'map' | 'layers' | 'tools' | 'utm' | 'survey' | 'layout';


import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  epsgFor,
  latLonToUtm,
  utmToLatLon,
  zoneFor,
} from '../coordinates/indonesiaUtmZones';
import {
  computeElevationSlopeProfile,
  computeSingleFeatureBounds,
  createPointBufferPolygon,
  findNearestVertex,
  haversineDistanceMeters,
  normalizeLayerSymbology,
  polygonAreaSquareMeters,
  repairFeatureCollectionGeometries,
  selectFeaturesInsideMask,
  validateFeatureCollectionGeometries,
} from '../spatial/geodesy';
import {
  DEFAULT_LAYER_SYMBOLOGY,
  validateProjectDefinition,
} from '../project/projectDefinition';
import {
  extractFeatureLatLon,
  waypointsToCsv,
  waypointsToGeoJson,
  waypointsToGpx,
} from '../vector/waypointExporter';
import { buildAndroidAndGithubFiles } from '../export/androidGithubExporter';

test('Indonesia UTM zones map Makassar, Timika, Batam, and reject out-of-range longitudes', () => {
  assert.equal(epsgFor(-5.1478, 119.4321), 32750);
  assert.equal(epsgFor(-4.0, 135.0), 32753);
  assert.equal(epsgFor(1.0, 103.0), 32648);
  assert.equal(epsgFor(-5.0, 89.9), null);
  assert.equal(zoneFor(144.1), null);
});

test('WGS 84 <-> UTM round-trip preserves coordinates within 1 meter', () => {
  const utm = latLonToUtm(-5.1478, 119.4321);
  assert.ok(utm);
  assert.equal(utm.epsg, 32750);
  const back = utmToLatLon(utm.easting, utm.northing, utm.zone, utm.hemisphere === 'N');
  assert.ok(back);
  assert.ok(Math.abs(back.latitude - -5.1478) < 0.00001);
  assert.ok(Math.abs(back.longitude - 119.4321) < 0.00001);
});

test('Geodesy distance, buffer, snapping, spatial selection, validation, and slope work accurately', () => {
  const d = haversineDistanceMeters([119.4, -5.1], [119.41, -5.1]);
  assert.ok(d > 1000 && d < 1200);

  const area = polygonAreaSquareMeters([
    [119.4, -5.1],
    [119.41, -5.1],
    [119.41, -5.11],
    [119.4, -5.11],
  ]);
  assert.ok(area > 1_000_000 && area < 1_400_000);

  const buf = createPointBufferPolygon(119.4321, -5.1478, 500, 'Makassar');
  assert.equal(buf.geometry.type, 'Polygon');
  assert.ok(buf.geometry.coordinates[0].length >= 49);

  const snapped = findNearestVertex([119.4322, -5.1479], [[[119.4321, -5.1478]]], 0.001);
  assert.deepEqual(snapped, [119.4321, -5.1478]);

  const maskFc = { type: 'FeatureCollection' as const, features: [buf] };
  const ptsFc = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { name: 'Inside' },
        geometry: { type: 'Point' as const, coordinates: [119.4321, -5.1478] },
      },
      {
        type: 'Feature' as const,
        properties: { name: 'Outside' },
        geometry: { type: 'Point' as const, coordinates: [120.5, -5.1478] },
      },
    ],
  };
  const selected = selectFeaturesInsideMask(ptsFc, maskFc);
  assert.equal(selected.features.length, 1);
  assert.equal(selected.features[0].properties?.name, 'Inside');

  const brokenFc = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [119.4, -5.1],
              [119.41, -5.1],
              [119.41, -5.11],
              [119.4, -5.11],
            ],
          ],
        },
      },
    ],
  };
  const issues = validateFeatureCollectionGeometries(brokenFc);
  assert.equal(issues.length, 1);
  const repaired = repairFeatureCollectionGeometries(brokenFc);
  assert.equal(validateFeatureCollectionGeometries(repaired).length, 0);

  const profile = computeElevationSlopeProfile([
    { label: 'A', latitude: -5.1, longitude: 119.4, elevationM: 10 },
    { label: 'B', latitude: -5.1, longitude: 119.401, elevationM: 20 },
  ]);
  assert.equal(profile.length, 2);
  assert.ok(profile[1].slopePercent > 5);
});

test('Project validation and Waypoint CSV/GeoJSON/GPX exporters handle edge cases', () => {
  assert.equal(
    validateProjectDefinition({
      id: 'p1',
      name: 'Survei',
      crsAuthority: 'EPSG',
      crsCode: 4326,
      countryScope: 'Indonesia',
    }).length,
    0
  );
  assert.ok(
    validateProjectDefinition({
      id: '',
      name: '',
      crsAuthority: '',
      crsCode: 0,
      countryScope: '',
    }).length >= 4
  );

  const sampleWps = [
    {
      id: 'wp-1',
      label: 'Makassar, Pelabuhan',
      latitude: -5.1478,
      longitude: 119.4321,
      elevationM: 5,
      accuracyM: 3,
      category: 'Titik Kontrol',
      note: 'Test',
      recordedAt: '2026-11-25T08:00:00.000Z',
    },
  ];
  const csv = waypointsToCsv(sampleWps);
  assert.ok(csv.includes('"Makassar, Pelabuhan"'));
  assert.ok(csv.includes('32750'));

  const geojson = waypointsToGeoJson(sampleWps);
  assert.equal(geojson.features[0].properties?.epsg, 32750);

  const gpx = waypointsToGpx(sampleWps);
  assert.ok(gpx.includes('D H Y Explorer'));
});

test('Android & GitHub package v0.4.0 includes complete Gradle Wrapper, all tests, and ngek@ credit', () => {
  const files = buildAndroidAndGithubFiles();
  const paths = new Set(files.map((f) => f.path));

  assert.ok(paths.has('android-studio-project/gradlew'));
  assert.ok(paths.has('android-studio-project/gradlew.bat'));
  assert.ok(paths.has('android-studio-project/gradle/wrapper/gradle-wrapper.properties'));
  assert.ok(paths.has('android-studio-project/STATUS_PEMBANGUNAN.md'));
  assert.ok(paths.has('android-studio-project/app/src/test/java/id/geoexplorer/app/core/map/MapLibreConfigTest.kt'));
  assert.ok(paths.has('android-studio-project/app/src/test/java/id/geoexplorer/app/core/project/ProjectDefinitionTest.kt'));

  const gradleApp = files.find((f) => f.path === 'android-studio-project/app/build.gradle.kts')!;
  assert.ok(gradleApp.content.includes('versionCode = 7'));
  assert.ok(gradleApp.content.includes('versionName = "0.4.0"'));

  const readme = files.find((f) => f.path === 'README.md')!;
  assert.ok(readme.content.includes('0.4.0'));
  assert.ok(readme.content.includes('ngek@'));

  // Verify binary gradle-wrapper.jar exists in both workspace android-studio-project and public/android-wrapper
  const jarInAndroid = path.resolve(process.cwd(), 'android-studio-project/gradle/wrapper/gradle-wrapper.jar');
  const jarInPublic = path.resolve(process.cwd(), 'public/android-wrapper/gradle-wrapper.jar');
  assert.ok(fs.existsSync(jarInAndroid), 'gradle-wrapper.jar must exist in android-studio-project');
  assert.ok(fs.existsSync(jarInPublic), 'gradle-wrapper.jar must exist in public/android-wrapper');
  assert.ok(fs.statSync(jarInAndroid).size > 20000);
});

test('Layer symbology normalization and single-feature zoom bounds work correctly', () => {
  const defaultSym = normalizeLayerSymbology({});
  assert.deepEqual(defaultSym, DEFAULT_LAYER_SYMBOLOGY);

  const customSym = normalizeLayerSymbology({
    symbology: {
      pointShape: 'triangle',
      pointSize: 20, // clamps to 16
      lineWidth: 0.2, // clamps to 1
      lineDash: 'dashed',
    },
  });
  assert.equal(customSym.pointShape, 'triangle');
  assert.equal(customSym.pointSize, 16);
  assert.equal(customSym.lineWidth, 1);
  assert.equal(customSym.lineDash, 'dashed');

  const ptBounds = computeSingleFeatureBounds({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [119.4321, -5.1478] },
  });
  assert.ok(ptBounds);
  assert.ok(ptBounds[0][0] < 119.4321 && ptBounds[1][0] > 119.4321);
});

test('Track export (CSV/GeoJSON/GPX) and extractFeatureLatLon work for survey and SHP/KML rows', () => {
  const wps = [
    {
      id: 'WP-001',
      label: 'Titik Awal',
      latitude: -5.1478,
      longitude: 119.4321,
      elevationM: 12.5,
      accuracyM: 3.4,
      category: 'Titik Kontrol',
      note: 'Patok A',
      recordedAt: '2026-11-25T08:00:00.000Z',
    },
    {
      id: 'WP-002',
      label: 'Titik Akhir',
      latitude: -5.149,
      longitude: 119.435,
      elevationM: 15.0,
      accuracyM: 4.1,
      category: 'Lapangan',
      note: 'Patok B',
      recordedAt: '2026-11-25T08:10:00.000Z',
    },
  ];
  const track: [number, number][] = [
    [119.4321, -5.1478],
    [119.4335, -5.1484],
    [119.435, -5.149],
  ];

  const csv = waypointsToCsv(wps, track);
  assert.ok(csv.includes('TRK-001'));
  assert.ok(csv.includes('Track GNSS'));
  assert.ok(csv.includes('32750'));

  const gj = waypointsToGeoJson(wps, track);
  assert.equal(gj.features.length, 3);
  const trackFeature = gj.features.find((f) => f.geometry.type === 'LineString');
  assert.ok(trackFeature);
  assert.ok(Number(trackFeature.properties?.jarak_m) > 300);

  const gpx = waypointsToGpx(wps, 'Survei Lapangan', track);
  assert.ok(gpx.includes('<trk>'));
  assert.ok(gpx.includes('<trkpt lat="-5.147800" lon="119.432100" />'));
  assert.ok(gpx.includes('<ele>12.50</ele>'));

  const pt = extractFeatureLatLon({
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [106.8456, -6.2088] },
  });
  assert.deepEqual(pt, { lon: 106.8456, lat: -6.2088 });

  const line = extractFeatureLatLon({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [106.0, -6.0],
        [108.0, -8.0],
      ],
    },
  });
  assert.deepEqual(line, { lon: 107.0, lat: -7.0 });
});

test('Android Kotlin & GitHub workflow templates match on-disk sources', () => {
  const files = buildAndroidAndGithubFiles();
  const pairs = [
    '.gitattributes',
    '.github/workflows/build-apk.yml',
    'android-studio-project/README_MULAI_DI_ANDROID_STUDIO.md',
    'android-studio-project/STATUS_PEMBANGUNAN.md',
    'android-studio-project/app/src/main/java/id/geoexplorer/app/core/vector/WaypointExporter.kt',
    'android-studio-project/app/src/main/java/id/geoexplorer/app/MainActivity.kt',
    'android-studio-project/app/src/test/java/id/geoexplorer/app/core/vector/WaypointExporterTest.kt',
  ];

  for (const relPath of pairs) {
    const exported = files.find((f) => f.path === relPath);
    assert.ok(exported, `Missing ${relPath} in buildAndroidAndGithubFiles()`);
    const onDisk = fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');
    assert.equal(exported.content, onDisk, `Mismatch between exporter template and ${relPath}`);
  }
});

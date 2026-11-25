import React from 'react';
import {
  Compass,
  Download,
  FolderArchive,
  FolderOpen,
  Info,
  Layers,
  Map,
  Radio,
  Wrench,
} from 'lucide-react';

interface HomeMenuViewProps {
  onNavigate: (dest: 'map' | 'layers' | 'project' | 'tools' | 'survey' | 'utm') => void;
  onExportProject: () => void;
  onExportAndroidPackage: () => void;
  waypointCount: number;
  layerCount: number;
}

export const HomeMenuView: React.FC<HomeMenuViewProps> = ({
  onNavigate,
  onExportProject,
  onExportAndroidPackage,
  waypointCount,
  layerCount,
}) => {
  const tiles: {
    id: 'map' | 'project' | 'layers' | 'tools' | 'survey' | 'utm';
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'map',
      label: 'Peta',
      icon: <Map className="w-8 h-8 text-[#0F5EC4]" strokeWidth={2} />,
    },
    {
      id: 'project',
      label: 'Proyek',
      icon: <FolderOpen className="w-8 h-8 text-[#0F5EC4]" strokeWidth={2} />,
    },
    {
      id: 'layers',
      label: 'Layer',
      icon: <Layers className="w-8 h-8 text-[#0F5EC4]" strokeWidth={2} />,
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench className="w-8 h-8 text-[#0F5EC4]" strokeWidth={2} />,
    },
    {
      id: 'survey',
      label: 'GPS/GNSS',
      icon: <Radio className="w-8 h-8 text-[#0F5EC4]" strokeWidth={2} />,
    },
    {
      id: 'utm',
      label: 'Zona UTM',
      icon: <Compass className="w-8 h-8 text-[#0F5EC4]" strokeWidth={2} />,
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-64px)] w-full flex flex-col items-center justify-between overflow-hidden px-4 py-8 sm:py-12">
      {/* Sunlit Indonesian Highland Lake Backdrop */}
      <img
        src="/src/assets/images/indonesia_highland_lake_1795624729747.jpg"
        alt="Lanskap Pegunungan dan Danau Indonesia"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Measured contrast scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-950/45 via-slate-900/20 to-sky-950/65" />

      {/* Centered Logo & Branding matching Screen 1 */}
      <div className="relative z-10 flex flex-col items-center text-center mt-2 sm:mt-4">
        {/* Globe + Red Pin Emblem */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/60 shadow-lg flex items-center justify-center mb-4">
          <svg width="76" height="76" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="32" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2.5" />
            <path
              d="M20 34 C25 24, 38 20, 46 27 C52 32, 50 42, 42 46 C34 50, 26 55, 22 48 Z"
              fill="#22C55E"
            />
            <path
              d="M48 44 C56 42, 65 48, 63 56 C61 62, 51 64, 46 58 C43 54, 44 46, 48 44 Z"
              fill="#16A34A"
            />
            <path
              d="M26 56 C32 58, 38 62, 35 67 C31 70, 23 66, 22 61 Z"
              fill="#22C55E"
            />
            {/* Red Map Pin */}
            <path
              d="M40 16 C32.8 16 27 21.8 27 29 C27 38.5 40 52 40 52 C40 52 53 38.5 53 29 C53 21.8 47.2 16 40 16 Z"
              fill="#EF4444"
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
            <circle cx="40" cy="29" r="5" fill="#FFFFFF" />
          </svg>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight drop-shadow-sm">
          D H Y Explorer
        </h1>
        <p className="text-sm sm:text-base font-medium text-white/95 mt-1 drop-shadow-sm">
          GIS Mobile untuk Indonesia
        </p>
        <p className="text-xs sm:text-sm text-white/85 mt-1 drop-shadow-sm">
          Pemetaan · Analisis · Survei Lapangan
        </p>
      </div>

      {/* Frosted White Action Grid matching Screen 1 */}
      <div className="relative z-10 w-full max-w-md sm:max-w-2xl my-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => onNavigate(tile.id)}
              className="bg-white/95 backdrop-blur-md rounded-2xl py-5 px-4 shadow-md border border-white/70 flex flex-col items-center justify-center gap-2.5 hover:bg-white hover:-translate-y-0.5 active:scale-[0.98] transition-all min-h-[104px]"
            >
              {tile.icon}
              <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                {tile.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Version & Export Strip matching Screen 1 */}
      <div className="relative z-10 w-full max-w-md sm:max-w-2xl">
        <div className="bg-white/92 backdrop-blur-md rounded-2xl px-4 py-3 shadow-md border border-white/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#0F5EC4] text-white flex items-center justify-center shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900">
                Versi 0.4.0 · Pengembang: ngek@
              </div>
              <div className="text-[11px] text-slate-600 truncate">
                D H Y Explorer Indonesia · {waypointCount} titik · {layerCount} layer
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExportAndroidPackage}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-800 rounded-xl hover:bg-slate-200 transition-colors whitespace-nowrap"
              title="Unduh file GitHub & Android Studio (.zip)"
            >
              <FolderArchive className="w-3.5 h-3.5 text-[#0F5EC4]" />
              <span>APK / GitHub</span>
            </button>
            <button
              type="button"
              onClick={onExportProject}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0F5EC4] text-white rounded-xl hover:bg-[#0D4EA3] transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

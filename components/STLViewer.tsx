"use client";

import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage, Center } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Suspense } from "react";
import { Loader2, X, Box, Ruler, Thermometer, Clock, Layers, Droplets } from "lucide-react";

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
    </mesh>
  );
}

interface StlFile {
  id: number;
  name: string;
  filePath: string;
  dimX: number | null;
  dimY: number | null;
  dimZ: number | null;
  volume: number | null;
}

interface SlicerFile {
  id: number;
  name?: string;
  printTime: number | null;
  filamentLen: number | null;
  nozzleTemp: number | null;
  bedTemp: number | null;
}

export default function StlViewer({
  stl,
  gcode,
  onClose
}: {
  stl: StlFile;
  gcode?: SlicerFile | null;
  onClose: () => void;
}) {
  // Robust path encoding: handle segments individually to safe-guard against special characters and Windows paths
  const safeUrl = `/api/files/${stl.filePath.split(/[/\\]/).map(seg => encodeURIComponent(seg)).join('/')}`;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-7xl h-[85vh] bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden relative flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Box className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">{stl.name}</h3>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Visualisation 3D</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 shadow-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main 3D View */}
          <div className="flex-1 relative bg-slate-950/30">
            <Suspense fallback={
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-blue-500">
                <Loader2 className="w-12 h-12 animate-spin" />
                <span className="text-slate-400 font-medium animate-pulse">Chargement du modèle...</span>
              </div>
            }>
              <Canvas shadows camera={{ position: [0, 0, 100], fov: 45 }}>
                <color attach="background" args={["#0a0f1d"]} />
                <Stage environment="city" intensity={0.6} shadows="contact">
                  <Center>
                    <Model url={safeUrl} />
                  </Center>
                </Stage>
                <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
              </Canvas>
            </Suspense>

            {/* Bottom help text */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700/50 text-[10px] text-slate-400 font-bold uppercase tracking-wider pointer-events-none whitespace-nowrap">
              🖱️ Rotation • ⚙️ Zoom • 🖐️ Pan (Shift + Clic)
            </div>
          </div>

          {/* Right Sidebar - Info Panel */}
          <div className="w-80 border-l border-slate-800 bg-slate-900/40 flex flex-col overflow-y-auto">
            <div className="p-6 space-y-8">
              {/* STL Geometry Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800 pb-2">
                  <Ruler className="w-4 h-4 text-blue-400" />
                  <span>Géométrie STL</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-700/50 shadow-inner">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-tighter">Largeur (X)</p>
                    <p className="text-xl text-blue-400 font-black leading-none">{stl.dimX?.toFixed(1) || "?"} <span className="text-xs text-slate-600 font-bold uppercase ml-1">mm</span></p>
                  </div>
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-700/50 shadow-inner">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-tighter">Profondeur (Y)</p>
                    <p className="text-xl text-blue-400 font-black leading-none">{stl.dimY?.toFixed(1) || "?"} <span className="text-xs text-slate-600 font-bold uppercase ml-1">mm</span></p>
                  </div>
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-700/50 shadow-inner">
                    <p className="text-[10px] text-slate-500 font-black uppercase mb-1 tracking-tighter">Hauteur (Z)</p>
                    <p className="text-xl text-blue-400 font-black leading-none">{stl.dimZ?.toFixed(1) || "?"} <span className="text-xs text-slate-600 font-bold uppercase ml-1">mm</span></p>
                  </div>
                  <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 shadow-inner">
                    <p className="text-[10px] text-blue-500/70 font-black uppercase mb-1 tracking-tighter">Volume</p>
                    <p className="text-xl text-white font-black leading-none">{(stl.volume ? stl.volume / 1000 : 0).toFixed(1)} <span className="text-xs text-slate-600 font-bold uppercase ml-1">cm³</span></p>
                  </div>
                </div>
              </div>

              {/* G-code / Print Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-100 font-bold text-sm border-b border-slate-800 pb-2">
                  <Layers className="w-4 h-4 text-green-400" />
                  <span>Paramètres G-code</span>
                </div>
                {gcode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-400">Temps</span>
                      </div>
                      <span className="text-sm text-white font-bold">
                        {Math.floor((gcode.printTime || 0) / 3600)}h {Math.floor(((gcode.printTime || 0) % 3600) / 60)}m
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs text-slate-400">Filament</span>
                      </div>
                      <span className="text-sm text-white font-bold">
                        {(gcode.filamentLen ? gcode.filamentLen / 1000 : 0).toFixed(1)} m
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Thermometer className="w-3 h-3 text-red-400" />
                          <p className="text-[9px] text-slate-500 font-black uppercase">Buse</p>
                        </div>
                        <p className="text-white font-bold">{gcode.nozzleTemp || "?"}°C</p>
                      </div>
                      <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Thermometer className="w-3 h-3 text-blue-400" />
                          <p className="text-[9px] text-slate-500 font-black uppercase">Plateau</p>
                        </div>
                        <p className="text-white font-bold">{gcode.bedTemp || "?"}°C</p>
                      </div>
                    </div>
                    <div className="mt-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-[10px] text-blue-400/80 italic leading-relaxed">
                      Fichier: {gcode.name || "Inconnu"}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-dashed border-slate-800/50">
                    <p className="text-xs text-slate-500 italic">Aucun fichier G-code lié à ce modèle.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

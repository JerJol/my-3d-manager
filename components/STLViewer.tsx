"use client";

import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage, Center } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Suspense, useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";

function Model({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="gray" />
    </mesh>
  );
}

export default function StlViewer({
  url,
  onClose,
  filename
}: {
  url: string;
  onClose: () => void;
  filename: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl h-[80vh] bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
          <h3 className="text-white font-bold truncate">{filename}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 relative bg-slate-950">
          <Suspense fallback={
            <div className="absolute inset-0 flex items-center justify-center text-blue-500">
              <Loader2 className="w-10 h-10 animate-spin" />
              <span className="ml-2 text-white">Chargement du modèle...</span>
            </div>
          }>
            <Canvas shadows camera={{ position: [0, 0, 100], fov: 50 }}>
              <color attach="background" args={["#0f172a"]} />
              <Stage environment="city" intensity={0.6}>
                <Center>
                  <Model url={url} />
                </Center>
              </Stage>
              <OrbitControls makeDefault autoRotate />
            </Canvas>
          </Suspense>
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center text-xs text-slate-500">
          Utilisez la souris pour faire pivoter et zoomer. Appuyez sur ECHAP pour fermer.
        </div>
      </div>
    </div>
  );
}
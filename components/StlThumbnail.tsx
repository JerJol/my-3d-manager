"use client";

import React, { Component, ReactNode } from "react";

import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Stage } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Suspense, useState } from "react";
import { Box, AlertCircle } from "lucide-react";

class ErrorBoundary extends Component<{ children: ReactNode; fallback: (error: string) => ReactNode }, { hasError: boolean; error: string }> {
    constructor(props: { children: ReactNode; fallback: (error: string) => ReactNode }) {
        super(props);
        this.state = { hasError: false, error: "" };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error: error?.message || "Erreur inconnue" };
    }

    componentDidCatch(error: any) {
        console.error("StlThumbnail Error:", error);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback(this.state.error);
        }
        return this.props.children;
    }
}

function Model({ url }: { url: string }) {
    const geometry = useLoader(STLLoader, url);
    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
    );
}

export default function StlThumbnail({ url }: { url: string }) {
    if (!url) return null;

    // Robust path encoding: handle segments individually
    // We ensure we don't double encode and handle Windows paths
    const safeUrl = url.replace(/\\/g, '/').split('/').map((seg, i) => {
        if (i < 3) return seg; // Keep '', 'api', 'files'
        try {
            // Attempt to decode first to avoid double encoding if it was already encoded
            return encodeURIComponent(decodeURIComponent(seg));
        } catch {
            return encodeURIComponent(seg);
        }
    }).join('/');

    return (
        <div className="w-full h-full bg-[#0a0f1d]/50 overflow-hidden relative group flex items-center justify-center">
            <ErrorBoundary fallback={(err) => (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0f1d] border border-red-500/20 p-2 text-center">
                    <AlertCircle className="w-4 h-4 text-red-500/60 mb-1" />
                    <span className="text-[8px] text-red-500/50 font-medium break-all line-clamp-2 px-1">
                        {err.includes("404") ? "Fichier introuvable" : err}
                    </span>
                </div>
            )}>
                <Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0f1d]/50 animate-pulse">
                        <Box className="w-5 h-5 text-slate-800" />
                    </div>
                }>
                    <Canvas camera={{ position: [0, 0, 4], fov: 40 }} className="w-full h-full">
                        <color attach="background" args={["#0a0f1d"]} />
                        <Stage environment="city" intensity={0.5} shadows="contact" adjustCamera={true}>
                            <Center>
                                <Model url={safeUrl} />
                            </Center>
                        </Stage>
                        <OrbitControls makeDefault enableZoom={false} autoRotate autoRotateSpeed={6} />
                    </Canvas>
                </Suspense>
            </ErrorBoundary>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d]/40 to-transparent pointer-events-none transition-opacity" />
        </div>
    );
}

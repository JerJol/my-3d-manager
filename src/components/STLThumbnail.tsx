import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { Stage, Center } from "@react-three/drei";
// @ts-ignore
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { Suspense, useRef } from "react";
import { Box } from "lucide-react";
import * as THREE from "three";

function Model({ url, isAnimated }: { url: string; isAnimated?: boolean }) {
    const geometry = useLoader(STLLoader, url);
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((_state, delta) => {
        if (isAnimated && meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
        }
    });

    return (
        <mesh ref={meshRef} geometry={geometry}>
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
        </mesh>
    );
}

export default function STLThumbnail({ path, isAnimated }: { path: string; isAnimated?: boolean }) {
    const safeUrl = `local-resource://?path=${encodeURIComponent(path)}`;

    return (
        <div className="w-full h-full bg-slate-950/20">
            <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                    <Box className="w-8 h-8 text-muted-foreground/20 animate-pulse" />
                </div>
            }>
                <Canvas shadows camera={{ position: [0, 0, 50], fov: 45 }} gl={{ antialias: false }}>
                    <Stage environment="city" intensity={0.5} shadows={false} adjustCamera={true}>
                        <Center>
                            <Model url={safeUrl} isAnimated={isAnimated} />
                        </Center>
                    </Stage>
                </Canvas>
            </Suspense>
        </div>
    );
}

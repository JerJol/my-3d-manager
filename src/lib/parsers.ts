export interface StlMetadata {
    dimX: number;
    dimY: number;
    dimZ: number;
    volume: number;
}

export interface GcodeMetadata {
    printTime: number;
    filamentLen: number;
}

/**
 * Parses STL metadata from an ArrayBuffer
 */
export function parseStlMetadata(data: ArrayBuffer): StlMetadata {
    const buffer = new DataView(data);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let volume = 0;

    const length = data.byteLength;

    // Check for binary STL: 80 byte header + 4 byte face count
    // Binary STL size = 80 + 4 + (facetCount * 50)
    let isBinary = false;
    if (length >= 84) {
        const facetCount = buffer.getUint32(80, true);
        if (facetCount * 50 + 84 === length) {
            isBinary = true;
        }
    }

    if (isBinary) {
        const facetCount = buffer.getUint32(80, true);

        for (let i = 0; i < facetCount; i++) {
            const offset = 84 + i * 50;

            // Read vertices (offset + 12 is after normal)
            for (let v = 0; v < 3; v++) {
                const vx = buffer.getFloat32(offset + 12 + v * 12, true);
                const vy = buffer.getFloat32(offset + 12 + v * 12 + 4, true);
                const vz = buffer.getFloat32(offset + 12 + v * 12 + 8, true);

                minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
                minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
                minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
            }

            // Signed volume of tetrahedron
            const x1 = buffer.getFloat32(offset + 12, true);
            const y1 = buffer.getFloat32(offset + 16, true);
            const z1 = buffer.getFloat32(offset + 20, true);
            const x2 = buffer.getFloat32(offset + 24, true);
            const y2 = buffer.getFloat32(offset + 28, true);
            const z2 = buffer.getFloat32(offset + 32, true);
            const x3 = buffer.getFloat32(offset + 36, true);
            const y3 = buffer.getFloat32(offset + 40, true);
            const z3 = buffer.getFloat32(offset + 44, true);

            volume += (x1 * y2 * z3 - x1 * y3 * z2 - x2 * y1 * z3 + x2 * y3 * z1 + x3 * y1 * z2 - x3 * y2 * z1) / 6.0;
        }
    } else {
        // ASCII Parser
        const decoder = new TextDecoder();
        const text = decoder.decode(data);
        const lines = text.split('\n');
        let triangle: number[][] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('vertex')) {
                const parts = trimmed.split(/\s+/);
                const vx = parseFloat(parts[1]);
                const vy = parseFloat(parts[2]);
                const vz = parseFloat(parts[3]);

                minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
                minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
                minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);

                triangle.push([vx, vy, vz]);
                if (triangle.length === 3) {
                    const [v1, v2, v3] = triangle;
                    volume += (v1[0] * v2[1] * v3[2] - v1[0] * v3[1] * v2[2] - v2[0] * v1[1] * v3[2] + v2[0] * v3[1] * v1[2] + v3[0] * v1[1] * v2[2] - v3[0] * v2[1] * v1[2]) / 6.0;
                    triangle = [];
                }
            }
        }
    }

    return {
        dimX: isFinite(minX) ? maxX - minX : 0,
        dimY: isFinite(minY) ? maxY - minY : 0,
        dimZ: isFinite(minZ) ? maxZ - minZ : 0,
        volume: Math.abs(volume)
    };
}

/**
 * Parses GCode metadata from a string
 */
export function parseGcodeMetadata(content: string): GcodeMetadata {
    let printTime = 0;
    let filamentLen = 0;

    const lines = content.split('\n').slice(0, 500);
    const footerLines = content.split('\n').slice(-500);
    const allLines = [...lines, ...footerLines];

    for (const line of allLines) {
        if (line.includes(";TIME:")) {
            const timeStr = line.split(":")[1].trim();
            printTime = parseInt(timeStr);
        }
        if (line.includes("Filament used")) {
            const match = line.match(/([0-9.]+)m/);
            if (match) {
                filamentLen = parseFloat(match[1]) * 1000; // convert to mm
            }
        }
    }

    return { printTime, filamentLen };
}

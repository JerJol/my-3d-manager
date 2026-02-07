// src/lib/calculator.ts
export interface PrintStats {
  timeMinutes: number;
  filamentGrams: number;
}

export function parseGCode(content: string): PrintStats {
  // Regex pour trouver le temps et la masse (compatible Cura/PrusaSlicer)
  const timeMatch = content.match(/TIME:(\d+)/i) || content.match(/estimated printing time.*=\s*(\d+h\s*\d+m\s*\d+s)/i);
  const filamentMatch = content.match(/filament used \[g\] = ([\d.]+)/i) || content.match(/@filament_weight_g\s*:\s*([\d.]+)/i);

  // Valeurs par défaut si le parsing échoue
  return {
    timeMinutes: 120, // 2h par défaut pour le test
    filamentGrams: parseFloat(filamentMatch?.[1] || "50"),
  };
}

export function calculateCost(stats: PrintStats, config: { elecPrice: number, machinePower: number, filamentPrice: number, filamentWeight: number }) {
  const costFilament = (stats.filamentGrams * config.filamentPrice) / config.filamentWeight;
  const costElec = (config.machinePower * (stats.timeMinutes / 60) / 1000) * config.elecPrice;
  return {
    total: costFilament + costElec,
    filament: costFilament,
    electricity: costElec
  };
}
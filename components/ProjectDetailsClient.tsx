"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Box, Calendar, Tag, Upload, Eye, Trash, FolderOpen, Edit2, Save, Layers } from "lucide-react";
import AddGcodeModal from "./AddGcodeModal";
import ScanChoiceModal from "./ScanChoiceModal";
import STLViewer from "./STLViewer";
import { deleteStl, deleteSlicerFile, updateProjectFolder, openProjectFolder, updateStlQuantity, getFilaments, updateProjectFilament, getPrinters, updateProjectPrinter, getAppConfig, getProjectVersions, createProjectVersion, setDefaultVersion, updateProjectDescription, deleteProject, pickFolder, scanLocalStls, pickFile, addSingleStl, deleteAllProjectStls } from "@/app/actions";
import { Printer as PrinterIcon, Plus, ChevronDown, Trash2, Home, Search, FolderSearch } from "lucide-react";
import { useRouter } from "next/navigation";

interface ProjectDetailsClientProps {
    project: {
        id: number;
        name: string;
        description: string | null;
        status: string;
        theme: string | null;
        localFolderPath: string | null;
        createdAt: Date;
        filamentId: number | null;
        printerId: number | null;
        parentProjectId: number | null;
        versionName: string | null;
        versionNumber: number;
        isDefault: boolean;
        stls: {
            id: number;
            name: string;
            filePath: string;
            status: string;
            quantity: number;
            slicers: {
                id: number;
                printTime: number | null;
                filamentLen: number | null;
            }[];
        }[];
    };
}

interface Filament {
    id: number;
    name: string;
    price: number;
    weight: number;
    diameter: number;
    density: number;
}

interface Printer {
    id: number;
    name: string;
    machineHourlyCost: number;
}

export default function ProjectDetailsClient({ project }: ProjectDetailsClientProps) {
    const [isGcodeModalOpen, setIsGcodeModalOpen] = useState<{ isOpen: boolean; stlId: number | null }>({ isOpen: false, stlId: null });
    const [selectedStl, setSelectedStl] = useState<{ url: string; name: string } | null>(null);
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [localPath, setLocalPath] = useState(project.localFolderPath || "");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [description, setDescription] = useState(project.description || "");
    const [isScanning, setIsScanning] = useState(false);
    const [isScanChoiceModalOpen, setIsScanChoiceModalOpen] = useState(false);
    const [scanActionType, setScanActionType] = useState<'folder' | 'file'>('folder');

    // Filament & Printer State
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [versions, setVersions] = useState<{ id: number; versionName: string | null; versionNumber: number; isDefault: boolean }[]>([]);
    const [selectedFilamentId, setSelectedFilamentId] = useState<number | null>(project.filamentId);
    const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(project.printerId);
    const [elecPrice, setElecPrice] = useState(0);
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);
    const router = useRouter();

    useEffect(() => {
        getFilaments().then(setFilaments);
        getPrinters().then(setPrinters);
        getProjectVersions(project.id).then(setVersions);
        getAppConfig("ELECTRICITY_PRICE").then(price => setElecPrice(Number(price) || 0));
    }, [project.id]);

    const selectedFilament = filaments.find(f => f.id === selectedFilamentId);
    const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

    // Calculate totals
    const totalPrintTime = project.stls.reduce((acc, stl) => {
        const gcode = stl.slicers?.[0];
        return acc + ((gcode?.printTime || 0) * stl.quantity);
    }, 0);

    const totalFilamentLen = project.stls.reduce((acc, stl) => {
        const gcode = stl.slicers?.[0];
        return acc + ((gcode?.filamentLen || 0) * stl.quantity);
    }, 0);

    // Calculate Cost
    let filamentCost = 0;
    let totalWeightG = 0;
    if (selectedFilament) {
        const radiusCm = (selectedFilament.diameter / 2) / 10;
        const lengthCm = totalFilamentLen / 10;
        const volumeCm3 = lengthCm * Math.PI * Math.pow(radiusCm, 2);
        totalWeightG = volumeCm3 * selectedFilament.density;
        filamentCost = (totalWeightG / selectedFilament.weight) * selectedFilament.price;
    }

    const machineCost = selectedPrinter ? (totalPrintTime / 3600) * selectedPrinter.machineHourlyCost : 0;
    const electricityCost = selectedPrinter ? (totalPrintTime / 3600) * (selectedPrinter as any).powerConsumptionW / 1000 * elecPrice : 0;

    const totalCost = filamentCost + machineCost + electricityCost;

    // Helpers to update project
    const handleFilamentChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value ? parseInt(e.target.value) : null;
        setSelectedFilamentId(newId);
        await updateProjectFilament(project.id, newId);
    };

    const handlePrinterChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value ? parseInt(e.target.value) : null;
        setSelectedPrinterId(newId);
        await updateProjectPrinter(project.id, newId);
    };

    return (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* ... Header ... */}
            <div className="space-y-4">


                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold text-white">{project.name}</h1>
                            <span className="text-xl text-slate-500 font-medium">— {project.versionName || `v${project.versionNumber}`}</span>
                        </div>
                        <div className="group relative">
                            {isEditingDescription ? (
                                <div className="flex flex-col gap-2 max-w-2xl mt-2">
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                        placeholder="Détails sur cette version..."
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                await updateProjectDescription(project.id, description);
                                                setIsEditingDescription(false);
                                                // No need for window.location.reload() if we update state locally, 
                                                // but since the parent prop 'project' won't change without a refresh, 
                                                // a reload is safer for now or we wait for dev to refresh.
                                                // router.refresh();
                                                window.location.reload();
                                            }}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                                        >
                                            <Save className="w-3 h-3" /> Enregistrer
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditingDescription(false);
                                                setDescription(project.description || "");
                                            }}
                                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs transition-colors"
                                        >
                                            Annuler
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 group/desc">
                                    <p className="text-slate-400 max-w-2xl">{project.description || "Aucune description"}</p>
                                    <button
                                        onClick={() => setIsEditingDescription(true)}
                                        className="p-1 text-slate-600 hover:text-blue-400 opacity-0 group-hover/desc:opacity-100 transition-all"
                                        title="Modifier la description"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={project.id}
                            onChange={(e) => router.push(`/projects/${e.target.value}`)}
                            className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-blue-500 cursor-pointer hover:bg-slate-700 transition-colors"
                        >
                            {versions.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.isDefault ? "⭐ " : ""}{v.versionName || `v${v.versionNumber}`}
                                </option>
                            ))}
                        </select>

                        {!project.isDefault && (
                            <button
                                onClick={async () => {
                                    if (confirm("Définir cette version comme version par défaut ?")) {
                                        await setDefaultVersion(project.id);
                                        window.location.reload(); // Force reload to refresh data
                                    }
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-500 rounded-lg text-sm font-medium border border-slate-700 transition-colors"
                                title="Définir comme version par défaut"
                            >
                                ⭐ Par défaut
                            </button>
                        )}

                        <button
                            onClick={async () => {
                                const name = prompt("Nom de la nouvelle version (ex: v2, Final, etc.) :");
                                if (name) {
                                    setIsCreatingVersion(true);
                                    try {
                                        const newVer = await createProjectVersion(project.parentProjectId || project.id, name);
                                        router.push(`/projects/${newVer.id}`);
                                    } finally {
                                        setIsCreatingVersion(false);
                                    }
                                }
                            }}
                            disabled={isCreatingVersion}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            {isCreatingVersion ? "Création..." : "Nouvelle Version"}
                        </button>

                        <button
                            onClick={async () => {
                                if (confirm("⚠️ ATTENTION : La suppression d'un projet est IRREVERSIBLE.\n\nTous les fichiers associés (STL et G-codes) seront également supprimés du disque.\n\nSouhaitez-vous vraiment continuer ?")) {
                                    await deleteProject(project.id);
                                    router.push("/");
                                }
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 transition-all"
                            title="Supprimer ce projet"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-6 pt-2">
                    {project.theme && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Tag className="w-4 h-4 text-blue-500" />
                            <span>Thème: {project.theme}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span>Créé le: {new Date(project.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-400">
                        <span>⏱️ {Math.floor(totalPrintTime / 3600)}h {Math.floor((totalPrintTime % 3600) / 60)}m</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                        <span>🧶 {Math.round(totalWeightG * 10) / 10}g ({Math.round((totalFilamentLen / 1000) * 100) / 100}m)</span>
                    </div>
                    {totalCost > 0 && (
                        <div className="flex items-center gap-2 text-sm text-blue-400">
                            <span>💰 {totalCost.toFixed(2)} €</span>
                        </div>
                    )}
                </div>

                {/* Local Folder & Filament Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Local Folder */}
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <div className="p-2 bg-yellow-500/10 rounded-lg">
                                <FolderOpen className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Dossier Local</div>
                                {isEditingPath ? (
                                    <input
                                        type="text"
                                        value={localPath}
                                        onChange={(e) => setLocalPath(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                        placeholder="C:\Users\..."
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-300 text-sm truncate" title={localPath || "Aucun dossier lié"}>
                                        {localPath || "Aucun dossier lié"}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={async () => {
                                    const defaultPath = await getAppConfig("DEFAULT_STL_FOLDER");
                                    const result = await pickFolder(defaultPath || undefined);
                                    if (result.success && result.path) {
                                        setLocalPath(result.path);
                                        await updateProjectFolder(project.id, result.path);
                                    }
                                }}
                                className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors border border-transparent hover:border-blue-400/20"
                                title="Sélectionner un dossier"
                            >
                                <Search className="w-4 h-4" />
                            </button>
                            {isEditingPath ? (
                                <button
                                    onClick={async () => {
                                        await updateProjectFolder(project.id, localPath);
                                        setIsEditingPath(false);
                                    }}
                                    className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setIsEditingPath(true)}
                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                        title="Modifier le chemin"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    {localPath && (
                                        <button
                                            onClick={() => openProjectFolder(localPath)}
                                            className="p-2 text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors"
                                            title="Ouvrir dans l'explorateur"
                                        >
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Filament Selection */}
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Layers className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Filament du projet</div>
                                <select
                                    value={selectedFilamentId || ""}
                                    onChange={handleFilamentChange}
                                    className="w-full bg-transparent text-sm text-white focus:outline-none cursor-pointer [&>option]:bg-slate-900"
                                >
                                    <option value="">Sélectionner un filament...</option>
                                    {filaments.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Printer Selection */}
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <PrinterIcon className="w-5 h-5 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-0.5">Imprimante</div>
                                <select
                                    value={selectedPrinterId || ""}
                                    onChange={handlePrinterChange}
                                    className="w-full bg-transparent text-sm text-white focus:outline-none cursor-pointer [&>option]:bg-slate-900"
                                >
                                    <option value="">Sélectionner une imprimante...</option>
                                    {printers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content - Files */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Box className="w-5 h-5 text-blue-500" />
                                Fichiers STL
                            </h2>
                            <div className="flex items-center gap-2">
                                {localPath && (
                                    <button
                                        onClick={() => {
                                            setScanActionType('folder');
                                            setIsScanChoiceModalOpen(true);
                                        }}
                                        disabled={isScanning}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        title="Scanner le dossier local pour ajouter de nouveaux fichiers STL"
                                    >
                                        <FolderSearch className="w-4 h-4" />
                                        {isScanning ? "Scan..." : "Scanner le dossier"}
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setScanActionType('file');
                                        setIsScanChoiceModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    Ajouter
                                </button>
                                {project.stls.length > 0 && (
                                    <button
                                        onClick={async () => {
                                            if (confirm("Êtes-vous sûr de vouloir supprimer TOUS les fichiers de cette version ? Cette action est irréversible.")) {
                                                const result = await deleteAllProjectStls(project.id);
                                                if (!result.success) {
                                                    alert(result.error);
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded-lg text-sm font-medium transition-colors"
                                        title="Supprimer tous les fichiers de cette version"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Faire table rase
                                    </button>
                                )}
                            </div>
                        </div>

                        {project.stls.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 bg-slate-900/30 rounded-lg border border-slate-800/50 border-dashed">
                                <p>Aucun fichier STL associé pour le moment.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {project.stls.map((stl) => {
                                    const gcode = stl.slicers?.[0]; // Assuming 1 G-code per STL for now
                                    return (
                                        <div key={stl.id} className="bg-slate-800/50 p-4 rounded-lg flex flex-col gap-3 group hover:bg-slate-800 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="relative"
                                                        title={stl.filePath.includes(":") || stl.filePath.startsWith("/") ? "Lien externe (Fichier sur votre disque)" : "Stockage interne (Fichier importé dans l'application)"}
                                                    >
                                                        <Box className={`w-5 h-5 ${stl.filePath.includes(":") || stl.filePath.startsWith("/") ? "text-yellow-500" : "text-blue-500"}`} />
                                                        <div
                                                            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${stl.filePath.includes(":") || stl.filePath.startsWith("/") ? "bg-yellow-500" : "bg-blue-500"} border border-slate-900`}
                                                        />
                                                    </div>
                                                    <span className="text-slate-200 font-medium">{stl.name}</span>
                                                    {/* Quantity Input */}
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <span className="text-xs text-slate-500">Qté:</span>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            defaultValue={stl.quantity}
                                                            onChange={(e) => updateStlQuantity(stl.id, parseInt(e.target.value))}
                                                            className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
                                                        {stl.status}
                                                    </span>
                                                    <button
                                                        onClick={() => setSelectedStl({
                                                            url: `/api/files/${stl.filePath}`,
                                                            name: stl.name
                                                        })}
                                                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                        title="Visualiser en 3D"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm("Supprimer ce fichier STL ?")) {
                                                                await deleteStl(stl.id);
                                                            }
                                                        }}
                                                        className="p-2 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-slate-400 pl-8 mt-2 w-full">
                                                {gcode ? (
                                                    <div className="grid grid-cols-[30px_200px_40px_100px_100px_auto] items-center gap-4 w-full">
                                                        {/* Status Dot */}
                                                        <div className="flex items-center justify-center">
                                                            <div className="w-2 h-2 rounded-full bg-green-500" title="G-code lié"></div>
                                                        </div>

                                                        {/* Name */}
                                                        <span className="text-slate-200 font-medium truncate" title={gcode.name || "G-code"}>
                                                            {gcode.name || "Fichier G-code"}
                                                        </span>

                                                        {/* Spacer */}
                                                        <span></span>

                                                        {/* Time */}
                                                        <span className="text-slate-300">
                                                            ⏱️ {Math.floor((gcode.printTime || 0) / 3600)}h {Math.floor(((gcode.printTime || 0) % 3600) / 60)}m
                                                        </span>

                                                        {/* Length */}
                                                        <span className="text-slate-300">
                                                            🧶 {Math.round(((gcode.filamentLen || 0) / 1000) * 100) / 100}m
                                                        </span>

                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm("Supprimer ce G-code ?")) {
                                                                        await deleteSlicerFile(gcode.id);
                                                                    }
                                                                }}
                                                                className="text-slate-500 hover:text-red-500 transition-colors p-1"
                                                                title="Supprimer G-code"
                                                            >
                                                                <Trash className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setIsGcodeModalOpen({ isOpen: true, stlId: stl.id })}
                                                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 transition-colors ml-9"
                                                    >
                                                        + Ajouter G-code
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Stats/Notes */}
                <div className="space-y-6">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                        <h3 className="tex-lg font-semibold text-white mb-4">Statistiques</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-slate-400">
                                <span>Fichiers totaux</span>
                                <span className="text-white">{project.stls.length}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Temps total</span>
                                <span className="text-green-400">
                                    {Math.floor(totalPrintTime / 3600)}h {Math.floor((totalPrintTime % 3600) / 60)}m
                                </span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Filament total</span>
                                <span className="text-yellow-400">
                                    {Math.round(totalWeightG * 10) / 10}g ({Math.round((totalFilamentLen / 1000) * 100) / 100}m)
                                </span>
                            </div>
                            {totalCost > 0 && (
                                <>
                                    <div className="flex justify-between text-slate-400 pt-3 mt-3 border-t border-slate-800">
                                        <span>Coût filament</span>
                                        <span className="text-white">{filamentCost.toFixed(2)} €</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Coût électrique</span>
                                        <span className="text-white">{electricityCost.toFixed(2)} €</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Coût machine</span>
                                        <span className="text-white">{machineCost.toFixed(2)} €</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400 pt-2 mt-2 border-t border-slate-800/50 font-semibold">
                                        <span>Coût total</span>
                                        <span className="text-blue-400">
                                            {totalCost.toFixed(2)} €
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isGcodeModalOpen.isOpen && isGcodeModalOpen.stlId && (
                <AddGcodeModal
                    stlId={isGcodeModalOpen.stlId}
                    onClose={() => setIsGcodeModalOpen({ isOpen: false, stlId: null })}
                />
            )}

            <ScanChoiceModal
                isOpen={isScanChoiceModalOpen}
                onClose={() => setIsScanChoiceModalOpen(false)}
                onSelect={async (mode) => {
                    setIsScanChoiceModalOpen(false);
                    setIsScanning(true);
                    try {
                        if (scanActionType === 'folder') {
                            const result = await scanLocalStls(project.id, localPath, mode);
                            if (result.success) {
                                let message = `${result.addedCount} fichiers STL ajoutés (${mode === 'copy' ? 'copiés' : 'liés'}).`;

                                if (result.associatedGcodeCount && result.associatedGcodeCount > 0) {
                                    message += `\n✅ ${result.associatedGcodeCount} fichiers G-code associés automatiquement.`;
                                }

                                if (result.skippedCount && result.skippedCount > 0) {
                                    message += `\n\nℹ️ ${result.skippedCount} fichiers ignorés (déjà existants) :\n- ${result.skippedFiles?.join('\n- ')}`;
                                }

                                if (result.associationWarnings && result.associationWarnings.length > 0) {
                                    message += `\n\n⚠️ Attention (G-code) :\n- ${result.associationWarnings.join('\n- ')}`;
                                }

                                alert(message);
                            } else {
                                alert(result.error);
                            }
                        } else {
                            // Single File Pick
                            const defaultPath = await getAppConfig("DEFAULT_STL_FOLDER");
                            const initialDir = localPath || defaultPath || undefined;

                            const pickResult = await pickFile(initialDir);
                            if (pickResult.success && pickResult.path) {
                                const addResult = await addSingleStl(project.id, pickResult.path, mode);
                                if (!addResult.success) {
                                    alert(addResult.error);
                                }
                            } else if (!pickResult.success && pickResult.error !== "Sélection annulée") {
                                alert(pickResult.error);
                            }
                        }
                    } finally {
                        setIsScanning(false);
                    }
                }}
            />

            {selectedStl && (
                <STLViewer
                    url={selectedStl.url}
                    filename={selectedStl.name}
                    onClose={() => setSelectedStl(null)}
                />
            )}
        </main>
    );
}

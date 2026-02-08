"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Box, Calendar, Tag, Upload, Eye, Trash, FolderOpen, Edit2, Save, Layers, Printer as PrinterIcon, Plus, ChevronDown, Trash2, Home, Search, FolderSearch, Tag as TagIcon, Minus, HardDrive, Share, ExternalLink as LinkIcon, Image as ImageIcon, X, ChevronLeft, ChevronRight, MousePointer2 } from "lucide-react";
import AddGcodeModal from "./AddGcodeModal";
import ScanChoiceModal from "./ScanChoiceModal";
import STLViewer from "./STLViewer";
import StlThumbnail from "./StlThumbnail";
import { deleteStl, deleteSlicerFile, updateProjectFolder, openProjectFolder, updateStlQuantity, updateStlStatus, updateStlComment, getFilaments, updateProjectFilament, getPrinters, updateProjectPrinter, getAppConfig, getProjectVersions, createProjectVersion, setDefaultVersion, updateProjectDescription, deleteProject, pickFolder, scanLocalStls, pickFile, addSingleStl, deleteAllProjectStls, getCategories, updateProjectCategory, exportGcode, exportAllProjectGcodes, updateStlPrintedQuantity, exportStl, exportAllProjectStls, addProjectLink, deleteProjectLink, addProjectImage, deleteProjectImage, generateProjectDescription, uploadPastedImage } from "@/app/actions";
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
        categoryId: number | null;
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
            printedQty: number;
            comment: string | null;
            slicers: {
                id: number;
                name?: string;
                printTime: number | null;
                filamentLen: number | null;
            }[];
        }[];
        links: {
            id: number;
            name: string;
            url: string;
        }[];
        images: {
            id: number;
            url: string;
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
    const [selectedStl, setSelectedStl] = useState<{ stl: any; gcode: any } | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingStl, setIsExportingStl] = useState(false);
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [localPath, setLocalPath] = useState(project.localFolderPath || "");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [description, setDescription] = useState(project.description || "");
    const [isScanning, setIsScanning] = useState(false);
    const [isScanChoiceModalOpen, setIsScanChoiceModalOpen] = useState(false);
    const [scanActionType, setScanActionType] = useState<'folder' | 'file'>('folder');

    // Filament & Printer & Category State
    const [filaments, setFilaments] = useState<Filament[]>([]);
    const [printers, setPrinters] = useState<Printer[]>([]);
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [versions, setVersions] = useState<{ id: number; versionName: string | null; versionNumber: number; isDefault: boolean }[]>([]);
    const [selectedFilamentId, setSelectedFilamentId] = useState<number | null>(project.filamentId);
    const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(project.printerId);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(project.categoryId);
    const [elecPrice, setElecPrice] = useState(0);
    const [isCreatingVersion, setIsCreatingVersion] = useState(false);

    // Links & Images state
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [newLinkName, setNewLinkName] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [isAddingImage, setIsAddingImage] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
    const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
    const [zoomState, setZoomState] = useState<{ isZoomed: boolean; x: number; y: number; scale: number }>({ isZoomed: false, x: 0, y: 0, scale: 2.5 });

    const router = useRouter();

    useEffect(() => {
        getFilaments().then(setFilaments);
        getPrinters().then(setPrinters);
        getCategories().then(setCategories);
        getProjectVersions(project.id).then(setVersions);
        getAppConfig("ELECTRICITY_PRICE").then((price: string | null) => setElecPrice(Number(price) || 0));
    }, [project.id]);

    useEffect(() => {
        const visibleCount = 4;
        if (project.images.length <= visibleCount || isCarouselPaused) return;

        const maxIndex = project.images.length - visibleCount;

        const interval = setInterval(() => {
            setCarouselIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
        }, 3000);

        return () => clearInterval(interval);
    }, [project.images.length, isCarouselPaused]);

    useEffect(() => {
        const handlePaste = async (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (const item of Array.from(items)) {
                if (item.type.indexOf("image") !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    const formData = new FormData();
                    formData.append("projectId", project.id.toString());
                    formData.append("image", blob);

                    const res = await uploadPastedImage(formData);
                    if (!res.success) {
                        alert(res.error);
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [project.id]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedFullImage(null);
                setZoomState({ isZoomed: false, x: 0, y: 0, scale: 2.5 });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const selectedFilament = filaments.find(f => f.id === selectedFilamentId);
    const selectedPrinter = printers.find(p => p.id === selectedPrinterId);

    // Calculate totals
    const totalPrintTime = project.stls.reduce((acc, stl) => {
        const gcode = stl.slicers?.[0];
        return acc + ((gcode?.printTime || 0) * stl.quantity);
    }, 0);

    const remainingPrintTime = project.stls.reduce((acc, stl) => {
        const gcode = stl.slicers?.[0];
        const remainingQty = Math.max(0, stl.quantity - (stl.printedQty || 0));
        return acc + ((gcode?.printTime || 0) * remainingQty);
    }, 0);

    const totalFilamentLen = project.stls.reduce((acc, stl) => {
        const gcode = stl.slicers?.[0];
        return acc + ((gcode?.filamentLen || 0) * stl.quantity);
    }, 0);

    const currentCategory = categories.find(c => String(c.id) === String(selectedCategoryId));
    const isBoardGame = currentCategory?.name.toLowerCase().includes("jeu de société");

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

    const handleCategoryChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value ? parseInt(e.target.value) : null;
        setSelectedCategoryId(newId);
        await updateProjectCategory(project.id, newId);
    };

    const [isPending, startTransition] = useTransition();

    const handleUpdatePrintedQty = (stlId: number, currentQty: number | undefined | null, delta: number, totalQty: number) => {
        const current = currentQty || 0;
        const newQty = Math.min(totalQty, Math.max(0, current + delta));

        startTransition(async () => {
            const result = await updateStlPrintedQuantity(stlId, newQty);
            if (!result.success) {
                alert(result.error);
            }
        });
    };

    return (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Project Header / Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-2xl">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none" />

                <div className="relative p-8 md:p-10">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="space-y-4 flex-1">
                            <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-2 group">
                                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                Retour aux projets
                            </Link>

                            <div className="flex flex-wrap items-center gap-4">
                                <h1 className="text-4xl font-extrabold text-foreground tracking-tight">{project.name}</h1>
                                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-blue-500/20 rounded-full">
                                    <Layers className="w-4 h-4 text-primary" />
                                    <span className="text-primary font-semibold text-sm">{project.versionName || `v${project.versionNumber}`}</span>
                                </div>
                                {project.isDefault && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                        <span className="text-yellow-500 text-xs text-[10px] uppercase font-bold tracking-wider">Version par défaut</span>
                                    </div>
                                )}
                                {isBoardGame && (
                                    <button
                                        onClick={async () => {
                                            if (description && !confirm("Voulez-vous remplacer la description actuelle par une nouvelle génération IA ?")) return;
                                            setIsGeneratingDescription(true);
                                            try {
                                                const res = await generateProjectDescription(project.id, project.name);
                                                if (res.success && res.description) {
                                                    setDescription(res.description);
                                                }
                                            } finally {
                                                setIsGeneratingDescription(false);
                                            }
                                        }}
                                        disabled={isGeneratingDescription}
                                        className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full text-xs font-black shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 group/ai animate-in fade-in zoom-in duration-500"
                                    >
                                        <span className="group-hover:rotate-12 transition-transform text-sm">✨</span>
                                        {isGeneratingDescription ? "IA en cours..." : "MAGIE IA : GÉNÉRER DESCRIPTION"}
                                    </button>
                                )}
                            </div>

                            {/* Project Links */}
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                                {project.links.map(link => (
                                    <div key={link.id} className="group/link relative flex items-center gap-2 px-3 py-1.5 bg-card/50 border border-border/50 rounded-lg hover:border-primary/50 transition-all">
                                        <LinkIcon className="w-3.5 h-3.5 text-primary" />
                                        <a
                                            href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                                            title={link.url}
                                        >
                                            {link.name}
                                        </a>
                                        <button
                                            onClick={async () => await deleteProjectLink(link.id)}
                                            className="opacity-0 group-hover/link:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>

                                        {/* Simple Tooltip on hover */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-[10px] text-white rounded opacity-0 group-hover/link:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border/50">
                                            {link.url}
                                        </div>
                                    </div>
                                ))}

                                {isAddingLink ? (
                                    <div className="flex items-center gap-2 bg-card border border-primary/30 rounded-lg p-1 animate-in fade-in slide-in-from-left-2 transition-all">
                                        <input
                                            autoFocus
                                            placeholder="Nom"
                                            value={newLinkName}
                                            onChange={(e) => setNewLinkName(e.target.value)}
                                            className="bg-transparent text-xs px-2 py-1 outline-none w-24"
                                        />
                                        <input
                                            placeholder="URL"
                                            value={newLinkUrl}
                                            onChange={(e) => setNewLinkUrl(e.target.value)}
                                            className="bg-transparent text-xs px-2 py-1 outline-none w-32"
                                        />
                                        <button
                                            onClick={async () => {
                                                if (newLinkName && newLinkUrl) {
                                                    await addProjectLink(project.id, newLinkName, newLinkUrl);
                                                    setNewLinkName("");
                                                    setNewLinkUrl("");
                                                    setIsAddingLink(false);
                                                }
                                            }}
                                            className="p-1 hover:bg-primary/10 text-primary rounded"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => setIsAddingLink(false)} className="p-1 hover:bg-destructive/10 text-destructive rounded">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsAddingLink(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-border hover:border-primary/50 rounded-lg text-xs text-muted-foreground hover:text-primary transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Ajouter un lien
                                    </button>
                                )}
                            </div>

                            <div className="group relative max-w-2xl">
                                {isEditingDescription ? (
                                    <div className="flex flex-col gap-3 mt-4">
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full bg-slate-800/50 border border-border text-foreground rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none h-28 transition-all"
                                            placeholder="Détails sur cette version..."
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    await updateProjectDescription(project.id, description);
                                                    setIsEditingDescription(false);
                                                    window.location.reload();
                                                }}
                                                className="px-4 py-2 bg-primary hover:bg-blue-500 text-foreground rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                                            >
                                                <Save className="w-4 h-4" /> Enregistrer
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditingDescription(false);
                                                    setDescription(project.description || "");
                                                }}
                                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3 mt-2 group/desc">
                                        <p className="text-muted-foreground text-lg leading-relaxed">{project.description || "Aucune description pour ce projet."}</p>
                                        <button
                                            onClick={() => setIsEditingDescription(true)}
                                            className="p-1.5 text-muted-foreground/60 hover:text-primary hover:bg-blue-400/10 rounded-md opacity-0 group-hover/desc:opacity-100 transition-all mt-1"
                                            title="Modifier la description"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-6 pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                        <span className="text-xl">⏱️</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Temps d'impression</div>
                                        <div className="text-foreground font-bold">
                                            {Math.floor(totalPrintTime / 3600)}h {Math.floor((totalPrintTime % 3600) / 60)}m
                                            {remainingPrintTime > 0 && remainingPrintTime < totalPrintTime && (
                                                <span className="text-orange-500 ml-2" title="Temps restant basé sur les quantités imprimées">
                                                    (Reste: {Math.floor(remainingPrintTime / 3600)}h {Math.floor((remainingPrintTime % 3600) / 60)}m)
                                                </span>
                                            )}
                                            {remainingPrintTime === 0 && totalPrintTime > 0 && (
                                                <span className="text-green-500 ml-2" title="Toutes les pièces sont imprimées">
                                                    (Terminé)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                                        <span className="text-xl">🧶</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Matière consommée</div>
                                        <div className="text-foreground font-bold">{Math.round(totalWeightG * 10) / 10}g <span className="text-muted-foreground font-normal">({Math.round((totalFilamentLen / 1000) * 100) / 100}m)</span></div>
                                    </div>
                                </div>
                                {totalCost > 0 && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <span className="text-xl">💰</span>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Estimation Coût</div>
                                            <div className="text-primary font-bold">{totalCost.toFixed(2)} €</div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Projet créé le</div>
                                        <div className="text-foreground font-bold">{new Date(project.createdAt).toLocaleDateString()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto self-stretch md:self-start">
                            <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-border">
                                <select
                                    value={project.id}
                                    onChange={(e) => router.push(`/projects/${e.target.value}`)}
                                    className="bg-transparent text-foreground px-3 py-2 text-sm font-bold focus:outline-none cursor-pointer flex-1 min-w-[120px]"
                                >
                                    {versions.map(v => (
                                        <option key={v.id} value={v.id} className="bg-card">
                                            {v.isDefault ? "⭐ " : ""}{v.versionName || `v${v.versionNumber}`}
                                        </option>
                                    ))}
                                </select>
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
                                    className="p-2 bg-primary hover:bg-blue-500 text-foreground rounded-lg transition-all disabled:opacity-50"
                                    title="Nouvelle version"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {!project.isDefault && (
                                <button
                                    onClick={async () => {
                                        if (confirm("Définir cette version comme version par défaut ?")) {
                                            await setDefaultVersion(project.id);
                                            window.location.reload();
                                        }
                                    }}
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl text-sm font-bold border border-yellow-500/20 transition-all"
                                >
                                    <span className="text-lg">⭐</span> Définir par défaut
                                </button>
                            )}

                            <button
                                onClick={async () => {
                                    try {
                                        const imageFilter = "Image Files (*.jpg;*.jpeg;*.png;*.webp)|*.jpg;*.jpeg;*.png;*.webp|All Files (*.*)|*.*";
                                        const res = await pickFile(undefined, imageFilter, true);
                                        if (res.success && res.paths) {
                                            const addRes = await addProjectImage(project.id, res.paths);
                                            if (!addRes.success) alert(addRes.error);
                                        } else if (!res.success && res.error !== "Sélection annulée") {
                                            alert(res.error);
                                        }
                                    } catch (err) {
                                        console.error("Add photo error:", err);
                                        alert("Une erreur inattendue est survenue lors de l'ajout de la photo.");
                                    }
                                }}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-bold border border-blue-600/20 transition-all"
                                title="Sélectionner des fichiers ou coller (Ctrl+V)"
                            >
                                <ImageIcon className="w-4 h-4" />
                                Ajouter une photo (ou Coller)
                            </button>

                            <button
                                onClick={async () => {
                                    setIsExportingStl(true);
                                    const result = await exportAllProjectStls(project.id);
                                    if (result.success) {
                                        alert(result.message);
                                    } else {
                                        alert(result.error);
                                    }
                                    setIsExportingStl(false);
                                }}
                                disabled={isExportingStl}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-bold border border-blue-600/20 transition-all disabled:opacity-50"
                            >
                                <Box className="w-4 h-4" />
                                {isExportingStl ? "Extraction..." : "Tout extraire (STL)"}
                            </button>

                            <button
                                onClick={async () => {
                                    setIsExporting(true);
                                    const result = await exportAllProjectGcodes(project.id);
                                    if (result.success) {
                                        alert(result.message);
                                    } else {
                                        alert(result.error);
                                    }
                                    setIsExporting(false);
                                }}
                                disabled={isExporting}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-xl text-sm font-bold border border-green-500/20 transition-all disabled:opacity-50"
                            >
                                <Share className="w-4 h-4" />
                                {isExporting ? "Extraction..." : "Tout extraire (SD)"}
                            </button>

                            <button
                                onClick={async () => {
                                    if (confirm("⚠️ ATTENTION : La suppression d'un projet est IRREVERSIBLE.\n\nTous les fichiers associés (STL et G-codes) seront également supprimés du disque.\n\nSouhaitez-vous vraiment continuer ?")) {
                                        await deleteProject(project.id);
                                        router.push("/");
                                    }
                                }}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-bold border border-red-500/20 transition-all"
                            >
                                <Trash2 className="w-4 h-4" /> Supprimer ce projet
                            </button>
                        </div>
                    </div>

                    {/* Photo Carousel */}
                    {project.images.length > 0 && (
                        <div className="mt-8 border-t border-border/10 pt-8">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Photos du projet</h3>
                                {project.images.length > 4 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const maxIndex = project.images.length - 4;
                                                setCarouselIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
                                            }}
                                            className="p-1.5 hover:bg-slate-800 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="flex gap-1">
                                            {Array.from({ length: project.images.length - 3 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === carouselIndex ? "bg-primary w-3" : "bg-slate-700"}`}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const maxIndex = project.images.length - 4;
                                                setCarouselIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
                                            }}
                                            className="p-1.5 hover:bg-slate-800 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div
                                className="relative overflow-hidden group/carousel"
                                onMouseEnter={() => setIsCarouselPaused(true)}
                                onMouseLeave={() => setIsCarouselPaused(false)}
                            >
                                <div
                                    className="flex gap-4 transition-transform duration-700 ease-in-out px-2"
                                    style={{
                                        transform: `translateX(calc(-${(carouselIndex * 100) / 4}% - ${carouselIndex * 16}px))`
                                    }}
                                >
                                    {project.images.map((image) => (
                                        <div key={image.id} className="relative flex-none w-[calc(25%-12px)] group">
                                            <div
                                                className="aspect-video rounded-xl overflow-hidden border border-border bg-black/20 cursor-zoom-in"
                                                onClick={() => {
                                                    const fullUrl = `/api/files/${image.url.replace(/\\/g, '/').split('/').map(seg => encodeURIComponent(seg)).join('/')}`;
                                                    setSelectedFullImage(fullUrl);
                                                }}
                                            >
                                                <img
                                                    src={`/api/files/${image.url.replace(/\\/g, '/').split('/').map(seg => encodeURIComponent(seg)).join('/')}`}
                                                    alt="Project detail"
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            </div>
                                            <button
                                                onClick={async () => await deleteProjectImage(image.id)}
                                                className="absolute top-2 right-2 p-1.5 bg-destructive/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left Column: Files Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-6 py-5 border-b border-border/50 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                                <Box className="w-6 h-6 text-blue-500" />
                                Fichiers du projet
                                <span className="px-2 py-0.5 bg-slate-800 text-muted-foreground text-xs rounded-full font-medium">
                                    {project.stls.length}
                                </span>
                            </h2>
                            <div className="flex items-center gap-2">
                                {localPath && (
                                    <button
                                        onClick={() => {
                                            setScanActionType('folder');
                                            setIsScanChoiceModalOpen(true);
                                        }}
                                        disabled={isScanning}
                                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                                    >
                                        <FolderSearch className="w-4 h-4" />
                                        {isScanning ? "Scan..." : "Scanner"}
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setScanActionType('file');
                                        setIsScanChoiceModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground hover:bg-blue-500 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/10"
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
                                        className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                        title="Tout supprimer"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-6">
                            {project.stls.length === 0 ? (
                                <div className="text-center py-20 bg-card/40 rounded-2xl border-2 border-dashed border-border">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Box className="w-8 h-8 text-muted-foreground/60" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-300">Aucun fichier STL</h3>
                                    <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Commencez par ajouter des fichiers STL ou scannez le dossier local du projet.</p>
                                    <button
                                        onClick={() => {
                                            setScanActionType('file');
                                            setIsScanChoiceModalOpen(true);
                                        }}
                                        className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-foreground rounded-xl text-sm font-bold transition-all"
                                    >
                                        Ajouter mon premier fichier
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {project.stls.map((stl) => {
                                        const gcode = stl.slicers?.[0];
                                        return (
                                            <div key={stl.id} className="group bg-slate-800/20 hover:bg-background border border-border/50 hover:border-blue-500/30 rounded-xl overflow-hidden transition-all duration-300">
                                                <div className="flex items-stretch h-28 sm:h-24">
                                                    {/* STL Thumbnail - Small Square */}
                                                    <div className="w-28 sm:w-24 h-full shrink-0 border-r border-border/50">
                                                        <StlThumbnail url={`/api/files/${stl.filePath}`} />
                                                    </div>

                                                    <div className="flex-1 min-w-0 flex items-center px-6 gap-6">
                                                        {/* Main Info: Name, Description, Path & G-code */}
                                                        <div className="flex-1 min-w-0 flex flex-col justify-center py-3 gap-1.5">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-3 h-3 rounded-full shrink-0 ${stl.filePath.includes(":") || stl.filePath.startsWith("/") ? "bg-yellow-500" : "bg-blue-500"}`} />
                                                                <h4 className="text-slate-100 font-bold text-lg sm:text-xl truncate" title={stl.name}>{stl.name}</h4>
                                                            </div>

                                                            {/* STL Description / Comment Area */}
                                                            <div className="flex items-center gap-2 group/desc">
                                                                <Edit2 className="w-3 h-3 text-muted-foreground/60 group-hover/desc:text-blue-500 transition-colors shrink-0" />
                                                                <input
                                                                    type="text"
                                                                    defaultValue={stl.comment || ""}
                                                                    placeholder="Ajouter une description..."
                                                                    onBlur={(e) => updateStlComment(stl.id, e.target.value)}
                                                                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                                                    className="w-full bg-transparent text-sm text-muted-foreground focus:text-slate-100 focus:outline-none placeholder:text-slate-700 transition-colors h-6"
                                                                />
                                                            </div>

                                                            {/* Compact G-code Badge/Info */}
                                                            {gcode ? (
                                                                <div className="flex items-center gap-4 px-3 py-1 bg-card/40 rounded-lg border border-border/40 w-fit mt-1">
                                                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)] shrink-0" />
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="text-xs text-slate-300 font-bold truncate max-w-[200px]" title={gcode.name}>
                                                                            {gcode.name}
                                                                        </span>
                                                                        <div className="flex items-center gap-4 shrink-0">
                                                                            <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5">
                                                                                <span className="opacity-50 text-[10px]">⏱️</span> {Math.floor((gcode.printTime || 0) / 3600)}h {Math.floor(((gcode.printTime || 0) % 3600) / 60)}m
                                                                            </span>
                                                                            <span className="text-xs text-muted-foreground font-bold flex items-center gap-1.5">
                                                                                <span className="opacity-50 text-[10px]">🧶</span> {Math.round(((gcode.filamentLen || 0) / 1000) * 10) / 10}m
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setIsGcodeModalOpen({ isOpen: true, stlId: stl.id })}
                                                                    className="flex items-center gap-2 text-xs font-black text-muted-foreground/60 hover:text-primary uppercase tracking-tight w-fit mt-1"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Lier G-code
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Stats & Actions Area */}
                                                        <div className="flex items-center gap-8 shrink-0">
                                                            {/* Quantity Control - Redesigned with + / - buttons */}
                                                            <div className="flex items-center bg-card/80 rounded-xl border border-border/50 overflow-hidden shadow-inner">
                                                                <button
                                                                    onClick={() => updateStlQuantity(stl.id, Math.max(1, stl.quantity - 1))}
                                                                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-slate-800 border-r border-border/50 transition-all active:scale-90"
                                                                    title="Diminuer"
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <div className="px-4 py-2 flex items-center justify-center min-w-[3rem]">
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none mb-1">Qté</span>
                                                                        <span className="text-base text-primary font-black leading-none">{stl.quantity}</span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => updateStlQuantity(stl.id, stl.quantity + 1)}
                                                                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-slate-800 border-l border-border/50 transition-all active:scale-90"
                                                                    title="Augmenter"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            {/* Printed Progress Control */}
                                                            <div className="flex items-center bg-card/80 rounded-xl border border-border/50 overflow-hidden shadow-inner shrink-0">
                                                                <button
                                                                    onClick={() => handleUpdatePrintedQty(stl.id, stl.printedQty, -1, stl.quantity)}
                                                                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-slate-800 border-r border-border/50 transition-all active:scale-90 disabled:opacity-50"
                                                                    title="Diminuer"
                                                                    disabled={isPending}
                                                                >
                                                                    <Minus className="w-3 h-3" />
                                                                </button>
                                                                <div className={`px-5 py-2 flex flex-col items-center justify-center min-w-[5.5rem] transition-all ${stl.printedQty >= stl.quantity
                                                                    ? "bg-green-500/20 text-green-400"
                                                                    : stl.printedQty > 0
                                                                        ? "bg-orange-500/20 text-orange-400"
                                                                        : "bg-background/30 text-muted-foreground"
                                                                    }`}>
                                                                    <span className="text-[8px] font-black uppercase tracking-widest leading-none mb-1">Imprimé</span>
                                                                    <span className="text-sm font-black leading-none">{isPending ? "..." : `${stl.printedQty || 0} / ${stl.quantity}`}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleUpdatePrintedQty(stl.id, stl.printedQty, 1, stl.quantity)}
                                                                    className="px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-slate-800 border-l border-border/50 transition-all active:scale-90 disabled:opacity-50"
                                                                    title="Augmenter"
                                                                    disabled={isPending}
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-0.5">
                                                                <button
                                                                    onClick={() => setSelectedStl({ stl, gcode })}
                                                                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-slate-700 rounded-lg transition-all"
                                                                    title="Aperçu 3D"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const result = await exportStl(stl.id);
                                                                        if (result.success) {
                                                                            alert("STL exporté avec succès !");
                                                                        } else {
                                                                            alert(result.error);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-blue-400/10 rounded-lg transition-all"
                                                                    title="Extraire STL vers SD"
                                                                >
                                                                    <Box className="w-4 h-4" />
                                                                </button>
                                                                {gcode && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            const result = await exportGcode(gcode.id);
                                                                            if (result.success) {
                                                                                alert("G-code exporté avec succès !");
                                                                            } else {
                                                                                alert(result.error);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 text-muted-foreground hover:text-green-400 hover:bg-green-400/10 rounded-lg transition-all"
                                                                        title="Extraire G-code vers SD"
                                                                    >
                                                                        <Share className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={async () => {
                                                                        if (confirm("Supprimer ce fichier STL ?")) {
                                                                            await deleteStl(stl.id);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                                    title="Supprimer"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Sidebar */}
                <aside className="space-y-6">
                    {/* Configuration Card */}
                    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-border/50 bg-white/5">
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <TagIcon className="w-4 h-4 text-blue-500" />
                                Configuration
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Local Folder */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Dossier Local</label>
                                <div className="bg-background/40 rounded-xl p-4 border border-border/40 hover:border-border/60 transition-colors">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-yellow-500/10 rounded-lg">
                                            <FolderOpen className="w-5 h-5 text-yellow-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {isEditingPath ? (
                                                <input
                                                    type="text"
                                                    value={localPath}
                                                    onChange={(e) => setLocalPath(e.target.value)}
                                                    className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-blue-500 outline-none"
                                                    placeholder="C:\Users\..."
                                                />
                                            ) : (
                                                <div className="text-muted-foreground text-sm truncate font-medium" title={localPath || "Aucun dossier lié"}>
                                                    {localPath || "Aucun dossier lié"}
                                                </div>
                                            )}
                                        </div>
                                        {isEditingPath ? (
                                            <button
                                                onClick={async () => {
                                                    await updateProjectFolder(project.id, localPath);
                                                    setIsEditingPath(false);
                                                }}
                                                className="p-1 text-green-400 hover:bg-green-400/10 rounded-md"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditingPath(true)}
                                                className="p-1 text-muted-foreground hover:text-foreground"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                const defaultPath = await getAppConfig("DEFAULT_STL_FOLDER");
                                                const result = await pickFolder(defaultPath || undefined);
                                                if (result.success && result.path) {
                                                    setLocalPath(result.path);
                                                    await updateProjectFolder(project.id, result.path);
                                                }
                                            }}
                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-background hover:bg-slate-800 text-muted-foreground rounded-lg text-xs font-bold transition-all border border-border/50"
                                        >
                                            <Search className="w-3.5 h-3.5" /> Parcourir
                                        </button>
                                        {localPath && (
                                            <button
                                                onClick={() => openProjectFolder(localPath)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-bold transition-all"
                                            >
                                                <FolderOpen className="w-3.5 h-3.5" /> Ouvrir
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Filament */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Filament</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-primary/10 rounded-lg group-hover:bg-blue-500/20 transition-all">
                                        <Layers className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <select
                                        value={selectedFilamentId || ""}
                                        onChange={handleFilamentChange}
                                        className="w-full bg-background/40 border border-border/40 hover:border-blue-500/30 rounded-xl pl-12 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none"
                                    >
                                        <option value="" className="bg-background">Non défini</option>
                                        {filaments.map(f => (
                                            <option key={f.id} value={f.id} className="bg-background">{f.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>

                            {/* Printer */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Imprimante</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-all">
                                        <PrinterIcon className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <select
                                        value={selectedPrinterId || ""}
                                        onChange={handlePrinterChange}
                                        className="w-full bg-background/40 border border-border/40 hover:border-orange-500/30 rounded-xl pl-12 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer appearance-none"
                                    >
                                        <option value="" className="bg-background">Non définie</option>
                                        {printers.map(p => (
                                            <option key={p.id} value={p.id} className="bg-background">{p.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>

                            {/* Category */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Catégorie</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-all">
                                        <TagIcon className="w-4 h-4 text-green-500" />
                                    </div>
                                    <select
                                        value={selectedCategoryId || ""}
                                        onChange={handleCategoryChange}
                                        className="w-full bg-background/40 border border-border/40 hover:border-green-500/30 rounded-xl pl-12 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-all cursor-pointer appearance-none"
                                    >
                                        <option value="" className="bg-background">Général (Aucune)</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id} className="bg-background">{c.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Stats Breakdown Card */}
                    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-border/50 bg-white/5">
                            <h3 className="font-bold text-foreground">Détails financiers</h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Coût Filament</span>
                                    <span className="text-foreground font-medium">{filamentCost.toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Électricité</span>
                                    <span className="text-foreground font-medium">{electricityCost.toFixed(2)} €</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Amortissement Machine</span>
                                    <span className="text-foreground font-medium">{machineCost.toFixed(2)} €</span>
                                </div>
                                <div className="pt-4 border-t border-border/50 flex justify-between items-end">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Total Estimé</div>
                                        <div className="text-2xl font-black text-primary">{totalCost.toFixed(2)} €</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Prix/h</div>
                                        <div className="text-sm font-bold text-muted-foreground">
                                            {totalPrintTime > 0 ? (totalCost / (totalPrintTime / 3600)).toFixed(2) : "0.00"} €
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
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
                onSelect={async (mode: 'copy' | 'link') => {
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
                    stl={selectedStl.stl}
                    gcode={selectedStl.gcode}
                    onClose={() => setSelectedStl(null)}
                />
            )}
            {/* Lightbox Modal */}
            {selectedFullImage && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4 md:p-10"
                    onClick={() => {
                        setSelectedFullImage(null);
                        setZoomState({ isZoomed: false, x: 0, y: 0, scale: 2.5 });
                    }}
                    onWheel={(e) => {
                        if (!zoomState.isZoomed) return;
                        e.stopPropagation();
                        setZoomState(prev => {
                            const newScale = Math.min(Math.max(prev.scale + (e.deltaY < 0 ? 0.25 : -0.25), 1.5), 5.5);
                            return { ...prev, scale: newScale };
                        });
                    }}
                >
                    <button
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/20 z-[120] backdrop-blur-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFullImage(null);
                            setZoomState({ isZoomed: false, x: 0, y: 0, scale: 2.5 });
                        }}
                    >
                        <X className="w-8 h-8" />
                    </button>

                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-white/50 text-[10px] font-black tracking-[0.2em] uppercase backdrop-blur-sm z-[110] animate-in fade-in slide-in-from-bottom-4 duration-700 pointer-events-none flex items-center gap-4">
                        <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                            {zoomState.isZoomed ? "Vue Loupe Active" : "Prêt pour Zoom"}
                        </span>
                        {zoomState.isZoomed && (
                            <>
                                <div className="w-px h-3 bg-white/10" />
                                <span className="text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">x{zoomState.scale.toFixed(1)}</span>
                                <div className="w-px h-3 bg-white/10" />
                                <span className="flex items-center gap-2">
                                    <MousePointer2 className="w-3 h-3" /> Molette pour ajuster
                                </span>
                            </>
                        )}
                        {!zoomState.isZoomed && (
                            <>
                                <div className="w-px h-3 bg-white/10" />
                                <span>Clic pour explorer</span>
                            </>
                        )}
                    </div>

                    <div
                        className={`relative max-w-7xl w-full h-full flex items-center justify-center transition-all duration-500 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)] bg-black/40 ${zoomState.isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setZoomState(prev => ({ ...prev, isZoomed: !prev.isZoomed }));
                        }}
                        onMouseMove={(e) => {
                            if (!zoomState.isZoomed) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            setZoomState(prev => ({ ...prev, x, y }));
                        }}
                    >
                        <img
                            src={selectedFullImage}
                            alt="Project Full Size"
                            className="w-full h-full object-contain select-none transition-transform duration-300 ease-out will-change-transform"
                            style={zoomState.isZoomed ? {
                                transform: `scale(${zoomState.scale})`,
                                transformOrigin: `${zoomState.x}% ${zoomState.y}%`
                            } : {}}
                        />
                    </div>
                </div>
            )}
        </main>
    );
}

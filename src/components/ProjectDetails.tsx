import { useState, useEffect, useTransition } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ArrowLeft, Box, Upload, FolderOpen, Tag,
    Edit2, Save, Layers, Printer as PrinterIcon, Plus, ChevronDown,
    Trash2, Search, Minus, FolderSearch, Download,
    ExternalLink as LinkIcon, Image as ImageIcon, X, ChevronLeft,
    ChevronRight, Clock, Play, Pause
} from "lucide-react";
import * as db from "../lib/db";
import AddGcodeModal from "./AddGcodeModal";
import ScanChoiceModal from "./ScanChoiceModal";
import STLViewer from "./STLViewer";
import STLThumbnail from "./STLThumbnail";
import NewVersionModal from "./NewVersionModal";
import clsx from "clsx";

const electron = (window as any).electron;
const assets = (window as any).assets;

export default function ProjectDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const projectId = parseInt(id || "0");
    const [_isPending, startTransition] = useTransition();

    const [project, setProject] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isGcodeModalOpen, setIsGcodeModalOpen] = useState<{ isOpen: boolean; stlId: number | null }>({ isOpen: false, stlId: null });
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [description, setDescription] = useState("");
    const [isEditingPath, setIsEditingPath] = useState(false);
    const [localPath, setLocalPath] = useState("");
    const [viewingStl, setViewingStl] = useState<any>(null);
    const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState("");

    // Selection states
    const [filaments, setFilaments] = useState<any[]>([]);
    const [printers, setPrinters] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [versions, setVersions] = useState<any[]>([]);
    const [elecPrice, setElecPrice] = useState(0);

    const [isScanChoiceModalOpen, setIsScanChoiceModalOpen] = useState(false);
    const [scanActionType, setScanActionType] = useState<'folder' | 'file'>('folder');
    const [isScanning, setIsScanning] = useState(false);
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

    // UI states
    const [isAddingLink, setIsAddingLink] = useState(false);
    const [newLinkName, setNewLinkName] = useState("");
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [isCarouselPaused, setIsCarouselPaused] = useState(false);
    const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
    const [animateThumbnails, setAnimateThumbnails] = useState(false);

    useEffect(() => {
        loadData();
    }, [projectId]);

    useEffect(() => {
        if (!project || project.images.length <= 4 || isCarouselPaused) return;
        const maxIndex = project.images.length - 4;
        const interval = setInterval(() => {
            setCarouselIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
        }, 3000);
        return () => clearInterval(interval);
    }, [project?.images.length, isCarouselPaused]);

    useEffect(() => {
        const handlePaste = async (event: ClipboardEvent) => {
            console.log("[Paste] Event triggered");
            const items = event.clipboardData?.items;
            if (!items) {
                console.log("[Paste] No items in clipboard");
                return;
            }

            for (const item of Array.from(items)) {
                console.log("[Paste] Item type:", item.type);
                if (item.type.indexOf("image") !== -1) {
                    const blob = item.getAsFile();
                    if (!blob) {
                        console.log("[Paste] Could not get file from item");
                        continue;
                    }

                    console.log("[Paste] Found image, size:", blob.size);
                    const buffer = await blob.arrayBuffer();
                    const res = await db.uploadPastedImage(projectId, buffer, localPath);
                    if (res.success) {
                        console.log("[Paste] Image uploaded successfully");
                        loadData();
                    } else {
                        console.error("[Paste] Upload failed:", res.error);
                        alert(res.error);
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [projectId, localPath]);

    const loadData = async () => {
        setLoading(true);
        const p = await db.getProject(projectId);
        if (!p) {
            navigate("/");
            return;
        }
        setProject(p);
        setDescription(p.description || "");
        setEditedName(p.name || "");
        setLocalPath(p.localFolderPath || "");

        const [f, pr, c, v, ep, at] = await Promise.all([
            db.getFilaments(),
            db.getPrinters(),
            db.getCategories(),
            db.getProjectVersions(projectId),
            db.getAppConfig("ELECTRICITY_PRICE"),
            db.getAppConfig("ANIMATE_THUMBNAILS")
        ]);

        setFilaments(f);
        setPrinters(pr);
        setCategories(c);
        setVersions(v);
        setElecPrice(Number(ep) || 0.22);
        setAnimateThumbnails(at === "true");
        setLoading(false);
    };

    if (loading || !project) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground font-medium animate-pulse">Chargement de votre projet...</p>
        </div>
    );

    const selectedFilament = filaments.find(f => f.id === project.filamentId);
    const selectedPrinter = printers.find(p => p.id === project.printerId);

    // Totals
    const totalPrintTime = project.stls.reduce((acc: number, stl: any) => {
        const gcode = stl.slicers?.[0];
        return acc + ((gcode?.printTime || 0) * stl.quantity);
    }, 0);

    const remainingPrintTime = project.stls.reduce((acc: number, stl: any) => {
        const gcode = stl.slicers?.[0];
        const remainingQty = Math.max(0, stl.quantity - (stl.printedQty || 0));
        return acc + ((gcode?.printTime || 0) * remainingQty);
    }, 0);

    const totalFilamentLen = project.stls.reduce((acc: number, stl: any) => {
        const gcode = stl.slicers?.[0];
        return acc + ((gcode?.filamentLen || 0) * stl.quantity);
    }, 0);

    // Cost calculations
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

    const handleUpdatePrintedQty = (stlId: number, currentQty: number | undefined | null, delta: number, totalQty: number) => {
        const current = currentQty || 0;
        const newQty = Math.min(totalQty, Math.max(0, current + delta));
        startTransition(async () => {
            await db.updateStlPrintedQuantity(stlId, newQty);
            loadData();
        });
    };

    const handleAddImage = async () => {
        const selected = await electron.showOpenDialog({
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
            properties: ['openFile', 'multiSelections']
        });
        if (selected) {
            await db.addProjectImage(projectId, selected);
            loadData();
        }
    };

    const handleCreateVersion = async (name: string) => {
        try {
            console.log("Calling db.createProjectVersion...");
            const res = await db.createProjectVersion(projectId, name);
            console.log("Result:", res);
            if (res.success) {
                navigate(`/projects/${res.id}`);
            }
        } catch (error: any) {
            console.error("Failed to create version:", error);
            alert("Erreur lors de la création de la version : " + (error.message || error));
        }
    };

    const handleSetDefaultVersion = async () => {
        if (confirm("Définir cette version comme version par défaut pour ce projet ?")) {
            startTransition(async () => {
                await db.setDefaultVersion(projectId);
                loadData();
            });
        }
    };

    const handleExportStl = async (stl: any) => {
        const targetPath = await electron.showSaveDialog({
            defaultPath: stl.name,
            filters: [{ name: 'STL', extensions: ['stl'] }]
        });
        if (targetPath) {
            await electron.copyFile(stl.path, targetPath);
        }
    };

    const handleExportGcode = async (gcode: any) => {
        const targetPath = await electron.showSaveDialog({
            defaultPath: gcode.name,
            filters: [{ name: 'G-code', extensions: ['gcode', 'gco'] }]
        });
        if (targetPath) {
            await electron.copyFile(gcode.path, targetPath);
        }
    };

    const handleDeleteAllFiles = async () => {
        if (confirm("Supprimer tous les fichiers STL de ce projet ? Cette action est irréversible.")) {
            startTransition(async () => {
                await db.deleteProjectStls(projectId);
                loadData();
            });
        }
    };

    const handleExportAllStls = async () => {
        const folder = await electron.showOpenDialog({
            properties: ['openDirectory', 'createDirectory']
        });
        if (!folder) return;

        for (const stl of project.stls) {
            const fileName = stl.path.replace(/\\/g, '/').split('/').pop();
            const targetPath = `${folder}/${fileName}`;
            await electron.copyFile(stl.path, targetPath);
        }
        alert("Tous les fichiers STL ont été exportés !");
    };

    const handleExportAllGcodes = async () => {
        const folder = await electron.showOpenDialog({
            properties: ['openDirectory', 'createDirectory']
        });
        if (!folder) return;

        let count = 0;
        for (const stl of project.stls) {
            const gcode = stl.slicers?.[0];
            if (gcode) {
                const fileName = gcode.path.replace(/\\/g, '/').split('/').pop();
                const targetPath = `${folder}/${fileName}`;
                await electron.copyFile(gcode.path, targetPath);
                count++;
            }
        }
        alert(`${count} fichiers G-code ont été exportés !`);
    };

    const toggleAnimation = async () => {
        const newValue = !animateThumbnails;
        setAnimateThumbnails(newValue);
        await db.updateAppConfig("ANIMATE_THUMBNAILS", newValue.toString());
    };

    const handleSaveName = async () => {
        if (!editedName.trim()) return;
        setIsEditingName(false);
        await db.updateProjectName(projectId, editedName.trim());
        loadData();
    };

    return (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">
            {/* Project Header Section */}
            <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-2xl">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-primary/5 to-transparent pointer-events-none" />

                <div className="relative p-8 md:p-10">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                        <div className="space-y-4 flex-1">
                            <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mb-2 group">
                                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                Retour aux projets
                            </Link>

                            <div className="flex flex-wrap items-center gap-4">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-300">
                                        <input
                                            autoFocus
                                            value={editedName}
                                            onChange={e => setEditedName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveName();
                                                if (e.key === 'Escape') {
                                                    setIsEditingName(false);
                                                    setEditedName(project.name);
                                                }
                                            }}
                                            className="text-4xl font-extrabold text-foreground tracking-tight bg-background/50 border border-primary/30 rounded-xl px-4 py-1 outline-none focus:ring-2 focus:ring-primary/50 transition-all min-w-[300px]"
                                        />
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleSaveName(); }}
                                                className="p-2 text-green-400 hover:bg-green-400/10 rounded-xl transition-all"
                                                title="Enregistrer"
                                            >
                                                <Save className="w-6 h-6" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsEditingName(false); setEditedName(project.name); }}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                                                title="Annuler"
                                            >
                                                <X className="w-6 h-6" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 group/title cursor-pointer" onClick={() => {
                                        console.log("[Edit] Opening name editor for:", project.name);
                                        setEditedName(project.name);
                                        setIsEditingName(true);
                                    }}>
                                        <h1 className="text-4xl font-extrabold text-foreground tracking-tight">{project.name}</h1>
                                        <button className="p-1.5 text-muted-foreground/40 hover:text-primary opacity-0 group-hover/title:opacity-100 transition-all rounded-md hover:bg-primary/10">
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                                    <Layers className="w-4 h-4 text-primary" />
                                    <span className="text-primary font-semibold text-sm">{project.versionName || `v${project.versionNumber}`}</span>
                                </div>
                                {project.isDefault && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
                                        <span className="text-yellow-500 text-[10px] uppercase font-bold tracking-wider">Version par défaut</span>
                                    </div>
                                )}
                                {categories.find(c => c.id === project.categoryId)?.name.toLowerCase().includes("jeu de société") && (
                                    <button
                                        onClick={async () => {
                                            if (description && !confirm("Voulez-vous remplacer la description actuelle par une nouvelle génération IA ?")) return;
                                            setIsGeneratingDescription(true);
                                            try {
                                                const res = await db.generateProjectDescription(projectId, project.name);
                                                if (res.success && res.description) {
                                                    setDescription(res.description);
                                                    setProject({ ...project, description: res.description });
                                                    loadData(); // To refresh links too
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
                                {project.links.map((link: any) => (
                                    <div key={link.id} className="group/link relative flex items-center gap-2 px-3 py-1.5 bg-card/50 border border-border/50 rounded-lg hover:border-primary/50 transition-all">
                                        <LinkIcon className="w-3.5 h-3.5 text-primary" />
                                        <a href={link.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                                            {link.name}
                                        </a>
                                        <button onClick={() => db.deleteProjectLink(link.id).then(loadData)} className="opacity-0 group-hover/link:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {isAddingLink ? (
                                    <div className="flex items-center gap-2 bg-card border border-primary/30 rounded-lg p-1 animate-in fade-in slide-in-from-left-2">
                                        <input autoFocus placeholder="Nom" value={newLinkName} onChange={e => setNewLinkName(e.target.value)} className="bg-transparent text-xs px-2 py-1 outline-none w-24" />
                                        <input placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} className="bg-transparent text-xs px-2 py-1 outline-none w-32" />
                                        <button onClick={async () => {
                                            if (newLinkName && newLinkUrl) {
                                                await db.addProjectLink(projectId, newLinkName, newLinkUrl);
                                                setNewLinkName(""); setNewLinkUrl(""); setIsAddingLink(false); loadData();
                                            }
                                        }} className="p-1 text-primary"><Plus className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => setIsAddingLink(false)} className="p-1 text-destructive"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsAddingLink(true)} className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-all">
                                        <Plus className="w-3.5 h-3.5" /> Ajouter un lien
                                    </button>
                                )}
                            </div>

                            <div className="group relative max-w-2xl mt-4">
                                {isEditingDescription ? (
                                    <div className="space-y-3">
                                        <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-background/50 border border-border rounded-xl px-4 py-3 outline-none h-28 focus:ring-2 focus:ring-primary/50 transition-all" />
                                        <div className="flex gap-2">
                                            <button onClick={async () => { await db.updateProjectDescription(projectId, description); setIsEditingDescription(false); loadData(); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20"><Save className="w-4 h-4" /> Enregistrer</button>
                                            <button onClick={() => setIsEditingDescription(false)} className="px-4 py-2 bg-card text-muted-foreground rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">Annuler</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-3 group/desc">
                                        <p className="text-muted-foreground text-lg leading-relaxed">{project.description || "Aucune description pour ce projet."}</p>
                                        <button onClick={() => setIsEditingDescription(true)} className="p-1.5 text-muted-foreground/60 hover:text-primary opacity-0 group-hover/desc:opacity-100 transition-all mt-1 rounded-md hover:bg-primary/10"><Edit2 className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-6 pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                        <span className="text-xl">⏱️</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Temps d'impression</div>
                                        <div className="text-foreground font-bold">
                                            {Math.floor(totalPrintTime / 3600)}h {Math.floor((totalPrintTime % 3600) / 60)}m
                                            {remainingPrintTime > 0 && remainingPrintTime < totalPrintTime && (
                                                <span className="text-orange-500 ml-2" title="Temps restant">(Reste: {Math.floor(remainingPrintTime / 3600)}h {Math.floor((remainingPrintTime % 3600) / 60)}m)</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                                        <span className="text-xl">🧶</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Matière consommée</div>
                                        <div className="text-foreground font-bold">{Math.round(totalWeightG * 10) / 10}g <span className="text-muted-foreground font-normal">({Math.round((totalFilamentLen / 1000) * 100) / 100}m)</span></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <span className="text-xl">💰</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Estimation Coût</div>
                                        <div className="text-primary font-bold">{totalCost.toFixed(2)} €</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 w-full md:w-auto self-stretch md:self-start">
                            <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl border border-border">
                                <select
                                    value={projectId}
                                    onChange={(e) => navigate(`/projects/${e.target.value}`)}
                                    className="bg-transparent text-foreground px-3 py-2 text-sm font-bold focus:outline-none cursor-pointer flex-1 min-w-[120px]"
                                >
                                    {versions.map(v => (
                                        <option key={v.id} value={v.id} className="bg-card">
                                            {v.isDefault ? "⭐ " : ""}{v.versionName || `v${v.versionNumber}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button onClick={() => setIsNewVersionModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-foreground rounded-xl text-sm font-bold border border-border transition-all">
                                <Plus className="w-4 h-4" /> Nouvelle version
                            </button>
                            {!project.isDefault && (
                                <button onClick={handleSetDefaultVersion} className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-xl text-sm font-bold border border-yellow-500/20 transition-all">
                                    ⭐ Définir par défaut
                                </button>
                            )}
                            <button onClick={handleAddImage} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-bold border border-primary/20 transition-all" title="Sélectionner des fichiers ou coller (Ctrl+V)">
                                <ImageIcon className="w-4 h-4" /> Ajouter une photo (ou Coller)
                            </button>
                            <button onClick={() => { if (confirm("Supprimer ce projet ?")) db.deleteProject(projectId).then(() => navigate("/")) }} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-sm font-bold border border-red-500/20 transition-all">
                                <Trash2 className="w-4 h-4" /> Supprimer ce projet
                            </button>
                        </div>
                    </div>

                    {/* Photo Carousel */}
                    {project.images.length > 0 && (
                        <div className="mt-8 border-t border-border/10 pt-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Photos du projet</h3>
                                {project.images.length > 4 && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCarouselIndex(prev => prev <= 0 ? project.images.length - 4 : prev - 1)} className="p-1 hover:bg-white/5 rounded-full text-muted-foreground transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                        <div className="flex gap-1 mx-1">
                                            {Array.from({ length: project.images.length - 3 }).map((_, i) => (
                                                <div key={i} className={clsx("w-1.5 h-1.5 rounded-full transition-all", i === carouselIndex ? "bg-primary w-3" : "bg-slate-700")} />
                                            ))}
                                        </div>
                                        <button onClick={() => setCarouselIndex(prev => prev >= project.images.length - 4 ? 0 : prev + 1)} className="p-1 hover:bg-white/5 rounded-full text-muted-foreground transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                    </div>
                                )}
                            </div>
                            <div className="relative overflow-hidden group/carousel" onMouseEnter={() => setIsCarouselPaused(true)} onMouseLeave={() => setIsCarouselPaused(false)}>
                                <div className="flex gap-4 transition-transform duration-700 ease-in-out" style={{ transform: `translateX(calc(-${(carouselIndex * 100) / 4}% - ${carouselIndex * 16}px))` }}>
                                    {project.images.map((img: any) => (
                                        <div key={img.id} className="relative flex-none w-[calc(25%-12px)] group">
                                            <div onClick={() => setSelectedFullImage(assets.convertFileSrc(img.url))} className="aspect-video rounded-xl overflow-hidden border border-border bg-black/20 cursor-zoom-in">
                                                <img src={assets.convertFileSrc(img.url)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Detail" />
                                            </div>
                                            <button onClick={async () => {
                                                if (!img.id) { console.error("No image ID found for deletion"); return; }
                                                console.log("Deleting image:", img.id);
                                                await db.deleteProjectImage(img.id);
                                                loadData();
                                            }} className="absolute top-2 right-2 p-1.5 bg-destructive/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive">
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
                            <h2 className="text-xl font-bold flex items-center gap-3"><Box className="w-6 h-6 text-primary" /> Fichiers du projet</h2>
                            <div className="flex items-center gap-2">
                                <button onClick={toggleAnimation} className={clsx("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border", animateThumbnails ? "bg-primary/10 text-primary border-primary/30" : "bg-slate-800/10 text-muted-foreground border-border/50")} title={animateThumbnails ? "Désactiver l'animation" : "Activer l'animation"}>
                                    {animateThumbnails ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    Animation
                                </button>
                                {project.stls.length > 0 && (
                                    <>
                                        <button onClick={handleExportAllStls} className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl text-sm font-bold transition-all border border-blue-500/20" title="Exporter tous les STL">
                                            <Download className="w-4 h-4" /> STL
                                        </button>
                                        <button onClick={handleExportAllGcodes} className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-xl text-sm font-bold transition-all border border-green-500/20" title="Exporter tous les G-code">
                                            <Download className="w-4 h-4" /> G-code
                                        </button>
                                        <button onClick={handleDeleteAllFiles} className="px-4 py-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl text-sm font-bold transition-all border border-destructive/20" title="Supprimer tout">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                {localPath && (
                                    <button onClick={() => { setScanActionType('folder'); setIsScanChoiceModalOpen(true); }} disabled={isScanning} className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-xl text-sm font-bold transition-all disabled:opacity-50 border border-yellow-500/20">
                                        <FolderSearch className="w-4 h-4" /> Scanner
                                    </button>
                                )}
                                <button onClick={() => { setScanActionType('file'); setIsScanChoiceModalOpen(true); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20">
                                    <Upload className="w-4 h-4" /> Ajouter
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {project.stls.length === 0 ? (
                                <div className="text-center py-20 bg-background/40 rounded-2xl border-2 border-dashed border-border">
                                    <Box className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-300">Aucun fichier STL</h3>
                                    <p className="text-muted-foreground mt-1 max-w-sm mx-auto">Ajoutez des fichiers pour commencer l'impression.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {project.stls.map((stl: any) => {
                                        const gcode = stl.slicers?.[0];
                                        return (
                                            <div key={stl.id} className="group bg-slate-800/10 hover:bg-slate-800/20 border border-border/50 hover:border-primary/30 rounded-xl overflow-hidden transition-all duration-300">
                                                <div className="flex items-center p-4 gap-6">
                                                    <div onClick={() => setViewingStl(stl)} className="w-20 h-20 bg-black/20 rounded-lg flex items-center justify-center border border-border/50 overflow-hidden cursor-zoom-in group-hover:border-primary/50 transition-colors">
                                                        <STLThumbnail path={stl.path} isAnimated={animateThumbnails} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 space-y-2">
                                                        <h4 className="font-bold text-lg truncate" title={stl.name}>{stl.name}</h4>
                                                        <div className="flex items-center gap-2 group/desc">
                                                            <Edit2 className="w-3 h-3 text-muted-foreground/60 group-hover/desc:text-primary" />
                                                            <input type="text" defaultValue={stl.comment || ""} placeholder="Ajouter un commentaire..." onBlur={e => db.updateStlComment(stl.id, e.target.value)} className="bg-transparent text-sm text-muted-foreground outline-none w-full" />
                                                        </div>
                                                        {gcode ? (
                                                            <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground bg-primary/5 px-2 py-1 rounded w-fit">
                                                                <span className="flex items-center gap-1"><span className="text-green-500">●</span> {gcode.name}</span>
                                                                <span>⏱️ {Math.floor(gcode.printTime / 3600)}h {Math.floor((gcode.printTime % 3600) / 60)}m</span>
                                                                <span>🧶 {Math.round(gcode.filamentLen / 100) / 10}m</span>
                                                                <button onClick={() => handleExportGcode(gcode)} className="ml-2 p-1 hover:bg-primary/20 rounded text-primary transition-colors" title="Exporter G-code">
                                                                    <Download className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setIsGcodeModalOpen({ isOpen: true, stlId: stl.id })} className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 uppercase tracking-tighter">
                                                                <Plus className="w-3.5 h-3.5" /> Lier G-code
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0">
                                                        {/* Target Quantity Selector */}
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="flex items-center bg-slate-800/50 rounded-lg border border-border/50 overflow-hidden h-9">
                                                                <button onClick={async () => {
                                                                    const newQ = Math.max(1, (stl.quantity || 1) - 1);
                                                                    await db.updateStlQuantity(stl.id, newQ);
                                                                    loadData();
                                                                }} className="px-2 py-1 text-muted-foreground hover:bg-slate-700 transition-colors"><Minus className="w-3 h-3" /></button>
                                                                <div className="px-3 py-1 flex flex-col items-center justify-center min-w-[2.5rem]">
                                                                    <span className="text-[10px] font-bold text-primary leading-none">{stl.quantity || 1}</span>
                                                                </div>
                                                                <button onClick={async () => {
                                                                    const newQ = (stl.quantity || 1) + 1;
                                                                    await db.updateStlQuantity(stl.id, newQ);
                                                                    loadData();
                                                                }} className="px-2 py-1 text-muted-foreground hover:bg-slate-700 transition-colors"><Plus className="w-3 h-3" /></button>
                                                            </div>
                                                            <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest leading-none">Besoin</span>
                                                        </div>

                                                        {/* Printed Quantity Counter */}
                                                        <div className="flex items-center bg-background/50 rounded-xl border border-border/50 overflow-hidden">
                                                            <button onClick={() => handleUpdatePrintedQty(stl.id, stl.printedQty, -1, stl.quantity || 1)} className="px-3 py-2 text-muted-foreground hover:bg-slate-800 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                                                            <div className={clsx("px-4 py-2 flex flex-col items-center justify-center min-w-[5rem]", (stl.printedQty || 0) >= (stl.quantity || 1) ? "bg-green-500/20 text-green-400" : (stl.printedQty || 0) > 0 ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground")}>
                                                                <span className="text-[8px] font-black uppercase tracking-widest leading-none mb-1">Imprimé</span>
                                                                <span className="text-sm font-black leading-none">{stl.printedQty || 0} / {stl.quantity || 1}</span>
                                                            </div>
                                                            <button onClick={() => handleUpdatePrintedQty(stl.id, stl.printedQty, 1, stl.quantity || 1)} className="px-3 py-2 text-muted-foreground hover:bg-slate-800 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleExportStl(stl)} className="p-1.5 text-muted-foreground/40 hover:text-primary transition-colors" title="Exporter STL">
                                                                <Download className="w-5 h-5" />
                                                            </button>
                                                            <button onClick={() => { if (confirm("Supprimer ce fichier STL ?")) db.deleteStl(stl.id).then(loadData) }} className="p-1.5 text-muted-foreground/40 hover:text-red-500 transition-colors" title="Supprimer STL">
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
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
                    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-border/50 bg-white/5">
                            <h3 className="font-bold flex items-center gap-2 text-primary font-mono text-sm uppercase tracking-widest"><Tag className="w-4 h-4" /> Configuration</h3>
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
                                                <input type="text" value={localPath} onChange={(e) => setLocalPath(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/50" />
                                            ) : (
                                                <div className="text-muted-foreground text-sm truncate font-medium" title={localPath || "Aucun dossier lié"}>{localPath || "Aucun dossier lié"}</div>
                                            )}
                                        </div>
                                        <button onClick={async () => { if (isEditingPath) { await db.updateProjectFolder(projectId, localPath); setIsEditingPath(false); } else { setIsEditingPath(true); } }} className="p-1 text-muted-foreground hover:text-foreground">{isEditingPath ? <Save className="w-4 h-4 text-green-400" /> : <Edit2 className="w-3.5 h-3.5" />}</button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={async () => { const res = await electron.showOpenDialog({ properties: ['openDirectory'] }); if (res) { setLocalPath(res); await db.updateProjectFolder(projectId, res); } }} className="flex-1 flex items-center justify-center gap-2 py-2 bg-background hover:bg-slate-800 text-muted-foreground rounded-lg text-xs font-bold transition-all border border-border/50"><Search className="w-3.5 h-3.5" /> Parcourir</button>
                                        {localPath && <button onClick={() => { electron.openPath(localPath) }} className="flex-1 flex items-center justify-center gap-2 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg text-xs font-bold transition-all"><FolderOpen className="w-3.5 h-3.5" /> Ouvrir</button>}
                                    </div>
                                </div>
                            </div>

                            {/* Selects: Filament, Printer, Category */}
                            {[
                                { label: "Filament", icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10", value: project.filamentId, items: filaments, onChange: (id: number) => db.updateProjectFilament(projectId, id).then(loadData) },
                                { label: "Imprimante", icon: PrinterIcon, color: "text-orange-500", bg: "bg-orange-500/10", value: project.printerId, items: printers, onChange: (id: number) => db.updateProjectPrinter(projectId, id).then(loadData) },
                                { label: "Catégorie", icon: Tag, color: "text-green-500", bg: "bg-green-500/10", value: project.categoryId, items: categories, onChange: (id: number) => db.updateProjectCategory(projectId, id).then(loadData) }
                            ].map((s, i) => (
                                <div key={i} className="space-y-2">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">{s.label}</label>
                                    <div className="relative group">
                                        <div className={clsx("absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-lg group-hover:bg-opacity-20 transition-all", s.bg)}>
                                            <s.icon className={clsx("w-4 h-4", s.color)} />
                                        </div>
                                        <select
                                            value={s.value || ""}
                                            onChange={(e) => s.onChange(parseInt(e.target.value))}
                                            className="w-full bg-background/40 border border-border/40 hover:border-primary/30 rounded-xl pl-12 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer appearance-none"
                                        >
                                            <option value="" className="bg-background">Non défini</option>
                                            {s.items.map(item => <option key={item.id} value={item.id} className="bg-background">{item.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financial details */}
                    <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-border/50 bg-white/5">
                            <h3 className="font-bold text-foreground">Détails financiers</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Coût Filament</span>
                                <span className="text-foreground font-medium">{filamentCost.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Électricité</span>
                                <span className="text-foreground font-medium">{electricityCost.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Machine</span>
                                <span className="text-foreground font-medium">{machineCost.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-border/10">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>Temps Restant</span>
                                </div>
                                <span className="text-orange-400 font-bold font-mono text-xs">
                                    {Math.floor(remainingPrintTime / 3600)}h {Math.floor((remainingPrintTime % 3600) / 60)}m
                                </span>
                            </div>
                            <div className="pt-4 border-t border-border/50 flex justify-between items-end">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono">Total Estimé</div>
                                    <div className="text-2xl font-black text-primary">{totalCost.toFixed(2)} €</div>
                                </div>
                                <div className="text-right text-[10px] uppercase font-bold text-muted-foreground tracking-wider font-mono font-mono">
                                    {totalPrintTime > 0 ? (totalCost / (totalPrintTime / 3600)).toFixed(2) : "0.00"} € / h
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Modals & Lightbox */}
            <ScanChoiceModal
                isOpen={isScanChoiceModalOpen}
                onClose={() => setIsScanChoiceModalOpen(false)}
                onSelect={async (mode) => {
                    setIsScanChoiceModalOpen(false); setIsScanning(true);
                    try {
                        if (scanActionType === 'folder') {
                            const res = await db.scanLocalStls(projectId, localPath, mode);
                            alert(`${res.addedCount} fichiers ajoutés.`);
                        } else {
                            const path = await electron.showOpenDialog({ filters: [{ name: 'STL', extensions: ['stl'] }], properties: ['openFile'] });
                            if (path) await db.addSingleStl(projectId, path, mode);
                        }
                        loadData();
                    } finally { setIsScanning(false); }
                }}
            />

            {isGcodeModalOpen.isOpen && (
                <AddGcodeModal
                    onClose={() => setIsGcodeModalOpen({ isOpen: false, stlId: null })}
                    onSuccess={async (data) => {
                        if (isGcodeModalOpen.stlId) {
                            await db.addSlicerConfig(isGcodeModalOpen.stlId, data);
                            loadData();
                        }
                    }}
                />
            )}

            {selectedFullImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in duration-300" onClick={() => setSelectedFullImage(null)}>
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <img src={selectedFullImage} className="w-full h-full object-contain rounded-lg shadow-2xl" alt="Plein écran" />
                        <button className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors" onClick={() => setSelectedFullImage(null)}>
                            <X className="w-8 h-8" />
                        </button>
                    </div>
                </div>
            )}

            {viewingStl && (
                <STLViewer
                    stl={viewingStl}
                    gcode={viewingStl.slicers?.[0]}
                    onClose={() => setViewingStl(null)}
                />
            )}

            <NewVersionModal
                isOpen={isNewVersionModalOpen}
                onClose={() => setIsNewVersionModalOpen(false)}
                onConfirm={handleCreateVersion}
                defaultName={`v${versions.length + 1}`}
            />
        </main>
    );
}

import { useState, useEffect } from "react";
import { X, Save, Key, Globe, Brain, Check, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiService } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsPanelProps {
    onClose: () => void;
}

interface OpenRouterModel {
    id: string;
    name: string;
    description: string;
    provider: string;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
    const [keys, setKeys] = useState<{
        openai_api_key: string;
        anthropic_api_key: string;
        openrouter_api_key: string;
    }>({
        openai_api_key: "",
        anthropic_api_key: "",
        openrouter_api_key: "",
    });

    const [availableORModels, setAvailableORModels] = useState<OpenRouterModel[]>([]);
    const [selectedORModels, setSelectedORModels] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        loadSettings();
        syncOpenRouterModels();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await apiService.getSettings();
            setKeys({
                openai_api_key: settings.openai_api_key || "",
                anthropic_api_key: settings.anthropic_api_key || "",
                openrouter_api_key: settings.openrouter_api_key || "",
            });

            const selected = settings.openrouter_selected_models
                ? JSON.parse(settings.openrouter_selected_models)
                : [];
            setSelectedORModels(selected);
        } catch (error) {
            console.error("Error loading settings:", error);
        }
    };

    const syncOpenRouterModels = async () => {
        setIsFetchingModels(true);
        try {
            const models = await apiService.getOpenRouterModels();
            setAvailableORModels(models);
        } catch (error) {
            console.error("Error fetching OpenRouter models:", error);
        } finally {
            setIsFetchingModels(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                apiService.updateSetting("openai_api_key", keys.openai_api_key),
                apiService.updateSetting("anthropic_api_key", keys.anthropic_api_key),
                apiService.updateSetting("openrouter_api_key", keys.openrouter_api_key),
                apiService.updateSetting("openrouter_selected_models", JSON.stringify(selectedORModels)),
            ]);
            toast({
                title: "Settings saved",
                description: "Your configuration has been updated successfully.",
            });
            onClose();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save settings.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleModel = (modelId: string) => {
        setSelectedORModels(prev =>
            prev.includes(modelId)
                ? prev.filter(id => id !== modelId)
                : [...prev, modelId]
        );
    };

    const filteredModels = availableORModels.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-sidebar border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border p-6 bg-secondary/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Key className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">AI Settings</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Manage your API providers and specialized models</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-secondary/80">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue="anthropic" className="flex flex-col h-full">
                        <div className="border-b border-border bg-muted/30 px-6">
                            <TabsList className="bg-transparent h-12 gap-6 p-0">
                                <TabsTrigger
                                    value="anthropic"
                                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-1 text-sm font-medium transition-all"
                                >
                                    <Brain className="h-4 w-4 mr-2 text-orange-400" />
                                    Anthropic
                                </TabsTrigger>
                                <TabsTrigger
                                    value="openai"
                                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-1 text-sm font-medium transition-all"
                                >
                                    <Brain className="h-4 w-4 mr-2 text-blue-400" />
                                    OpenAI
                                </TabsTrigger>
                                <TabsTrigger
                                    value="openrouter"
                                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-1 text-sm font-medium transition-all"
                                >
                                    <Globe className="h-4 w-4 mr-2 text-purple-400" />
                                    OpenRouter
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 p-8 overflow-hidden">
                            <TabsContent value="anthropic" className="mt-0 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Brain className="h-5 w-5 text-orange-400" />
                                        Anthropic Configuration
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                                            API Key
                                        </label>
                                        <Input
                                            type="password"
                                            placeholder="sk-ant-..."
                                            value={keys.anthropic_api_key}
                                            onChange={(e) => setKeys({ ...keys, anthropic_api_key: e.target.value })}
                                            className="bg-chat-input h-12 border-border/50 focus:ring-primary/30"
                                        />
                                        <p className="text-[11px] text-muted-foreground flex items-start gap-2 pt-1">
                                            <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                            Provides access to Claude 3.5 models. Your key is stored locally and never shared.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="openai" className="mt-0 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Brain className="h-5 w-5 text-blue-400" />
                                        OpenAI Configuration
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                                            API Key
                                        </label>
                                        <Input
                                            type="password"
                                            placeholder="sk-..."
                                            value={keys.openai_api_key}
                                            onChange={(e) => setKeys({ ...keys, openai_api_key: e.target.value })}
                                            className="bg-chat-input h-12 border-border/50 focus:ring-primary/30"
                                        />
                                        <p className="text-[11px] text-muted-foreground flex items-start gap-2 pt-1">
                                            <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                            Standard GPT-4o models access. Ensure your key has appropriate permissions and credits.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="openrouter" className="mt-0 flex-1 flex flex-col min-h-0 outline-none data-[state=inactive]:hidden">
                                <div className="flex-1 flex flex-col min-h-0 space-y-6">
                                    {/* API Key section */}
                                    <div className="space-y-4 shrink-0">
                                        <div className="flex items-center gap-2 text-sm font-semibold">
                                            <Globe className="h-5 w-5 text-purple-400" />
                                            OpenRouter Configuration
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                                                API Key
                                            </label>
                                            <Input
                                                type="password"
                                                placeholder="sk-or-..."
                                                value={keys.openrouter_api_key}
                                                onChange={(e) => setKeys({ ...keys, openrouter_api_key: e.target.value })}
                                                className="bg-chat-input h-12 border-border/50 focus:ring-primary/30"
                                            />
                                            <p className="text-[11px] text-muted-foreground italic">
                                                Access to hundreds of models, including specialized free versions.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Model Selection section */}
                                    <div className="flex-1 flex flex-col min-h-0 space-y-4">
                                        <div className="flex items-center justify-between shrink-0">
                                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                                                Selected Models ({selectedORModels.length})
                                            </div>
                                            <div className="relative w-48">
                                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search models..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="h-9 pl-9 text-xs bg-muted/50"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex-1 min-h-[200px] border border-border/50 rounded-xl bg-muted/10 overflow-hidden relative">
                                            <ScrollArea className="absolute inset-0">
                                                <div className="p-4 space-y-2">
                                                    {isFetchingModels ? (
                                                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                                                            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                                            <span className="text-xs">Fetching available models...</span>
                                                        </div>
                                                    ) : filteredModels.length > 0 ? (
                                                        filteredModels.map((model) => (
                                                            <div
                                                                key={model.id}
                                                                className={`flex items-start gap-4 p-3.5 rounded-xl border transition-all cursor-pointer group ${selectedORModels.includes(model.id)
                                                                    ? 'bg-primary/10 border-primary/30'
                                                                    : 'hover:bg-muted/80 border-transparent'
                                                                    }`}
                                                                onClick={() => toggleModel(model.id)}
                                                            >
                                                                <div className="mt-1">
                                                                    <Checkbox
                                                                        checked={selectedORModels.includes(model.id)}
                                                                        onCheckedChange={() => toggleModel(model.id)}
                                                                        className="data-[state=checked]:bg-primary h-4 w-4 rounded-md"
                                                                    />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="text-sm font-bold truncate">{model.name}</span>
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded-full font-bold border border-green-500/20">FREE</span>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground truncate opacity-70 font-mono">{model.id}</p>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="text-center py-12 text-muted-foreground italic text-sm">
                                                            No free models found matching "{searchQuery}"
                                                        </div>
                                                    )}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-secondary/10 flex gap-4">
                    <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        className="flex-1 h-12 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20"
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                        {isLoading ? "Saving changes..." : <><Save className="h-5 w-5" /> Apply Configuration</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { User, Key, Bell, Moon, Shield, ExternalLink, Plus, X } from "lucide-react";
import { AI_PROVIDERS, AI_DEFAULT_MODELS, AI_PROVIDER_NAMES } from "@/lib/ai-models";
import { getActiveProvider, getProviderKeys, getProviderModels, loadRemoteProviderKeys, saveActiveProvider, saveProviderKeys, saveProviderModel, saveRemoteProviderKey, deleteRemoteProviderKey } from "@/lib/ai-settings";

const PROVIDER_KEY_URLS: Record<string, string> = {
  Groq: "https://console.groq.com/keys",
  "Google Gemini": "https://aistudio.google.com/app/apikey",
  OpenAI: "https://platform.openai.com/api-keys",
  "Mistral AI": "https://console.mistral.ai/api-keys/",
  OpenRouter: "https://openrouter.ai/settings/keys",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("api");

  // API Key Management State
  const [activeProvider, setActiveProvider] = useState(() => getActiveProvider());
  const [apiKeys, setApiKeys] = useState<{ id: string; key: string; provider: string }[]>(() => {
    const provider = getActiveProvider();
    return getProviderKeys().filter((item) => item.provider === provider);
  });
  const [newApiKey, setNewApiKey] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    void loadRemoteProviderKeys().then((remoteKeys) => {
      if (!active || !remoteKeys) return;
      const localKeys = getProviderKeys();
      if (remoteKeys.length === 0 && localKeys.length > 0) {
        for (const key of localKeys) void saveRemoteProviderKey(key);
        return;
      }
      saveProviderKeys(remoteKeys);
      setApiKeys(remoteKeys.filter((item) => item.provider === activeProvider));
    });
    return () => { active = false; };
  }, [activeProvider]);
  
  // Model Selection State
  const [selectedModel, setSelectedModel] = useState(() => {
    const provider = getActiveProvider();
    return getProviderModels()[provider] || AI_DEFAULT_MODELS[provider];
  });
  
  // Theme State
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const savedTheme = localStorage.getItem('mcustock_theme') as "dark" | "light" | null;
    return savedTheme || (document.documentElement.classList.contains("light") ? "light" : "dark");
  });

  // Theme Switcher
  const updateTheme = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    localStorage.setItem("mcustock_theme", newTheme);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(newTheme);
  };

  // Save keys
  const saveKeys = (keys: { id: string; key: string; provider: string }[]) => {
    setApiKeys(keys);
    const otherProviderKeys = getProviderKeys().filter((item) => item.provider !== activeProvider);
    saveProviderKeys([...otherProviderKeys, ...keys]);
  };

  const addKey = async () => {
    if (!newApiKey.trim() || apiKeys.some((item) => item.key === newApiKey.trim())) return;
    setSaveError("");
    const newKey = { id: crypto.randomUUID(), key: newApiKey.trim(), provider: activeProvider };
    const saved = await saveRemoteProviderKey(newKey);
    if (!saved) {
      setSaveError("API key could not be saved to your account. Please check your login session and MongoDB configuration.");
      return;
    }
    saveKeys([...apiKeys, saved]);
    setNewApiKey("");
  };

  const removeKey = (index: number) => {
    const removed = apiKeys[index];
    const updated = apiKeys.filter((_, i) => i !== index);
    saveKeys(updated);
    if (removed) void deleteRemoteProviderKey(removed.id);
  };

  // Save Model
  const saveModel = (model: string) => {
    setSelectedModel(model);
    saveProviderModel(activeProvider, model);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-8 mt-8">
        
        {/* Settings Nav */}
        <aside className="w-full md:w-64 shrink-0 space-y-1">
           {[
             { id: "account", label: "Account Profile", icon: <User className="w-4 h-4" /> },
             { id: "api", label: "API Keys", icon: <Key className="w-4 h-4" /> },
             { id: "appearance", label: "Appearance", icon: <Moon className="w-4 h-4" /> },
             { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
             { id: "billing", label: "Billing & Plan", icon: <Shield className="w-4 h-4" /> },
           ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id ? "border border-primary bg-primary/20 text-primary shadow-[0_0_12px_rgba(22,199,132,0.15)]" : "border-0 bg-transparent text-foreground/50 hover:text-primary hover:bg-primary/5"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
        </aside>

        {/* Settings Content */}
        <div className="flex-1 glass-card p-6 md:p-8 min-h-[500px]">
           {activeTab === "account" && (
             <div className="space-y-6 max-w-xl">
               <div>
                 <h3 className="text-lg font-semibold mb-1">Profile Information</h3>
                 <p className="text-sm text-gray-400">Update your account details and email address.</p>
               </div>
               
               <div className="flex items-center gap-6 py-4">
                 <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#46BBE8] to-[#1F61AE] flex items-center justify-center text-2xl font-bold !text-white shadow-lg">
                    M
                 </div>
                 <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors border border-white/10">
                   Change Avatar
                 </button>
               </div>

               <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Display Name</label>
                   <input type="text" defaultValue="MCU UI Developer" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
                 </div>
                 <div>
                   <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Email Address</label>
                   <input type="email" defaultValue="mcu@example.com" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary text-gray-500" disabled />
                   <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">Email managed by Google Auth <ExternalLink className="w-3 h-3" /></p>
                 </div>
               </div>

               <div className="pt-6 border-t border-white/10">
                 <button className="bg-primary hover:bg-primary-hover !text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                   Save Changes
                 </button>
               </div>
             </div>
           )}

           {activeTab === "api" && (
             <div className="space-y-6 max-w-xl">
               <div>
                 <h3 className="text-lg font-semibold mb-1">{activeProvider} API Configuration</h3>
                 <p className="text-sm text-gray-400">Manage the active provider, API keys, and model for AI generation.</p>
               </div>

               <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-3">
                 <label className="text-sm font-semibold text-white">Active AI Provider</label>
                 <select
                   value={activeProvider}
                   onChange={(e) => {
                     const provider = e.target.value;
                     setActiveProvider(provider);
                     setApiKeys(getProviderKeys().filter((item) => item.provider === provider));
                     setSelectedModel(getProviderModels()[provider] || AI_DEFAULT_MODELS[provider]);
                     saveActiveProvider(provider);
                   }}
                   className="w-full bg-black border border-white/20 text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-primary text-white"
                 >
                   {AI_PROVIDER_NAMES.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                 </select>
               </div>
               
               {/* Vision Model Selection */}
               <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-white">{activeProvider} Model</label>
                  </div>
                  <p className="text-xs text-gray-400">Select the AI model used for image analysis. Ensure your Groq account has access to the chosen model.</p>
                  
                  <select 
                    value={selectedModel}
                    onChange={(e) => saveModel(e.target.value)}
                    className="w-full bg-black border border-white/20 text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-primary text-white"
                  >
                    {(AI_PROVIDERS[activeProvider] || []).map((model) => (
                      <option key={model.id} value={model.id}>{model.label}{model.badge ? ` - ${model.badge}` : ""}</option>
                    ))}
                  </select>
               </div>

               {/* API Key Management */}
               <div className="bg-black/40 border border-white/10 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-white">API Keys Rotation List</label>
                    <a href={PROVIDER_KEY_URLS[activeProvider]} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      Configure {activeProvider} key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                    <p className="text-xs text-gray-400">Add multiple keys to automatically failover if one hits a rate limit.</p>
                    {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                  
                  <div className="flex items-center gap-2">
                      <input
                      type="password"
                      placeholder={`${activeProvider} API key...`}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addKey()}
                      className="w-full bg-black border border-white/20 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                    />
                    <button onClick={addKey} className="px-4 py-2.5 bg-primary/20 text-primary font-semibold rounded-lg hover:bg-primary/30 transition-colors flex items-center gap-2">
                      <Plus className="w-5 h-5" /> Add Key
                    </button>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    {apiKeys.length === 0 && (
                      <p className="text-sm text-gray-500 py-4 text-center border-2 border-dashed border-white/10 rounded-lg">No active API keys found.</p>
                    )}
                    {apiKeys.map((k, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-lg text-sm border border-white/5 hover:border-white/10 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                          <span className="font-mono text-gray-200">
                             {k.key.substring(0, 8)}••••••••••••••••••••••••{k.key.slice(-4)}
                          </span>
                        </div>
                        <button onClick={() => removeKey(i)} className="text-gray-500 hover:text-red-400 p-1 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>

             </div>
           )}

           {activeTab === "appearance" && (
             <div className="space-y-6 max-w-xl">
               <div>
                 <h3 className="text-lg font-semibold mb-1">Theme Preferences</h3>
                 <p className="text-sm text-gray-400">Customize the look and feel of the dashboard.</p>
               </div>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => updateTheme("dark")}
                    className={`border-2 rounded-xl p-4 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                      theme === "dark" ? "border-primary bg-primary/5" : "border-transparent bg-white/5 hover:bg-white/10"
                    }`}
                  >
                     <div className="w-full h-24 bg-black rounded-lg border border-white/10 flex flex-col p-2 gap-2 overflow-hidden">
                        <div className="w-full h-4 bg-white/10 rounded"></div>
                        <div className="w-3/4 h-3 bg-white/5 rounded"></div>
                     </div>
                     <span className={`text-sm font-semibold ${theme === "dark" ? "text-primary" : "text-gray-400"}`}>Dark Mode {theme === "dark" && "(Active)"}</span>
                  </div>
                  <div 
                    onClick={() => updateTheme("light")}
                    className={`border-2 rounded-xl p-4 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                      theme === "light" ? "border-primary bg-primary/20 shadow-lg" : "border-transparent bg-white/10 hover:bg-white/20"
                    }`}
                  >
                     <div className="w-full h-24 bg-white rounded-lg border border-gray-200 flex flex-col p-2 gap-2 overflow-hidden shadow-inner">
                        <div className="w-full h-4 bg-gray-200 rounded"></div>
                        <div className="w-3/4 h-3 bg-gray-100 rounded"></div>
                     </div>
                     <span className={`text-sm font-semibold ${theme === "light" ? "text-primary font-bold" : "text-gray-400"}`}>Light Mode {theme === "light" && "(Active)"}</span>
                  </div>
                </div>
             </div>
           )}
           
           {(activeTab === "notifications" || activeTab === "billing") && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-20">
                 <Shield className="w-12 h-12 mb-4 opacity-20" />
                 <h3 className="text-lg font-medium text-white mb-2">Available on Pro</h3>
                 <p className="text-sm text-center">Upgrade to access advanced settings and team management.</p>
                 <button className="mt-6 px-6 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-gray-200">View Plans</button>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}

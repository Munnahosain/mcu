"use client";

import { createContext, useContext, useState } from "react";

export interface GeneratorImageFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "generating" | "done" | "error";
  metadata?: {
    title: string;
    description: string;
    keywords: string[];
    category: string;
  };
  prompt?: string;
}

type GeneratorState = {
  images: GeneratorImageFile[];
  setImages: React.Dispatch<React.SetStateAction<GeneratorImageFile[]>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
};

const GeneratorStateContext = createContext<GeneratorState | null>(null);

export function GeneratorStateProvider({ children }: { children: React.ReactNode }) {
  const [images, setImages] = useState<GeneratorImageFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <GeneratorStateContext.Provider value={{ images, setImages, isGenerating, setIsGenerating }}>
      {children}
    </GeneratorStateContext.Provider>
  );
}

export function useGeneratorState() {
  const state = useContext(GeneratorStateContext);
  if (!state) {
    throw new Error("useGeneratorState must be used inside GeneratorStateProvider");
  }
  return state;
}

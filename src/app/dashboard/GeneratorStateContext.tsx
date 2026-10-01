"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { idbGet, idbRemove, idbSet } from "@/lib/safeStorage";

const GENERATOR_IMAGES_KEY = "mcustock_generator_images";

export interface GeneratorImageFile {
  id: string;
  file: File;
  preview: string;
  isVideo?: boolean;
  previewDataUrl?: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
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
  const restoredImages = useRef(false);

  useEffect(() => {
    void idbGet<GeneratorImageFile[]>(GENERATOR_IMAGES_KEY).then((savedImages) => {
      if (savedImages?.length) {
        setImages(savedImages.map((image) => ({
          ...image,
          preview: URL.createObjectURL(image.file),
          status: image.status === "generating" ? "pending" : image.status,
        })));
      }
      restoredImages.current = true;
    });
  }, []);

  useEffect(() => {
    if (!restoredImages.current) return;
    if (!images.length) {
      void idbRemove(GENERATOR_IMAGES_KEY);
      return;
    }

    void idbSet(GENERATOR_IMAGES_KEY, images);
  }, [images]);

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

"use client";

import { PenTool } from "lucide-react";
import EmbeddedStudio from "../../../components/EmbeddedStudio";

const STUDIO_NAME = "Mata Pattern Studio";
const STUDIO_URL = process.env.NEXT_PUBLIC_VECTORCRAFT_URL || "/vectorcraft/index.html";

export default function VectorEditorPage() {
  return (
    <EmbeddedStudio
      title={STUDIO_NAME}
      url={STUDIO_URL}
      icon={<PenTool className="h-5 w-5" />}
      installHint={
        <>
          Place the web editor build in <code>public/vectorcraft</code>, or set{" "}
          <code>NEXT_PUBLIC_VECTORCRAFT_URL</code> to its hosted <code>index.html</code>.
        </>
      }
    />
  );
}

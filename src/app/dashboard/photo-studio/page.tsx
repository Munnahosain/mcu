"use client";

import { ImageIcon } from "lucide-react";
import EmbeddedStudio from "../../../components/EmbeddedStudio";

// Change this one line to rename the tool on your site. The name inside the editor itself is set when you build it.
const STUDIO_NAME = "MintCanvas Photo Studio";

// Where the built web app lives. Defaults to public/photo-studio; set NEXT_PUBLIC_PHOTO_STUDIO_URL to a CDN
// address (ending in index.html) to host the large .wasm file elsewhere.
const STUDIO_URL = process.env.NEXT_PUBLIC_PHOTO_STUDIO_URL || "/photo-studio/index.html";

export default function PhotoStudioPage() {
  return (
    <EmbeddedStudio
      title={STUDIO_NAME}
      url={STUDIO_URL}
      icon={<ImageIcon className="h-5 w-5" />}
      installHint={
        <>
          Build the web app with the GitHub Action (artifact <code>studio-web</code>), unzip it and copy every file
          into <code>public/photo-studio</code>, or host the folder elsewhere and set{" "}
          <code>NEXT_PUBLIC_PHOTO_STUDIO_URL</code> to its index.html address. Keep the LICENSE and NOTICE files that
          come in the zip.
        </>
      }
    />
  );
}

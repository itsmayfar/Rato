import type { MetadataRoute } from "next";

/** Web app manifest: lets the app be installed on a phone's home screen (no app store). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MAYFAR Artist Manager",
    short_name: "MAYFAR",
    description: "Sound becomes feeling. The operating system for the Mayfar artist business.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["music", "business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard" },
      { name: "Tasks", url: "/tasks" },
      { name: "AI Assistant", url: "/assistant" },
      { name: "Social Media Planner", url: "/planner" },
    ],
  };
}

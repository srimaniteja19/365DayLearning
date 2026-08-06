import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Refrainly",
    short_name: "Refrainly",
    description:
      "Multi-plan learning campaigns with spaced repetition, notes, and bring-your-own-key AI.",
    start_url: "/",
    display: "standalone",
    background_color: "#EEF2F6",
    theme_color: "#0C1116",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    share_target: {
      action: "/share-target",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
    ],
  } as any;
}


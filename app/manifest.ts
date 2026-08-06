import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Refrainly",
    short_name: "Refrainly",
    description:
      "Multi-plan learning campaigns with spaced repetition, notes, and bring-your-own-key AI.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EEF2F6",
    theme_color: "#0C1116",
    orientation: "portrait-primary",
    categories: ["education", "productivity"],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "application/x-www-form-urlencoded",
      enc_type: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },


    icons: [
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
        purpose: "any",
      },
    ],
  } as any;
}

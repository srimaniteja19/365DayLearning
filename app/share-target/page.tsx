"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function extractUrlFromShare(
  urlParam?: string | null,
  textParam?: string | null
): string {
  if (urlParam && (urlParam.startsWith("http://") || urlParam.startsWith("https://"))) {
    return urlParam.trim();
  }
  const source = `${urlParam || ""} ${textParam || ""}`;
  const match = source.match(/https?:\/\/[^\s]+/i);
  if (match) {
    let extracted = match[0].trim();
    // Clean trailing punctuation attached by share targets
    extracted = extracted.replace(/[.,)!]+$/, "");
    return extracted;
  }
  return (urlParam || textParam || "").trim();
}

function ShareTargetHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawUrl = searchParams.get("url");
    const rawText = searchParams.get("text");
    const rawTitle = searchParams.get("title");

    const targetUrl = extractUrlFromShare(rawUrl, rawText);
    const targetTitle = (rawTitle || "").trim();
    const targetText = (rawText || "").trim();

    const query = new URLSearchParams();
    if (targetUrl) query.set("shared_url", targetUrl);
    if (targetTitle) query.set("shared_title", targetTitle);
    if (targetText) query.set("shared_text", targetText);

    router.replace(`/dashboard/kit/bookmarks?${query.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C1116] text-[#EEF2F6] p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="font-mono text-sm tracking-wide text-gray-300">
          Receiving shared content...
        </p>
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense fallback={null}>
      <ShareTargetHandler />
    </Suspense>
  );
}

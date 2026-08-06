import { NextRequest, NextResponse } from "next/server";

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
    extracted = extracted.replace(/[.,)!]+$/, "");
    return extracted;
  }
  return (urlParam || textParam || "").trim();
}

async function handleIncomingShare(req: NextRequest) {
  let rawUrl: string | null = null;
  let rawText: string | null = null;
  let rawTitle: string | null = null;

  if (req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type") || "";
      if (
        contentType.includes("multipart/form-data") ||
        contentType.includes("application/x-www-form-urlencoded")
      ) {
        const formData = await req.formData();
        rawUrl = (formData.get("url") as string) || null;
        rawText = (formData.get("text") as string) || null;
        rawTitle = (formData.get("title") as string) || null;
      } else if (contentType.includes("application/json")) {
        const json = await req.json();
        rawUrl = json.url || null;
        rawText = json.text || null;
        rawTitle = json.title || null;
      }
    } catch (e) {
      console.error("Error reading POST share target data:", e);
    }
  }

  // Fallback to query params if POST body didn't contain url/text/title
  if (!rawUrl && !rawText && !rawTitle) {
    const searchParams = req.nextUrl.searchParams;
    rawUrl = searchParams.get("url");
    rawText = searchParams.get("text");
    rawTitle = searchParams.get("title");
  }

  const targetUrl = extractUrlFromShare(rawUrl, rawText);
  const targetTitle = (rawTitle || "").trim();
  const targetText = (rawText || "").trim();

  const redirectUrl = new URL("/dashboard/kit/bookmarks", req.nextUrl.origin);
  if (targetUrl) redirectUrl.searchParams.set("shared_url", targetUrl);
  if (targetTitle) redirectUrl.searchParams.set("shared_title", targetTitle);
  if (targetText) redirectUrl.searchParams.set("shared_text", targetText);

  // Return 303 See Other HTTP redirect (standard for POST -> GET redirect)
  return NextResponse.redirect(redirectUrl.toString(), 303);
}

export async function GET(req: NextRequest) {
  return handleIncomingShare(req);
}

export async function POST(req: NextRequest) {
  return handleIncomingShare(req);
}

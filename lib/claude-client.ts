export async function callClaude(prompt: string, maxTokens?: number): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      maxTokens: maxTokens ?? 1000,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  if (!data.text?.trim()) {
    throw new Error("Empty response");
  }

  return data.text.trim();
}

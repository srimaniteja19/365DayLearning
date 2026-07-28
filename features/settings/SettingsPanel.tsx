"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  buildModelCatalog,
  fetchOpenRouterModels,
  formatModelPrice,
  getCuratedModelMeta,
  groupModelsByCategory,
  openrouterProvider,
  shortModelName,
  type ModelPricingTier,
  type OpenRouterModelInfo,
} from "@/lib/providers/openrouter";
import {
  forgetCredentials,
  getCredentials,
  hydrateCredentialsFromStorage,
  maskApiKey,
  setCredentials,
  subscribeCredentials,
} from "@/lib/providers/credentials";
import { testConnection } from "@/lib/claude-client";
import { classNames } from "@/lib/classNames";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [creds, setCreds] = useState(getCredentials);
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof testConnection>> | null>(null);
  const [liveModels, setLiveModels] = useState<OpenRouterModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [tier, setTier] = useState<ModelPricingTier>("paid");

  useEffect(() => {
    hydrateCredentialsFromStorage();
    return subscribeCredentials(() => setCreds(getCredentials()));
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setLoadingModels(true);
    setModelsError("");
    fetchOpenRouterModels(ac.signal)
      .then((models) => setLiveModels(models))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setModelsError("Could not refresh live models — showing curated suggestions.");
      })
      .finally(() => setLoadingModels(false));
    return () => ac.abort();
  }, []);

  const update = (partial: Parameters<typeof setCredentials>[0]) => {
    setTestResult(null);
    setCreds(setCredentials(partial));
  };

  const catalog = useMemo(() => buildModelCatalog(liveModels), [liveModels]);

  const groups = useMemo(() => groupModelsByCategory(catalog, tier), [catalog, tier]);

  const freeCount = useMemo(() => catalog.filter((m) => m.free).length, [catalog]);
  const paidCount = useMemo(() => catalog.filter((m) => !m.free).length, [catalog]);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
  };

  return (
    <div className="settings-panel">
      <p className="settings-lead">
        Refrainly uses <strong>OpenRouter</strong> only. Paste your OpenRouter key and pick a model —
        requests go from this browser to OpenRouter. Keys stay in memory unless you opt in to remember
        them on this device.
      </p>

      <div className="settings-field">
        <label className="settings-label">Provider</label>
        <div className="settings-input" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          OpenRouter
          <a className="settings-docs" href={openrouterProvider.docsUrl} target="_blank" rel="noreferrer">
            Get a key →
          </a>
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-label">Model</label>
        <div className="settings-tier-row" role="tablist" aria-label="Pricing tier">
          <button
            type="button"
            role="tab"
            aria-selected={tier === "paid"}
            className={classNames("settings-tier-btn", tier === "paid" && "settings-tier-btn-active")}
            onClick={() => setTier("paid")}
          >
            Paid{paidCount ? ` · ${Math.min(paidCount, 999)}` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tier === "free"}
            className={classNames("settings-tier-btn", tier === "free" && "settings-tier-btn-active")}
            onClick={() => setTier("free")}
          >
            Free{freeCount ? ` · ${freeCount}` : ""}
          </button>
        </div>

        <div className="settings-model-groups">
          {groups.length === 0 && (
            <div className="settings-hint">
              {loadingModels ? "Loading models…" : `No ${tier} models available right now.`}
            </div>
          )}
          {groups.map((group) => (
            <div key={group.category} className="settings-model-group">
              <div className="settings-model-group-label">{group.label}</div>
              <div className="settings-model-row">
                {group.models.map((m) => {
                  const meta = getCuratedModelMeta(m.id);
                  const price = meta ? formatModelPrice(meta) : m.free ? "$0" : "";
                  const tags = (m.tags || meta?.tags || []).join(" · ");
                  const isDefault =
                    (m.tags || []).includes("Default") || m.id === "deepseek/deepseek-v4-flash";
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={classNames(
                        "settings-chip",
                        creds.model === m.id && "settings-chip-active",
                      )}
                      onClick={() => update({ model: m.id })}
                      title={[m.id, price, tags].filter(Boolean).join(" · ")}
                    >
                      {shortModelName(m.id)}
                      {isDefault && creds.model !== m.id ? " · default" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <input
          className="settings-input"
          value={creds.model}
          onChange={(e) => update({ model: e.target.value })}
          placeholder="deepseek/deepseek-v4-flash"
          spellCheck={false}
        />
        <div className="settings-hint">
          {loadingModels
            ? "Checking OpenRouter availability…"
            : modelsError ||
              (tier === "free"
                ? "Free models failover to other free, then budget paid. Hover a chip for price and tags."
                : "Cheapest → costliest. Hover for price and tags. Paste any OpenRouter id if needed.")}
        </div>
      </div>

      <div className="settings-field">
        <label className="settings-label" htmlFor="settings-key">
          OpenRouter API key
        </label>
        <div className="settings-key-row">
          <input
            id="settings-key"
            className="settings-input"
            type={reveal ? "text" : "password"}
            value={creds.apiKey || ""}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder={openrouterProvider.keyHint}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="settings-btn settings-btn-ghost" onClick={() => setReveal((v) => !v)}>
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
        {creds.remember && creds.apiKey && (
          <div className="settings-hint">Stored on this device as {maskApiKey(creds.apiKey)}</div>
        )}
      </div>

      <div className="settings-field">
        <label className="settings-label" htmlFor="settings-base">
          Base URL <span className="settings-optional">(optional)</span>
        </label>
        <input
          id="settings-base"
          className="settings-input"
          value={creds.baseUrl || ""}
          onChange={(e) => update({ baseUrl: e.target.value })}
          placeholder={openrouterProvider.defaultBaseUrl}
          spellCheck={false}
        />
      </div>

      <label className="settings-remember">
        <input
          type="checkbox"
          checked={!!creds.remember}
          onChange={(e) => update({ remember: e.target.checked })}
        />
        <span>
          Remember this key on this device.
          <span className="settings-hint">
            {" "}
            Anyone with this browser profile can read a stored key. Prefer a scoped key with a spend
            limit.
          </span>
        </span>
      </label>

      <div className="settings-actions">
        <button className="settings-btn settings-btn-primary" type="button" onClick={runTest} disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          className="settings-btn settings-btn-ghost"
          type="button"
          onClick={() => {
            forgetCredentials();
            setTestResult(null);
          }}
        >
          Forget key
        </button>
        <button className="settings-btn settings-btn-solid" type="button" onClick={onClose}>
          Done
        </button>
      </div>

      {testResult && (
        <div className={classNames("settings-test", testResult.ok ? "settings-test-ok" : "settings-test-err")}>
          {testResult.ok
            ? `Connected · ${testResult.model} · ${testResult.latencyMs}ms`
            : testResult.error || "Connection failed"}
        </div>
      )}
    </div>
  );
}

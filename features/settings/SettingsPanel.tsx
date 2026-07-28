"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PROVIDERS } from "@/lib/providers";
import type { ProviderId } from "@/lib/providers/types";
import {
  forgetCredentials,
  getCredentials,
  hydrateCredentialsFromStorage,
  maskApiKey,
  setCredentials,
  subscribeCredentials,
} from "@/lib/providers/credentials";
import { testConnection } from "@/lib/claude-client";
import { Icon } from "@/components/Icon";
import { classNames } from "@/lib/classNames";

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [creds, setCreds] = useState(getCredentials);
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof testConnection>> | null>(null);

  useEffect(() => {
    hydrateCredentialsFromStorage();
    return subscribeCredentials(() => setCreds(getCredentials()));
  }, []);

  const provider = useMemo(
    () => PROVIDERS.find((p) => p.id === creds.providerId) || PROVIDERS[0],
    [creds.providerId],
  );

  const update = (partial: Parameters<typeof setCredentials>[0]) => {
    setTestResult(null);
    setCreds(setCredentials(partial));
  };

  const onProviderChange = (id: ProviderId) => {
    const next = PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
    update({
      providerId: next.id,
      model: next.models[0],
      baseUrl: next.defaultBaseUrl,
    });
  };

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
        Bring your own key. Calls go from this browser to the provider you choose. Keys stay in
        memory unless you opt in to remember them on this device.
      </p>

      <div className="settings-field">
        <label className="settings-label" htmlFor="settings-provider">
          Provider
        </label>
        <select
          id="settings-provider"
          className="settings-input"
          value={creds.providerId}
          onChange={(e) => onProviderChange(e.target.value as ProviderId)}
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <a className="settings-docs" href={provider.docsUrl} target="_blank" rel="noreferrer">
          Get a key →
        </a>
      </div>

      <div className="settings-field">
        <label className="settings-label">Model</label>
        <div className="settings-model-row">
          {provider.models.map((m) => (
            <button
              key={m}
              type="button"
              className={classNames("settings-chip", creds.model === m && "settings-chip-active")}
              onClick={() => update({ model: m })}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          className="settings-input"
          value={creds.model}
          onChange={(e) => update({ model: e.target.value })}
          placeholder="model id"
          spellCheck={false}
        />
      </div>

      {provider.needsKey && (
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-key">
            API key
          </label>
          <div className="settings-key-row">
            <input
              id="settings-key"
              className="settings-input"
              type={reveal ? "text" : "password"}
              value={creds.apiKey || ""}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder={provider.keyHint}
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
      )}

      <div className="settings-field">
        <label className="settings-label" htmlFor="settings-base">
          Base URL <span className="settings-optional">(optional)</span>
        </label>
        <input
          id="settings-base"
          className="settings-input"
          value={creds.baseUrl || ""}
          onChange={(e) => update({ baseUrl: e.target.value })}
          placeholder={provider.defaultBaseUrl || "https://…"}
          spellCheck={false}
        />
      </div>

      {provider.needsKey && (
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
              Anyone with this browser profile can read a stored key. Prefer a scoped key with a
              spend limit.
            </span>
          </span>
        </label>
      )}

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
        <div
          className={classNames(
            "settings-test",
            testResult.ok ? "settings-test-ok" : "settings-test-err",
          )}
          role="status"
        >
          {testResult.ok ? (
            <>
              <Icon.Check size={14} /> Connected · {testResult.latencyMs}ms · model{" "}
              <code>{testResult.model}</code>
              {testResult.sample ? ` · “${testResult.sample}”` : ""}
            </>
          ) : (
            <>
              <Icon.X size={14} /> {testResult.errorCode ? `[${testResult.errorCode}] ` : ""}
              {testResult.error}
            </>
          )}
        </div>
      )}
    </div>
  );
}

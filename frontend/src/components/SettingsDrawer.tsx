import React, { useState, useEffect } from 'react';
import { X, Key, Check, AlertCircle, ChevronDown, ExternalLink, Cpu } from 'lucide-react';

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'deepseek' | 'mistral' | 'together' | 'xai' | 'nvidia' | 'cohere';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

const PROVIDERS = [
  {
    id: 'google' as LLMProvider,
    name: 'Google Gemini',
    logo: '🔵',
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast)' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Reasoning)' },
    ],
    keyPlaceholder: 'AIza...',
    keyLink: 'https://aistudio.google.com/app/apikey',
    keyLinkLabel: 'Get key from Google AI Studio',
    description: 'Fast & cost-effective. Best for most use cases.',
  },
  {
    id: 'openai' as LLMProvider,
    name: 'OpenAI',
    logo: '⚫',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
    ],
    keyPlaceholder: 'sk-...',
    keyLink: 'https://platform.openai.com/api-keys',
    keyLinkLabel: 'Get key from OpenAI',
    description: 'Industry standard. Excellent reasoning.',
  },
  {
    id: 'anthropic' as LLMProvider,
    name: 'Anthropic Claude',
    logo: '🟤',
    models: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyLink: 'https://console.anthropic.com/settings/keys',
    keyLinkLabel: 'Get key from Anthropic',
    description: 'Excellent for analysis and long-form reports.',
  },
  {
    id: 'openrouter' as LLMProvider,
    name: 'OpenRouter',
    logo: '🌐',
    models: [
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'google/gemini-pro-1.5', label: 'Gemini 1.5 Pro' },
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    ],
    keyPlaceholder: 'sk-or-v1-...',
    keyLink: 'https://openrouter.ai/keys',
    keyLinkLabel: 'Get key from OpenRouter',
    description: 'Access hundreds of models from one API key.',
  },
  {
    id: 'groq' as LLMProvider,
    name: 'Groq',
    logo: '⚡',
    models: [
      { value: 'llama3-70b-8192', label: 'Llama 3 70B' },
      { value: 'llama3-8b-8192', label: 'Llama 3 8B' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    ],
    keyPlaceholder: 'gsk_...',
    keyLink: 'https://console.groq.com/keys',
    keyLinkLabel: 'Get key from Groq',
    description: 'Ultra-fast inference for Llama and Mixtral.',
  },
  {
    id: 'deepseek' as LLMProvider,
    name: 'DeepSeek',
    logo: '🐋',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek V3 (Chat)' },
      { value: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner)' },
    ],
    keyPlaceholder: 'sk-...',
    keyLink: 'https://platform.deepseek.com/',
    keyLinkLabel: 'Get key from DeepSeek',
    description: 'Highly capable open models.',
  },
  {
    id: 'mistral' as LLMProvider,
    name: 'Mistral',
    logo: '🌪️',
    models: [
      { value: 'mistral-large-latest', label: 'Mistral Large' },
      { value: 'mistral-small-latest', label: 'Mistral Small' },
    ],
    keyPlaceholder: '...',
    keyLink: 'https://console.mistral.ai/',
    keyLinkLabel: 'Get key from Mistral',
    description: 'Top-tier European models.',
  },
  {
    id: 'xai' as LLMProvider,
    name: 'xAI (Grok)',
    logo: '✖️',
    models: [
      { value: 'grok-beta', label: 'Grok Beta' },
    ],
    keyPlaceholder: 'xai-...',
    keyLink: 'https://console.x.ai/',
    keyLinkLabel: 'Get key from xAI',
    description: 'Grok models by xAI.',
  },
  {
    id: 'together' as LLMProvider,
    name: 'Together AI',
    logo: '🤝',
    models: [
      { value: 'meta-llama/Llama-3-70b-chat-hf', label: 'Llama 3 70B' },
      { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B' },
    ],
    keyPlaceholder: '...',
    keyLink: 'https://api.together.xyz/',
    keyLinkLabel: 'Get key from Together AI',
    description: 'Fast open-source model inference.',
  },
  {
    id: 'nvidia' as LLMProvider,
    name: 'NVIDIA NIM',
    logo: '🟩',
    models: [
      { value: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
      { value: 'nvidia/nemotron-4-340b-instruct', label: 'Nemotron 4' },
    ],
    keyPlaceholder: 'nvapi-...',
    keyLink: 'https://build.nvidia.com/',
    keyLinkLabel: 'Get key from NVIDIA',
    description: 'NVIDIA optimized inference microservices.',
  },
  {
    id: 'cohere' as LLMProvider,
    name: 'Cohere',
    logo: '🌌',
    models: [
      { value: 'command-r-plus', label: 'Command R+' },
      { value: 'command-r', label: 'Command R' },
    ],
    keyPlaceholder: '...',
    keyLink: 'https://dashboard.cohere.com/api-keys',
    keyLinkLabel: 'Get key from Cohere',
    description: 'Enterprise-grade RAG and chat models.',
  },
];

const STORAGE_KEY = 'perfsight_llm_config';

export function getLLMConfig(): LLMConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { provider: 'google', apiKey: '', model: 'gemini-2.5-flash' };
}

export function saveLLMConfig(config: LLMConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export const SettingsDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [config, setConfig] = useState<LLMConfig>(getLLMConfig);
  const [showKey, setShowKey] = useState<Partial<Record<LLMProvider, boolean>>>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const selectedProvider = PROVIDERS.find(p => p.id === config.provider)!;

  const handleProviderChange = (provider: LLMProvider) => {
    const p = PROVIDERS.find(x => x.id === provider)!;
    setConfig(c => ({ ...c, provider, model: p.models[0].value }));
    setTestResult(null);
  };

  const handleSave = () => {
    saveLLMConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const resp = await fetch('http://localhost:8000/api/llm/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-Provider': config.provider,
          'X-LLM-Key': config.apiKey,
          'X-LLM-Model': config.model,
        },
        body: JSON.stringify({ provider: config.provider, model: config.model }),
      });
      setTestResult(resp.ok ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
        background: 'var(--bg-primary)',
        borderLeft: '1px solid var(--border)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.22s ease-out',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.1)',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--feuji-red), var(--feuji-amber))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cpu size={16} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>AI Model Settings</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Connect your own LLM API key — OpenAI, Claude, or Gemini
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 6, borderRadius: 6, display: 'flex',
          }}>
            <X size={16} />
          </button>
        </div>

        <div className="scroll-y" style={{ flex: 1, padding: '20px' }}>

          {/* Provider Cards */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Select AI Provider
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 9, cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit', width: '100%',
                    border: `1.5px solid ${config.provider === p.id ? 'var(--feuji-red)' : 'var(--border)'}`,
                    background: config.provider === p.id ? 'rgba(224,64,30,0.04)' : 'var(--bg-secondary)',
                    transition: 'all 0.16s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{p.logo}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13.5,
                      color: config.provider === p.id ? 'var(--feuji-red)' : 'var(--text-primary)',
                    }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{p.description}</div>
                  </div>
                  {config.provider === p.id && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--feuji-red)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Check size={12} color="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Model Selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
              Model
            </label>
            <div style={{ position: 'relative' }}>
              <select
                className="input"
                value={config.model}
                onChange={e => setConfig(c => ({ ...c, model: e.target.value }))}
                style={{ appearance: 'none', paddingRight: 36 }}
              >
                {selectedProvider.models.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={14} color="var(--text-muted)" style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)', pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* API Key Input */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                API Key
              </span>
              <a
                href={selectedProvider.keyLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 11.5, color: 'var(--feuji-red)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                {selectedProvider.keyLinkLabel} <ExternalLink size={10} />
              </a>
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={14} color="var(--text-muted)" style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              }} />
              <input
                className="input"
                type={showKey[config.provider] ? 'text' : 'password'}
                placeholder={selectedProvider.keyPlaceholder}
                value={config.apiKey}
                onChange={e => { setConfig(c => ({ ...c, apiKey: e.target.value })); setTestResult(null); }}
                style={{ paddingLeft: 36, paddingRight: 80, fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
              <button
                onClick={() => setShowKey(s => ({ ...s, [config.provider]: !s[config.provider] }))}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-muted)', fontFamily: 'inherit',
                }}
              >
                {showKey[config.provider] ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={10} /> Your key is stored locally in your browser only — never sent to our servers.
            </div>
          </div>

          {/* Test Connection */}
          {config.apiKey.trim() && (
            <div style={{ marginBottom: 18 }}>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
              >
                {testing
                  ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Testing connection...</>
                  : testResult === 'ok'
                  ? <><Check size={14} color="var(--accent-green)" style={{ color: 'var(--accent-green)' }} /> Connection successful</>
                  : testResult === 'fail'
                  ? <><AlertCircle size={14} /> Connection failed — check key</>
                  : 'Test Connection'}
              </button>
              {testResult === 'fail' && (
                <div style={{ fontSize: 11.5, color: 'var(--accent-red)', marginTop: 6, textAlign: 'center' }}>
                  Invalid API key or network error. Please verify and try again.
                </div>
              )}
            </div>
          )}

          {/* Info Box */}
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: 'rgba(224,64,30,0.04)', border: '1px solid rgba(224,64,30,0.15)',
            fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65,
          }}>
            <div style={{ fontWeight: 600, color: 'var(--feuji-red)', marginBottom: 5, fontSize: 12 }}>
              How this works
            </div>
            Your selected model and API key are sent with every request to the backend. The system will use your model for:
            <ul style={{ marginTop: 6, paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Scenario parsing and script generation</li>
              <li>Anomaly analysis and root cause detection</li>
              <li>Executive report and RCA generation</li>
              <li>AI chat assistant responses</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} style={{ flex: 2, justifyContent: 'center' }}>
            {saved ? <><Check size={14} /> Saved!</> : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
};

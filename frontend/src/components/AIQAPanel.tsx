import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Globe, KeyRound, LoaderCircle, Play, ShieldCheck, Cpu, Settings } from 'lucide-react';
import { getAIQARun, resumeAIQARun, startAIQARun } from '../api';
import { getLLMConfig } from './SettingsDrawer';

type InputField = { key: string; label: string; input_type: string };
type Event = { step: number; at: string; action: string; message?: string; url?: string; title?: string; screenshot?: string | null; console_errors?: string[]; page_errors?: string[] };
type Run = {
  run_id: string; scenario: string; provider: string; model: string; status: string; started_at: string;
  current_url: string; title: string; result: string; error: string;
  input_request?: { prompt: string; fields: InputField[]; manual_handoff?: boolean } | null;
  events: Event[]; evidence: string[];
};

const exampleScenario = 'Open https://www.grabon.in. Find coupon offers, visit the respective retailer websites, select suitable products, apply coupon codes, and verify whether each offer works. Capture screenshots and explain the outcome for every offer tested. Stop before payment.';

export function AIQAPanel() {
  const [scenario, setScenario] = useState(exampleScenario);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const polling = useRef(false);

  useEffect(() => {
    if (!run || ['completed', 'failed', 'step_limit', 'input_timeout'].includes(run.status)) return;
    const timer = window.setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try { setRun(await getAIQARun(run.run_id)); }
      catch (err: any) { setError(err?.response?.data?.detail || err?.message || 'Could not read run status'); }
      finally { polling.current = false; }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [run?.run_id, run?.status]);

  const start = async () => {
    setLoading(true); setError(''); setRun(null); setInputValues({});
    try { setRun(await startAIQARun(scenario)); }
    catch (err: any) { setError(err?.response?.data?.detail || err?.message || 'Could not start AI QA run'); }
    finally { setLoading(false); }
  };

  const resume = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!run?.input_request) return;
    setLoading(true); setError('');
    try {
      const values = run.input_request.manual_handoff ? { continue: 'continue' } : inputValues;
      setRun(await resumeAIQARun(run.run_id, values));
      setInputValues({});
    } catch (err: any) { setError(err?.response?.data?.detail || err?.message || 'Could not resume this run'); }
    finally { setLoading(false); }
  };

  const artifactUrl = (path: string) => `http://localhost:8000${path}`;
  const active = run && !['completed', 'failed', 'step_limit', 'input_timeout'].includes(run.status);

  return <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}><Globe size={18} color="var(--feuji-red)" /><strong>AI QA Agent</strong></div>
    <p style={{ margin: '0 0 14px', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
      Describe a website workflow in plain language. The agent uses your configured model to inspect pages, choose browser actions, verify visible outcomes, and capture a timestamped screenshot after each step. It pauses when a sign-in form needs tester input.
    </p>
    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: 10, marginBottom: 12, borderRadius: 7, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 11.5, lineHeight: 1.5 }}>
      <ShieldCheck size={15} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: 1 }} />
      Passwords and tester-entered values stay out of the model prompt, execution log, and screenshots. A run never places an order or submits payment. The selected model provider may have its own usage costs.
    </div>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 14px',
      marginBottom: 14,
      borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
      flexWrap: 'wrap',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
        <Cpu size={16} color="var(--feuji-red)" />
        <span>
          <strong>AI Provider:</strong> <span style={{ textTransform: 'uppercase', color: 'var(--feuji-red)', fontWeight: 700 }}>{getLLMConfig().provider}</span>
          <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>|</span>
          <strong>Model:</strong> <code>{getLLMConfig().model}</code>
        </span>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => window.dispatchEvent(new CustomEvent('open-perfsight-settings'))}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--feuji-red)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          border: '1.5px solid rgba(224,64,30,0.3)',
          borderRadius: 7,
          background: 'rgba(224,64,30,0.06)',
          cursor: 'pointer',
        }}
      >
        <Settings size={13} /> Configure AI Keys & Models
      </button>
    </div>

    <label htmlFor="ai-qa-scenario" style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 600 }}>What should the tester do?</label>
    <textarea id="ai-qa-scenario" value={scenario} onChange={e => setScenario(e.target.value)} maxLength={5000} rows={5} disabled={!!active}
      placeholder="Describe the website and the workflow to verify…" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5 }} />
    <button className="btn btn-primary" onClick={start} disabled={loading || !!active || !scenario.trim()} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
      {loading || active ? <><LoaderCircle size={14} className="spinner" /> {run?.status === 'needs_input' ? 'Waiting for tester input…' : 'Running scenario…'}</> : <><Play size={14} /> Run AI QA scenario</>}
    </button>
    {error && <div role="alert" style={{ marginTop: 12, padding: '10px 14px', borderRadius: 7, background: 'rgba(224,64,30,0.08)', border: '1px solid var(--feuji-red)', color: 'var(--feuji-red)', fontSize: 12.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <span>{error}</span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => window.dispatchEvent(new CustomEvent('open-perfsight-settings'))}
        style={{ fontSize: 11.5, background: 'var(--feuji-red)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
      >
        Open AI Settings
      </button>
    </div>}

    {run?.input_request && <form onSubmit={resume} style={{ marginTop: 16, padding: 14, border: '1px solid var(--feuji-amber)', borderRadius: 8, background: 'rgba(242,141,29,.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 13 }}><KeyRound size={15} color="var(--feuji-amber)" /> Tester input needed</div>
      <p style={{ margin: '7px 0 12px', color: 'var(--text-muted)', fontSize: 12 }}>{run.input_request.prompt}</p>
      {!run.input_request.manual_handoff && run.input_request.fields.map(field => <label key={field.key} style={{ display: 'block', marginBottom: 9, fontSize: 11.5, fontWeight: 600 }}>
        {field.label}
        <input type={['password', 'email', 'tel'].includes(field.input_type) ? field.input_type : 'text'} value={inputValues[field.key] || ''} onChange={e => setInputValues(old => ({ ...old, [field.key]: e.target.value }))} autoComplete="off" required
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
      </label>)}
      {run.input_request.manual_handoff && <p style={{ color: 'var(--feuji-red)', fontSize: 12 }}>The current page needs a manual browser step. The agent is running headless and cannot solve visual CAPTCHAs or security challenges; stop this run and complete that step manually.</p>}
      {!run.input_request.manual_handoff && <button className="btn btn-primary" type="submit" disabled={loading} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{loading ? <LoaderCircle size={14} className="spinner" /> : null} Resume run</button>}
    </form>}

    {run && <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: 12, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 12.5 }}>
        {run.status === 'completed' ? <CheckCircle size={16} color="var(--accent-green)" /> : run.status === 'failed' || run.status === 'step_limit' ? <AlertTriangle size={16} color="var(--feuji-red)" /> : <LoaderCircle size={15} className="spinner" />}
        <strong>{run.status.replaceAll('_', ' ')}</strong><span style={{ color: 'var(--text-muted)' }}>· {run.provider} / {run.model}</span>
      </div>
      {run.result && <p style={{ margin: '10px 0', fontSize: 13, lineHeight: 1.6 }}>{run.result}</p>}
      {run.error && <p role="alert" style={{ color: 'var(--feuji-red)', fontSize: 12.5 }}>{run.error}</p>}
      {run.events.map(event => <div key={event.step} style={{ marginTop: 10, padding: 11, border: '1px solid var(--border)', borderRadius: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5 }}><strong>Step {event.step} · {event.action.replaceAll('_', ' ')}</strong><time style={{ color: 'var(--text-muted)' }}>{new Date(event.at).toLocaleString()}</time></div>
        {event.message && <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5 }}>{event.message}</div>}
        {event.title && <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11.5 }}>{event.title} · {event.url}</div>}
        {event.screenshot && <a href={artifactUrl(event.screenshot)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 7, color: 'var(--feuji-red)', fontSize: 11.5 }}>Open genuine browser screenshot <ExternalLink size={11} /></a>}
        {event.screenshot && <img src={artifactUrl(event.screenshot)} alt={`Browser evidence for step ${event.step}`} loading="lazy" style={{ display: 'block', maxWidth: '100%', maxHeight: 440, objectFit: 'contain', objectPosition: 'top left', marginTop: 8, border: '1px solid var(--border)', borderRadius: 5 }} />}
        {(event.console_errors?.length || event.page_errors?.length) ? <div style={{ marginTop: 6, color: 'var(--feuji-red)', fontSize: 11 }}>Browser errors: {[...(event.console_errors || []), ...(event.page_errors || [])].join(' · ')}</div> : null}
      </div>)}
      {run.status !== 'needs_input' && <a href={`http://localhost:8000/api/ai-qa/runs/${run.run_id}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 5, alignItems: 'center', marginTop: 10, color: 'var(--feuji-red)', fontSize: 12 }}>Open saved run report <ExternalLink size={11} /></a>}
    </div>}
  </div>;
}

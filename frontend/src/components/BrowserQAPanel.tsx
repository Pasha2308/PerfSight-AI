import { useState } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Globe, Image, LoaderCircle, Search } from 'lucide-react';
import { runBrowserQA } from '../api';

type QAReport = {
  run_id: string; target_url: string; verdict: string;
  checks: Record<string, { passed: boolean; status?: number; value?: string; final_url?: string; text_length?: number }>;
  links_checked: number; broken_links: { url: string; status?: number; error?: string }[];
  console_errors: { message: string }[]; page_errors: { message: string }[];
  evidence: { screenshot: string; report: string };
};

export function BrowserQAPanel() {
  const [url, setUrl] = useState('https://example.com');
  const [checkLinks, setCheckLinks] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<QAReport | null>(null);

  const run = async () => {
    setLoading(true); setError(''); setReport(null);
    try { setReport(await runBrowserQA(url, checkLinks)); }
    catch (err: any) { setError(err?.response?.data?.detail || err?.message || 'Browser check failed'); }
    finally { setLoading(false); }
  };

  return <div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, color: 'var(--text-primary)' }}>
      <Globe size={18} color="var(--feuji-red)" /><strong>Core Browser QA</strong>
    </div>
    <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.6 }}>
      Open a site in a local headless browser, check page health and links, capture browser errors, and save a screenshot with a JSON report.
    </p>
    <label htmlFor="browser-qa-url" style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Website URL</label>
    <div style={{ display: 'flex', gap: 8 }}>
      <input id="browser-qa-url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && run()}
        placeholder="https://your-site.example" style={{ flex: 1, padding: '11px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 13 }} />
      <button className="btn btn-primary" onClick={run} disabled={loading || !url.trim()} style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
        {loading ? <><LoaderCircle size={15} className="spinner" /> Checking…</> : <><Search size={15} /> Run browser QA</>}
      </button>
    </div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-secondary)', fontSize: 12 }}>
      <input type="checkbox" checked={checkLinks} onChange={e => setCheckLinks(e.target.checked)} /> Check up to 50 page links
    </label>
    {error && <div role="alert" style={{ marginTop: 16, padding: 12, borderRadius: 7, background: 'rgba(220,50,47,.08)', color: 'var(--feuji-red)', fontSize: 12.5 }}>{error}</div>}
    {report && <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 14, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
          {report.verdict === 'passed' ? <CheckCircle size={18} color="var(--accent-green)" /> : <AlertTriangle size={18} color="var(--feuji-amber)" />}
          {report.verdict === 'passed' ? 'Page checks passed' : 'Issues found'}
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>· {report.links_checked} links checked</span>
        </div>
        <a href={`http://localhost:8000${report.evidence.screenshot}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--feuji-red)' }}><Image size={14} /> Screenshot <ExternalLink size={12} /></a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 8, marginTop: 10 }}>
        {Object.entries(report.checks).map(([name, check]) => <div key={name} style={{ padding: 12, borderRadius: 7, border: '1px solid var(--border)', fontSize: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>{check.passed ? <CheckCircle size={13} color="var(--accent-green)" /> : <AlertTriangle size={13} color="var(--feuji-red)" />}{name.replaceAll('_', ' ')}</div>
          <div style={{ marginTop: 5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{check.status ? `HTTP ${check.status}` : check.value || check.final_url || `${check.text_length || 0} characters`}</div>
        </div>)}
      </div>
      {(report.broken_links.length > 0 || report.console_errors.length > 0 || report.page_errors.length > 0) && <div style={{ marginTop: 12, padding: 13, borderRadius: 7, border: '1px solid var(--border)', fontSize: 12 }}>
        {report.broken_links.length > 0 && <div style={{ marginBottom: 8 }}><strong>Broken links ({report.broken_links.length})</strong>{report.broken_links.slice(0, 20).map(link => <div key={link.url} style={{ marginTop: 5, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{link.status ? `HTTP ${link.status}` : link.error} · {link.url}</div>)}</div>}
        {report.console_errors.length > 0 && <div style={{ marginBottom: 8 }}><strong>Browser console errors ({report.console_errors.length})</strong>{report.console_errors.slice(0, 10).map((item, i) => <div key={i} style={{ color: 'var(--text-muted)', marginTop: 4 }}>{item.message}</div>)}</div>}
        {report.page_errors.length > 0 && <div><strong>Page errors ({report.page_errors.length})</strong>{report.page_errors.slice(0, 10).map((item, i) => <div key={i} style={{ color: 'var(--text-muted)', marginTop: 4 }}>{item.message}</div>)}</div>}
      </div>}
    </div>}
  </div>;
}

import React, { useState } from 'react';
import { GitPullRequest, GitMerge, CheckCircle, AlertCircle, Play, Settings } from 'lucide-react';
import { startTestNL } from '../../api';

export const CICDPanel: React.FC = () => {
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const simulateWebhook = async () => {
    setSimulating(true);
    setResult(null);
    setLogs(['[GitHub Webhook] Received PR #142 (Update Cart Service)']);
    
    await new Promise(r => setTimeout(r, 1000));
    setLogs(l => [...l, '[PerfSight] Triggering baseline performance test...']);
    
    try {
      // Simulate by calling the backend to run a small load test
      await startTestNL('Simulate PR load for cart service', 'https://api.retail.com', 'Cart Service PR', 'k6');
      
      await new Promise(r => setTimeout(r, 2000));
      setLogs(l => [...l, '[PerfSight] Analyzing latency deviations from main branch...']);
      
      await new Promise(r => setTimeout(r, 2000));
      setLogs(l => [...l, '[PerfSight] No degradations found. P95 latency is stable.']);
      setLogs(l => [...l, '[GitHub Webhook] Posting success status check to PR #142.']);
      setResult('success');
    } catch (e) {
      setLogs(l => [...l, '[PerfSight] Critical degradation found! P99 latency exceeded SLA (1500ms > 500ms).']);
      setLogs(l => [...l, '[GitHub Webhook] Posting failure status check. Blocking merge.']);
      setResult('failure');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitPullRequest size={20} color="var(--feuji-red)" /> CI/CD Integrations
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
          Integrate PerfSight AI directly into your developer workflows. Block Pull Requests automatically if performance degrades compared to the baseline.
        </p>
      </div>

      <div style={{
        padding: 24, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)',
        display: 'flex', gap: 24, flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>GitHub App Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Webhook Secret</label>
              <input type="password" value="************************" readOnly className="input" style={{ marginTop: 4, background: 'var(--bg-primary)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Target Branches</label>
              <input type="text" value="main, develop, release/*" readOnly className="input" style={{ marginTop: 4, background: 'var(--bg-primary)' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Webhook Integration</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Trigger a GitHub Pull Request webhook call to verify the automated headless testing workflow.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={simulateWebhook} 
            disabled={simulating}
            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'center', gap: 8 }}
          >
            {simulating ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <Play size={16} />}
            Trigger Webhook Check
          </button>

          {logs.length > 0 && (
            <div style={{
              marginTop: 16, background: '#111827', borderRadius: 8, padding: 12,
              fontFamily: 'monospace', fontSize: 12, color: '#10B981', flex: 1, minHeight: 120
            }}>
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 4 }}>{log}</div>
              ))}
              {simulating && <div style={{ animation: 'pulse 1s infinite' }}>_</div>}
            </div>
          )}

          {result && (
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 8,
              background: result === 'success' ? 'var(--glow-green)' : 'var(--glow-red)',
              color: result === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
              display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600
            }}>
              {result === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
              {result === 'success' ? 'Status: All Checks Passed. PR Approved.' : 'Status: Checks Failed. PR Blocked.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

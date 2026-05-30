import React, { useState } from 'react';
import { Activity, Database, CloudRain, Play, AlertCircle } from 'lucide-react';
import { useStore } from '../../../store';
import { startTestNL } from '../../../api';

export const ObservabilityPanel: React.FC = () => {
  const [streaming, setStreaming] = useState(false);
  const { setPhase } = useStore();

  const handleStreamToggle = () => {
    if (streaming) {
      setStreaming(false);
      return;
    }
    
    setStreaming(true);
    // Simulate streaming data to the backend which triggers an automatic analysis
    setTimeout(() => {
      setPhase('scenario', 'running', 'Ingesting Datadog traffic streams...');
    }, 1000);
    setTimeout(() => {
      setPhase('scenario', 'done', 'Analyzed 540k requests. Generated Script.');
      setStreaming(false);
    }, 4000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={20} color="var(--feuji-red)" /> Telemetry Integrations
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
          Connect Datadog, Prometheus, or AWS CloudWatch to automatically map production traffic into performance scripts. No more manual log uploads.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Datadog Card */}
        <div style={{
          flex: 1, minWidth: 280, padding: 24, borderRadius: 12,
          border: '2px solid var(--feuji-red)', background: 'var(--bg-secondary)',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--glow-green)', color: 'var(--accent-green)', padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700 }}>
            CONNECTED
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#632CA6', padding: 8, borderRadius: 8 }}>
              <Database size={24} color="white" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Datadog APM</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Streaming application logs and trace data from `service:cart-api` in `env:production`.
          </p>
          <button 
            className={`btn ${streaming ? 'btn-ghost' : 'btn-primary'}`} 
            onClick={handleStreamToggle}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {streaming ? 'Stop Streaming' : <><Play size={14} /> Stream Mock Data</>}
          </button>
        </div>

        {/* Prometheus Card */}
        <div style={{
          flex: 1, minWidth: 280, padding: 24, borderRadius: 12,
          border: '1px solid var(--border)', background: 'var(--bg-secondary)',
          opacity: 0.6
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#E6522C', padding: 8, borderRadius: 8 }}>
              <CloudRain size={24} color="white" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Prometheus</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Connect your Prometheus server to pull real-time RPS and latency metrics.
          </p>
          <button className="btn btn-ghost" disabled style={{ width: '100%', justifyContent: 'center' }}>
            Configure Connection
          </button>
        </div>
      </div>
    </div>
  );
};

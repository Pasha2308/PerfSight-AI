import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStore } from '../store';
import { Activity, Users, AlertTriangle, Zap } from 'lucide-react';

export const LiveMonitor: React.FC = () => {
  const { liveMetrics, liveInfra, liveVUs, liveProgress, phases } = useStore();

  // Build time-series data (30-sec buckets)
  const chartData = useMemo(() => {
    if (liveMetrics.length === 0) return { times: [], p99: [], p95: [], p50: [], errors: [], vus: [] };
    const sorted = [...liveMetrics].sort((a, b) => a.timestamp - b.timestamp);
    const bucketMs = 10_000;
    const startTs = sorted[0].timestamp;
    const buckets: Record<number, number[]> = {};
    const errorBuckets: Record<number, number> = {};
    const countBuckets: Record<number, number> = {};
    const vuBuckets: Record<number, number> = {};

    sorted.forEach(m => {
      const b = Math.floor((m.timestamp - startTs) / bucketMs) * bucketMs;
      if (!buckets[b]) { buckets[b] = []; errorBuckets[b] = 0; countBuckets[b] = 0; vuBuckets[b] = 0; }
      buckets[b].push(m.response_time);
      if (m.status_code >= 400) errorBuckets[b]++;
      countBuckets[b]++;
      vuBuckets[b] = Math.max(vuBuckets[b], m.vus || 0);
    });

    const times: string[] = [], p99: number[] = [], p95: number[] = [], p50: number[] = [];
    const errors: number[] = [], vus: number[] = [];

    Object.entries(buckets).sort((a, b) => +a[0] - +b[0]).forEach(([ts, vals]) => {
      const sec = +ts / 1000;
      const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
      times.push(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      const sorted_vals = [...vals].sort((a, b) => a - b);
      const pct = (p: number) => sorted_vals[Math.floor(sorted_vals.length * p / 100)] || 0;
      p99.push(Math.round(pct(99)));
      p95.push(Math.round(pct(95)));
      p50.push(Math.round(pct(50)));
      errors.push(Math.round(errorBuckets[+ts] / (countBuckets[+ts] || 1) * 100 * 10) / 10);
      vus.push(vuBuckets[+ts]);
    });

    return { times, p99, p95, p50, errors, vus };
  }, [liveMetrics]);

  const latestInfra = liveInfra[liveInfra.length - 1] || {};
  const currentP99 = chartData.p99[chartData.p99.length - 1] || 0;
  const currentErrors = chartData.errors[chartData.errors.length - 1] || 0;

  const chartOpts = {
    backgroundColor: 'transparent',
    grid: { top: 30, right: 20, bottom: 40, left: 60, containLabel: false },
    tooltip: {
      trigger: 'axis', backgroundColor: '#1a2332', borderColor: '#2d4a6e', textStyle: { color: '#e6edf3', fontSize: 12 },
      formatter: (params: any) => params.map((p: any) => `${p.seriesName}: <b>${p.value}ms</b>`).join('<br/>'),
    },
    legend: { top: 5, textStyle: { color: '#8b949e', fontSize: 11 }, data: ['p99', 'p95', 'p50'] },
    xAxis: { type: 'category', data: chartData.times, axisLine: { lineStyle: { color: '#1e2d3d' } }, axisLabel: { color: '#484f58', fontSize: 10 }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLine: { show: false }, axisLabel: { color: '#484f58', fontSize: 10, formatter: (v: number) => `${v}ms` }, splitLine: { lineStyle: { color: '#1e2d3d', type: 'dashed' } } },
    series: [
      { name: 'p99', type: 'line', data: chartData.p99, smooth: true, symbol: 'none', lineStyle: { color: '#f85149', width: 2 }, areaStyle: { color: 'rgba(248,81,73,0.08)' } },
      { name: 'p95', type: 'line', data: chartData.p95, smooth: true, symbol: 'none', lineStyle: { color: '#d29922', width: 1.5 }, areaStyle: { color: 'rgba(210,153,34,0.05)' } },
      { name: 'p50', type: 'line', data: chartData.p50, smooth: true, symbol: 'none', lineStyle: { color: '#3fb950', width: 1.5 }, areaStyle: { color: 'rgba(63,185,80,0.05)' } },
    ],
  };

  const vuOpts = {
    backgroundColor: 'transparent',
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    tooltip: { trigger: 'axis', backgroundColor: '#1a2332', borderColor: '#2d4a6e', textStyle: { color: '#e6edf3', fontSize: 12 } },
    xAxis: { type: 'category', data: chartData.times, axisLabel: { color: '#484f58', fontSize: 9 }, axisLine: { lineStyle: { color: '#1e2d3d' } }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: '#484f58', fontSize: 9 }, splitLine: { lineStyle: { color: '#1e2d3d', type: 'dashed' } }, axisLine: { show: false } },
    series: [{
      name: 'Virtual Users', type: 'area', data: chartData.vus, smooth: true, symbol: 'none',
      lineStyle: { color: '#58a6ff', width: 2 }, areaStyle: { color: 'rgba(88,166,255,0.15)' },
      itemStyle: { color: '#58a6ff' },
    }],
  };

  const isExecuting = phases.executing?.status === 'running';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Live stats row */}
      <div className="grid-4">
        {[
          { label: 'Virtual Users', value: liveVUs, icon: <Users size={16} />, color: 'var(--accent-blue)', unit: '' },
          { label: 'p99 Latency', value: currentP99, icon: <Activity size={16} />, color: currentP99 > 500 ? 'var(--accent-red)' : 'var(--accent-green)', unit: 'ms' },
          { label: 'Error Rate', value: currentErrors, icon: <AlertTriangle size={16} />, color: currentErrors > 1 ? 'var(--accent-red)' : 'var(--accent-green)', unit: '%' },
          { label: 'Progress', value: liveProgress, icon: <Zap size={16} />, color: 'var(--accent-purple)', unit: '%' },
        ].map(stat => (
          <div key={stat.label} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="metric-label">{stat.label}</div>
                <div className="metric-value" style={{ color: stat.color, fontSize: 24, marginTop: 6 }}>
                  {stat.value}{stat.unit}
                </div>
              </div>
              <div style={{ color: stat.color, opacity: 0.7 }}>{stat.icon}</div>
            </div>
            {isExecuting && stat.label === 'Progress' && (
              <div className="progress-bar" style={{ marginTop: 12 }}>
                <div className="progress-fill" style={{ width: `${stat.value}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Response time chart */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, color: 'var(--text-primary)' }}>Response Time Distribution</h3>
          {isExecuting && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className="live-dot" /><span style={{ fontSize: 12, color: 'var(--accent-green)' }}>LIVE</span></div>}
        </div>
        <ReactECharts option={chartOpts} style={{ height: 260 }} />
      </div>

      {/* Virtual Users + Infra */}
      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Virtual Users</h3>
          <ReactECharts option={vuOpts} style={{ height: 160 }} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Infrastructure (Live)</h3>
          {Object.keys(latestInfra).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'cpu_pct', label: 'CPU', color: latestInfra.cpu_pct > 80 ? 'var(--accent-red)' : 'var(--accent-green)' },
                { key: 'memory_pct', label: 'Memory', color: latestInfra.memory_pct > 85 ? 'var(--accent-red)' : 'var(--accent-yellow)' },
                { key: 'db_cpu_pct', label: 'DB CPU', color: latestInfra.db_cpu_pct > 70 ? 'var(--accent-red)' : 'var(--accent-green)' },
                { key: 'db_connections', label: 'DB Connections', color: 'var(--accent-blue)', max: 100 },
              ].map(m => (
                <div key={m.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                    <span style={{ color: m.color, fontWeight: 600 }}>{latestInfra[m.key]}{m.key !== 'db_connections' ? '%' : ''}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, latestInfra[m.key])}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Waiting for infrastructure data...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

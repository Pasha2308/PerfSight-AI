import axios from 'axios';
import { getLLMConfig } from './components/SettingsDrawer';

const API = axios.create({ baseURL: 'http://localhost:8000' });

let authToken: string | null = null;
export const setAuthToken = (token: string | null) => { authToken = token; };

// Inject LLM headers on every request from localStorage config
API.interceptors.request.use(config => {
  if (authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }
  const llm = getLLMConfig();
  config.headers['X-LLM-Provider'] = llm.provider;
  config.headers['X-LLM-Model'] = llm.model;
  if (llm.apiKey) config.headers['X-LLM-Key'] = llm.apiKey;
  return config;
});

export const login = (email: string, password: string) => 
  API.post('/api/auth/login', { email, password }).then(r => r.data);

export const register = (email: string, password: string, name: string) =>
  API.post('/api/auth/register', { email, password, name }).then(r => r.data);


// ─── Existing APIs ───────────────────────────────────────────────

export const startTest = (data: {
  project_name: string;
  target_url: string;
  scenario_type: string;
  tool: string;
}) => API.post('/api/tests/start', data).then(r => r.data);

export const listTests = () => API.get('/api/tests').then(r => r.data);

export const getTest = (id: string) => API.get(`/api/tests/${id}`).then(r => r.data);

export const getReport = (id: string) => API.get(`/api/tests/${id}/report`).then(r => r.data);

export const sendChat = (test_run_id: string, message: string) =>
  API.post('/api/chat', { test_run_id, message }).then(r => r.data);

export const getChatHistory = (id: string) => API.get(`/api/chat/${id}/history`).then(r => r.data);

export const retest = (original_run_id: string, scenario_type?: string, peak_vus?: number) =>
  API.post('/api/tests/retest', { original_run_id, scenario_type, peak_vus }).then(r => r.data);

export const parseScenario = (description: string, target_url: string, project_name: string) =>
  API.post('/api/scenarios/parse', { description, target_url, project_name }).then(r => r.data);

export const startTestNL = (description: string, target_url: string, project_name: string, tool: string) =>
  API.post('/api/tests/start-nl', { description, target_url, project_name, tool }).then(r => r.data);

export const createWebSocket = (runId: string): WebSocket => {
  return new WebSocket(`ws://localhost:8000/ws/${runId}`);
};

// ─── JMeter Correlation APIs ─────────────────────────────────────

export const correlateJmx = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/api/correlate/jmx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min — correlation can take time
  }).then(r => r.data);
};

export const correlateHar = (file: File, projectName: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_name', projectName);
  return API.post('/api/correlate/har', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);
};

export const optimizeJmx = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return API.post('/api/optimize/jmx', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);
};

// ─── Test Data Import APIs ───────────────────────────────────────

export const importJtl = (file: File, projectName: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_name', projectName);
  return API.post('/api/import/jtl', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000, // 3 min — analysis pipeline
  }).then(r => r.data);
};

export const importK6 = (file: File, projectName: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_name', projectName);
  return API.post('/api/import/k6', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  }).then(r => r.data);
};

export const importCsv = (file: File, projectName: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_name', projectName);
  return API.post('/api/import/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  }).then(r => r.data);
};

// ─── CI/CD APIs ──────────────────────────────────────────────────

export const ciTrigger = (data: {
  project_name: string;
  target_url: string;
  scenario_type?: string;
  tool?: string;
  nl_description?: string;
  sla_p99_ms?: number;
  sla_error_rate_pct?: number;
}) => API.post('/api/ci/trigger', data).then(r => r.data);

export const ciQualityGate = (data: {
  run_id: string;
  sla_p99_ms?: number;
  sla_error_rate_pct?: number;
  sla_min_throughput_rps?: number;
}) => API.post('/api/ci/gate', data).then(r => r.data);

// ─── Health ──────────────────────────────────────────────────────

export const healthCheck = () => API.get('/api/health').then(r => r.data);

export const runBrowserQA = (url: string, check_links = true) =>
  API.post('/api/browser-qa/run', { url, check_links }, { timeout: 300000 }).then(r => r.data);

export const startAIQARun = (scenario: string) =>
  API.post('/api/ai-qa/runs', { scenario }, { timeout: 30000 }).then(r => r.data);

export const getAIQARun = (runId: string) =>
  API.get(`/api/ai-qa/runs/${runId}`, { timeout: 15000 }).then(r => r.data);

export const resumeAIQARun = (runId: string, values: Record<string, string>) =>
  API.post(`/api/ai-qa/runs/${runId}/resume`, { values }, { timeout: 15000 }).then(r => r.data);

// ─── LLM Config Test ─────────────────────────────────────────────

export const testLLMConnection = (provider: string, model: string) =>
  API.post('/api/llm/test', { provider, model }).then(r => r.data);

// ─── Traffic Ingestion APIs (Use Case 2) ─────────────────────────

export const analyzeTrafficLogs = (file: File, projectName: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('project_name', projectName);
  return API.post('/api/traffic/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  }).then(r => r.data);
};

export const generateScriptFromTraffic = (data: {
  traffic_records: any[];
  journeys: any[];
  tool: string;
  project_name: string;
}) => API.post('/api/traffic/generate-script', data, { timeout: 120000 }).then(r => r.data);


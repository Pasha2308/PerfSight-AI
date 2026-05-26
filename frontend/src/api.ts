import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:8000' });

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

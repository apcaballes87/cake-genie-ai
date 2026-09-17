import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getConfiguration = vi.fn();
const runLab = vi.fn();

vi.mock('@/lib/admin/aiPromptLab', () => ({
  AiPromptLabError: class AiPromptLabError extends Error {
    constructor(message: string, public status = 400) { super(message); }
  },
  getAiPromptLabConfiguration: (...args: unknown[]) => getConfiguration(...args),
  runAiPromptLabAnalysis: (...args: unknown[]) => runLab(...args),
}));
vi.mock('@/lib/admin/imageStudio', () => ({ ADMIN_IMAGE_STUDIO_PIN: '231323' }));

describe('/api/admin/ai-prompt-lab', () => {
  beforeEach(() => {
    vi.resetModules();
    getConfiguration.mockReset();
    runLab.mockReset();
  });

  it('rejects unauthenticated configuration and execution before services are called', async () => {
    const { GET, POST } = await import('./route');
    expect((await GET(new NextRequest('http://localhost/api/admin/ai-prompt-lab'))).status).toBe(401);
    expect((await POST(new NextRequest('http://localhost/api/admin/ai-prompt-lab', {
      method: 'POST', body: '{}', headers: { 'content-type': 'application/json' },
    }))).status).toBe(401);
    expect(getConfiguration).not.toHaveBeenCalled();
    expect(runLab).not.toHaveBeenCalled();
  });

  it('returns the isolated lab execution payload for an authenticated request', async () => {
    runLab.mockResolvedValue({ rawResponse: '{}', analysis: null, pricing: null, validationErrors: ['invalid'] });
    const { POST } = await import('./route');
    const response = await POST(new NextRequest('http://localhost/api/admin/ai-prompt-lab', {
      method: 'POST', body: JSON.stringify({ test: true }),
      headers: { 'content-type': 'application/json', 'x-admin-pin': '231323' },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rawResponse: '{}', pricing: null });
    expect(runLab).toHaveBeenCalledTimes(1);
  });
});

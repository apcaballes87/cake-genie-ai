import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { adminCorsHeaders, forwardStaffAuthHeaders } from './adminAuth';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin auth request helpers', () => {
  it('forwards bearer and cookie credentials without a shared secret', () => {
    const request = new NextRequest('https://genie.ph/api/admin/example', {
      headers: {
        authorization: 'Bearer staff-token',
        cookie: 'sb-session=session-value',
      },
    });

    expect(forwardStaffAuthHeaders(request)).toEqual({
      Authorization: 'Bearer staff-token',
      Cookie: 'sb-session=session-value',
    });
  });

  it('allows the configured dashboard origin and Authorization header', () => {
    vi.stubEnv('ADMIN_DASHBOARD_ORIGIN', 'https://admin.genie.ph');
    const request = new NextRequest('https://genie.ph/api/admin/example', {
      headers: { origin: 'https://admin.genie.ph' },
    });
    const headers = new Headers(adminCorsHeaders(request, ['GET', 'POST']));

    expect(headers.get('access-control-allow-origin')).toBe('https://admin.genie.ph');
    expect(headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
    expect(headers.get('access-control-allow-credentials')).toBe('true');
  });

  it('does not grant CORS access to a different origin', () => {
    vi.stubEnv('ADMIN_DASHBOARD_ORIGIN', 'https://admin.genie.ph');
    const request = new NextRequest('https://genie.ph/api/admin/example', {
      headers: { origin: 'https://attacker.example' },
    });
    const headers = new Headers(adminCorsHeaders(request, ['GET']));

    expect(headers.has('access-control-allow-origin')).toBe(false);
  });
});

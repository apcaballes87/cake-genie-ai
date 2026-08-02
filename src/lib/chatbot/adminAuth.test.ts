import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import {
  DEFAULT_ADMIN_DASHBOARD_ORIGIN,
  adminCorsHeaders,
  forwardStaffAuthHeaders,
  getNetworkAdminIpHash,
} from './adminAuth';

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

  it('defaults CORS to the canonical dashboard when the environment override is absent', () => {
    const request = new NextRequest('https://genie.ph/api/admin/example', {
      headers: { origin: DEFAULT_ADMIN_DASHBOARD_ORIGIN },
    });
    const headers = new Headers(adminCorsHeaders(request, ['GET']));

    expect(headers.get('access-control-allow-origin')).toBe(DEFAULT_ADMIN_DASHBOARD_ORIGIN);
  });

  it('derives a stable network key only for the exact dashboard origin', () => {
    const trusted = new NextRequest('https://genie.ph/api/admin/example', {
      headers: {
        origin: DEFAULT_ADMIN_DASHBOARD_ORIGIN,
        'x-vercel-forwarded-for': '203.0.113.42',
      },
    });
    const hostile = new NextRequest('https://genie.ph/api/admin/example', {
      headers: {
        origin: 'https://attacker.example',
        'x-vercel-forwarded-for': '203.0.113.42',
      },
    });

    expect(getNetworkAdminIpHash(trusted)).toBe('17af1cf3d1b5332c53349fc789abdc853bbeea7ed33eff727ff794ab741ccac9');
    expect(getNetworkAdminIpHash(hostile)).toBeNull();
  });
});

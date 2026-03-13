// src/lib/services/pinterest.ts

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
}

export interface PinterestSection {
  id: string;
  name: string;
}

export interface PinterestPin {
  id: string;
  title?: string;
  description?: string;
  link?: string;
  image_url: string;
}

export interface PinterestTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in: number;
  scope: string;
  token_type: string;
}

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

export const pinterestService = {
  /**
   * Get the authorization URL for Pinterest OAuth 2.0
   */
  getAuthUrl: (clientId: string, redirectUri: string, state: string) => {
    const scopes = ['boards:read', 'boards:write', 'pins:read', 'pins:write'];
    const url = new URL('https://www.pinterest.com/oauth/');
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('response_type', 'code');
    url.searchParams.append('scope', scopes.join(','));
    url.searchParams.append('state', state);
    return url.toString();
  },

  /**
   * Exchange authorization code for access and refresh tokens
   */
  exchangeCodeForToken: async (
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<PinterestTokenResponse> => {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Pinterest token exchange failed: ${JSON.stringify(error)}`);
    }

    return response.json();
  },

  /**
   * Create a new board on Pinterest
   */
  createBoard: async (accessToken: string, name: string, description?: string): Promise<PinterestBoard> => {
    const response = await fetch(`${PINTEREST_API_BASE}/boards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Pinterest board: ${JSON.stringify(error)}`);
    }

    return response.json();
  },

  /**
   * Create a section within a board
   */
  createSection: async (accessToken: string, boardId: string, name: string): Promise<PinterestSection> => {
    const response = await fetch(`${PINTEREST_API_BASE}/boards/${boardId}/sections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Pinterest section: ${JSON.stringify(error)}`);
    }

    return response.json();
  },

  /**
   * Create a pin
   */
  createPin: async (
    accessToken: string,
    params: {
      board_id: string;
      board_section_id?: string;
      title?: string;
      description?: string;
      link?: string;
      media_source: {
        source_type: 'image_url';
        url: string;
      };
    }
  ): Promise<PinterestPin> => {
    const response = await fetch(`${PINTEREST_API_BASE}/pins`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create Pinterest pin: ${JSON.stringify(error)}`);
    }

    return response.json();
  },
};

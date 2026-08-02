'use client';

import { useEffect, useState } from 'react';

import type { BusinessProfile } from '@/lib/chatbot/knowledge';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';

const fallback: BusinessProfile = {
  version: 0,
  name: genieBusinessProfile.name,
  addressLine: genieBusinessProfile.addressLine,
  hoursDisplay: genieBusinessProfile.hoursDisplay,
  supportEmail: genieBusinessProfile.supportEmail,
  phoneDisplay: genieBusinessProfile.phoneDisplay,
  phoneHref: genieBusinessProfile.phoneHref,
  mapUrl: genieBusinessProfile.mapUrl,
  serviceArea: genieBusinessProfile.primaryServiceAreaLabel,
};

export function usePublishedBusinessProfile(): BusinessProfile {
  const [profile, setProfile] = useState<BusinessProfile>(fallback);

  useEffect(() => {
    let active = true;
    void getProfile().then((nextProfile) => {
      if (active && nextProfile) setProfile(nextProfile);
    });
    return () => { active = false; };
  }, []);

  return profile;
}

let profileRequest: Promise<BusinessProfile | null> | null = null;

function getProfile(): Promise<BusinessProfile | null> {
  if (!profileRequest) {
    profileRequest = fetch('/api/business-profile')
      .then((response) => response.ok ? response.json() : null)
      .then((value) => value?.version >= 0 ? value as BusinessProfile : null)
      .catch(() => null);
  }
  return profileRequest;
}

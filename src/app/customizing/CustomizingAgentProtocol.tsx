'use client';

import {
  CUSTOMIZER_AGENT_CAPABILITY_MAP,
  serializeAgentJson,
  type CustomizerAgentModel,
} from '@/lib/commerce/customizerAgentModel';

interface CustomizingAgentProtocolProps {
  model: CustomizerAgentModel;
}

export function CustomizingAgentProtocol({ model }: CustomizingAgentProtocolProps) {
  return (
    <>
      <script
        id="customizer-agent-model"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: serializeAgentJson(model) }}
      />
      <script
        id="customizer-capability-map"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: serializeAgentJson(CUSTOMIZER_AGENT_CAPABILITY_MAP) }}
      />
    </>
  );
}

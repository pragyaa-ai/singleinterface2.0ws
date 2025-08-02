import { authenticationAgent } from './authentication';
import { returnsAgent } from './returns';
import { salesAgent } from './sales';
import { simulatedHumanAgent } from './simulatedHuman';
import { spotlightAgent } from './spotlight';
import { carDealerAgent } from './carDealer';

// Cast to `any` to satisfy TypeScript until the core types make RealtimeAgent
// assignable to `Agent<unknown>` (current library versions are invariant on
// the context type).
(authenticationAgent.handoffs as any).push(returnsAgent, salesAgent, simulatedHumanAgent, spotlightAgent, carDealerAgent);
(returnsAgent.handoffs as any).push(authenticationAgent, salesAgent, simulatedHumanAgent, spotlightAgent, carDealerAgent);
(salesAgent.handoffs as any).push(authenticationAgent, returnsAgent, simulatedHumanAgent, spotlightAgent, carDealerAgent);
(simulatedHumanAgent.handoffs as any).push(authenticationAgent, returnsAgent, salesAgent, spotlightAgent, carDealerAgent);
(spotlightAgent.handoffs as any).push(carDealerAgent, simulatedHumanAgent); // Spotlight hands off to car dealer and human agent
(carDealerAgent.handoffs as any).push(authenticationAgent, returnsAgent, salesAgent, simulatedHumanAgent, spotlightAgent);

export const customerServiceRetailScenario = [
  authenticationAgent,
  returnsAgent,
  salesAgent,
  simulatedHumanAgent,
  spotlightAgent,
  carDealerAgent,
];

// Name of the company represented by this agent set. Used by guardrails
export const customerServiceRetailCompanyName = 'Single Interface';

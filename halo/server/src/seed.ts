import type { Halo } from './core/halo.js';

/** Seed the demo: Northshore Bank (partner) + a few businesses with registered agents. */
export function seed(halo: Halo) {
  const northshore = halo.registerBusiness({ name: 'Northshore Bank', domain: 'northshorebank.example', category: 'bank' }, 'seed');
  halo.registerAgent(northshore.id, {
    displayName: 'Northshore Virtual Assistant',
    purpose: 'Notify customers of flagged transactions and answer account questions.',
    channels: ['call', 'sms', 'chat'],
    contract: {
      mayRequest: ['personal_data'],
      neverRequest: ['one_time_code', 'pin', 'password', 'gift_card', 'crypto', 'wire_transfer', 'remote_access'],
      maxAmount: 0,
      callbackNumber: '1-800-NORTHSHORE',
      jurisdictions: ['US'],
    },
  }, 'seed');

  const parcel = halo.registerBusiness({ name: 'ParcelExpress', domain: 'parcelexpress.example', category: 'delivery' }, 'seed');
  halo.registerAgent(parcel.id, {
    displayName: 'ParcelExpress Delivery Bot',
    purpose: 'Coordinate deliveries and redelivery scheduling.',
    channels: ['sms', 'chat'],
    contract: { mayRequest: [], neverRequest: ['one_time_code', 'pin', 'password', 'gift_card', 'crypto', 'wire_transfer'], maxAmount: 0, callbackNumber: '1-800-PARCEL', jurisdictions: ['US'] },
  }, 'seed');

  const utility = halo.registerBusiness({ name: 'BrightEnergy', domain: 'brightenergy.example', category: 'utility' }, 'seed');
  halo.registerAgent(utility.id, {
    displayName: 'BrightEnergy Billing Assistant',
    purpose: 'Help customers with bills and payment plans.',
    channels: ['call', 'chat'],
    contract: { mayRequest: ['personal_data'], neverRequest: ['one_time_code', 'pin', 'password', 'gift_card', 'crypto'], maxAmount: 0, callbackNumber: '1-800-BRIGHT', jurisdictions: ['US'] },
  }, 'seed');

  // A demo personal agent for the consumer app.
  halo.registerPersonalAgent({ userId: 'user_primary', name: 'Shopping Assistant', model: 'Qwen2.5-3B-Instruct (open)', task: 'Help me shop and manage errands within my limits.' });

  halo.activity.append({ type: 'demo.seeded', actor: 'seed', summary: 'Demo seeded: 3 businesses, 3 verified agents, 1 personal agent', payload: { businesses: 3 } });
}

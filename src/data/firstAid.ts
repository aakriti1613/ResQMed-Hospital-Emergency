import { HeartPulse, Droplets, Flame, AlertTriangle, Wind, Brain, Activity } from 'lucide-react';

export type EmergencyType =
  | 'Bleeding'
  | 'Choking'
  | 'Burn'
  | 'Seizure'
  | 'Fainting'
  | 'Fracture'
  | 'Asthma';

export interface FirstAidStep {
  title: string;
  description: string;
}

export interface FirstAidGuide {
  id: EmergencyType;
  title: string;
  icon: any; // Lucide component
  color: string;
  steps: FirstAidStep[];
  warning?: string;
}

export const firstAidGuides: FirstAidGuide[] = [
  {
    id: 'Bleeding',
    title: 'Severe Bleeding',
    icon: Droplets,
    color: '#ef4444',
    warning: 'If blood is spurting, apply pressure immediately and do not let go.',
    steps: [
      {
        title: 'Apply Direct Pressure',
        description: 'Use a clean cloth or sterile dressing to apply firm, direct pressure to the wound.',
      },
      {
        title: 'Elevate if Possible',
        description: 'If the wound is on an arm or leg, raise it above the level of the heart to slow bleeding.',
      },
      {
        title: 'Do Not Remove Cloth',
        description: 'If blood soaks through, do NOT remove the first cloth. Add more layers on top and press harder.',
      },
      {
        title: 'Keep Pressure Until Help Arrives',
        description: 'Maintain constant pressure until emergency responders take over.',
      },
    ],
  },
  {
    id: 'Choking',
    title: 'Choking',
    icon: Wind,
    color: '#3b82f6',
    warning: 'If the person can cough forcefully, let them keep coughing. Do not intervene unless they cannot breathe.',
    steps: [
      {
        title: '5 Back Blows',
        description: 'Stand behind them. Lean them forward. Give 5 firm blows between their shoulder blades with the heel of your hand.',
      },
      {
        title: '5 Abdominal Thrusts (Heimlich)',
        description: 'Make a fist just above their navel. Grab your fist with your other hand. Pull inward and upward forcefully 5 times.',
      },
      {
        title: 'Alternate Until Clear',
        description: 'Repeat 5 back blows and 5 abdominal thrusts until the object is forced out or they can breathe.',
      },
      {
        title: 'If Unconscious',
        description: 'If they become unresponsive, carefully lower them to the ground and begin CPR, starting with chest compressions.',
      },
    ],
  },
  {
    id: 'Seizure',
    title: 'Seizure',
    icon: Brain,
    color: '#8b5cf6',
    warning: 'Do NOT try to hold the person down or put anything in their mouth.',
    steps: [
      {
        title: 'Clear the Area',
        description: 'Move hard or sharp objects out of the way to prevent injury.',
      },
      {
        title: 'Protect the Head',
        description: 'Place something soft and flat under their head (like a folded jacket).',
      },
      {
        title: 'Loosen Tight Clothing',
        description: 'Loosen any tight clothing around their neck (ties, collars).',
      },
      {
        title: 'Roll on Side After',
        description: 'Once the shaking stops, gently roll them onto their side (recovery position) to keep their airway clear.',
      },
    ],
  },
  {
    id: 'Burn',
    title: 'Burns',
    icon: Flame,
    color: '#f97316',
    warning: 'Do NOT apply ice, butter, ointments, or pop any blisters.',
    steps: [
      {
        title: 'Cool the Burn',
        description: 'Run cool (not cold) water over the burn for at least 10-15 minutes.',
      },
      {
        title: 'Remove Restrictive Items',
        description: 'Remove rings or tight clothing near the burn quickly, before swelling begins.',
      },
      {
        title: 'Cover Loosely',
        description: 'Cover the burn loosely with a sterile, non-stick bandage or clean cloth.',
      },
    ],
  },
  {
    id: 'Fracture',
    title: 'Broken Bone',
    icon: AlertTriangle,
    color: '#eab308',
    warning: 'Do NOT try to realign the bone or push a bone back in.',
    steps: [
      {
        title: 'Stop Any Bleeding',
        description: 'Apply pressure to bleeding wounds using a sterile bandage or clean cloth.',
      },
      {
        title: 'Immobilize',
        description: 'Do not move the injured area. Use a splint if trained, otherwise just keep it completely still.',
      },
      {
        title: 'Apply Cold Pack',
        description: 'Wrap ice in a cloth and apply it to the area for 10-20 minutes to reduce swelling.',
      },
    ],
  },
  {
    id: 'Fainting',
    title: 'Fainting',
    icon: Activity,
    color: '#64748b',
    steps: [
      {
        title: 'Lay Them Flat',
        description: 'Position the person on their back.',
      },
      {
        title: 'Elevate Legs',
        description: 'If there are no apparent injuries, raise their legs about 12 inches above heart level.',
      },
      {
        title: 'Loosen Clothing',
        description: 'Loosen belts, collars, or other constrictive clothing.',
      },
      {
        title: 'If No Recovery',
        description: 'If they do not regain consciousness within 1 minute, call emergency services immediately.',
      },
    ],
  },
  {
    id: 'Asthma',
    title: 'Asthma Attack',
    icon: HeartPulse,
    color: '#0ea5e9',
    steps: [
      {
        title: 'Sit Upright',
        description: 'Help the person sit comfortably upright and try to keep them calm.',
      },
      {
        title: 'Use Inhaler',
        description: 'Help them use their own reliever inhaler (usually blue). Give 1 puff every 30-60 seconds, up to 10 puffs.',
      },
      {
        title: 'Call if No Improvement',
        description: 'If symptoms do not improve after 10 puffs, or if they worsen, call emergency services.',
      },
    ],
  },
];

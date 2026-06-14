export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type ScenarioChoice = {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
};

export type HealthScenario = {
  id: string;
  title: string;
  situation: string;
  prompt: string;
  choices: ScenarioChoice[];
  points: number;
};

export type HealthAwarenessEvent = {
  id: string;
  name: string;
  emoji: string;
  month: number;
  day: number;
  tagline: string;
  color: string;
  gradient: string;
  quizPoints: number;
  scenarioBonus: number;
  quiz: QuizQuestion[];
  scenarios: HealthScenario[];
};

export const HEALTH_AWARENESS_EVENTS: HealthAwarenessEvent[] = [
  {
    id: 'blood-donor-day',
    name: 'World Blood Donor Day',
    emoji: '🩸',
    month: 6,
    day: 14,
    tagline: 'Safe blood saves lives — know the basics',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg,#ef4444,#991b1b)',
    quizPoints: 40,
    scenarioBonus: 30,
    quiz: [
      {
        id: 'bd1',
        question: 'How often can a healthy adult donate whole blood?',
        options: ['Every week', 'Every 3 months', 'Once a year', 'Only in emergencies'],
        correctIndex: 1,
        explanation: 'In India, healthy adults can typically donate whole blood every 3 months (90 days).',
      },
      {
        id: 'bd2',
        question: 'Which blood type is the universal donor for RBCs?',
        options: ['AB+', 'O−', 'A+', 'B−'],
        correctIndex: 1,
        explanation: 'O negative red cells can be given to almost any patient in an emergency.',
      },
      {
        id: 'bd3',
        question: 'Before donating blood you should:',
        options: ['Skip meals', 'Eat a light meal & stay hydrated', 'Take aspirin', 'Exercise heavily'],
        correctIndex: 1,
        explanation: 'A light meal and hydration reduce dizziness after donation.',
      },
      {
        id: 'bd4',
        question: 'After donating, you should rest and avoid heavy lifting for:',
        options: ['15 minutes', 'About 24 hours', '1 week', 'No restrictions'],
        correctIndex: 1,
        explanation: 'Rest and avoid strenuous activity for ~24 hours to prevent bruising and fainting.',
      },
      {
        id: 'bd5',
        question: 'Who should NOT donate blood without medical clearance?',
        options: ['Someone with a cold or fever', 'A healthy 25-year-old', 'Someone who ate breakfast', 'A first-time donor'],
        correctIndex: 0,
        explanation: 'Active infection, fever, or recent illness usually defer donation.',
      },
    ],
    scenarios: [
      {
        id: 'bd-s1',
        title: 'Accident scene — severe bleeding',
        situation: 'You arrive at a road accident. A victim has a deep cut on the arm and blood is soaking through a cloth.',
        prompt: 'What is your FIRST action?',
        choices: [
          { id: 'a', text: 'Apply firm direct pressure on the wound', isCorrect: true, feedback: 'Correct — direct pressure controls bleeding while help is on the way.' },
          { id: 'b', text: 'Elevate the leg only', isCorrect: false, feedback: 'Elevation helps but direct pressure on the bleeding site comes first.' },
          { id: 'c', text: 'Offer water immediately', isCorrect: false, feedback: 'Fluids can wait; stopping blood loss is the priority.' },
          { id: 'd', text: 'Remove the soaked cloth to inspect', isCorrect: false, feedback: 'Removing pressure can restart heavy bleeding. Add more cloth on top.' },
        ],
        points: 30,
      },
      {
        id: 'bd-s2',
        title: 'Hospital asks for blood type',
        situation: 'A family member needs an urgent transfusion. The hospital asks if anyone knows the patient\'s blood group.',
        prompt: 'Best immediate step?',
        choices: [
          { id: 'a', text: 'Check Medical ID / health records in Arogya Raksha', isCorrect: true, feedback: 'Your Health Vault & Medical ID can save critical minutes.' },
          { id: 'b', text: 'Guess based on family history', isCorrect: false, feedback: 'Never guess — wrong blood type can be dangerous.' },
          { id: 'c', text: 'Wait for the patient to wake up', isCorrect: false, feedback: 'In emergencies, verified records or a lab cross-match are needed fast.' },
          { id: 'd', text: 'Donate your own blood on the spot without screening', isCorrect: false, feedback: 'Donations require screening, matching, and hospital protocol.' },
        ],
        points: 30,
      },
    ],
  },
  {
    id: 'heart-day',
    name: 'World Heart Day',
    emoji: '❤️',
    month: 9,
    day: 29,
    tagline: 'Recognize cardiac emergencies early',
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg,#f43f5e,#be123c)',
    quizPoints: 40,
    scenarioBonus: 30,
    quiz: [
      {
        id: 'hd1',
        question: 'Classic signs of a heart attack include:',
        options: ['Chest pain/pressure, breathlessness, arm/jaw pain', 'Itchy skin only', 'Leg cramps only', 'Blurred vision only'],
        correctIndex: 0,
        explanation: 'Chest discomfort spreading to arm, jaw, or back plus breathlessness are red flags.',
      },
      {
        id: 'hd2',
        question: 'If someone collapses with no pulse, you should:',
        options: ['Start CPR & call 108/112', 'Give them food', 'Make them run', 'Wait 30 minutes'],
        correctIndex: 0,
        explanation: 'Immediate CPR and emergency services double survival chances.',
      },
      {
        id: 'hd3',
        question: 'AED (defibrillator) pads should be placed:',
        options: ['On bare chest as shown on device', 'On clothing over the stomach', 'On the forehead', 'On the legs'],
        correctIndex: 0,
        explanation: 'Follow AED voice prompts — usually upper right chest and lower left side.',
      },
      {
        id: 'hd4',
        question: 'Nitroglycerin for chest pain should be used:',
        options: ['Only if prescribed for that person', 'By anyone nearby', 'With energy drinks', 'Instead of calling ambulance'],
        correctIndex: 0,
        explanation: 'Only the patient\'s own prescribed medication — wrong use can drop blood pressure dangerously.',
      },
      {
        id: 'hd5',
        question: 'CPR compression rate should be about:',
        options: ['100–120 per minute', '30 per minute', '200 per minute', '60 per minute'],
        correctIndex: 0,
        explanation: 'Push hard and fast in the center of the chest, 100–120/min.',
      },
    ],
    scenarios: [
      {
        id: 'hd-s1',
        title: 'Office colleague clutching chest',
        situation: 'A colleague suddenly looks pale, sweats, and says "crushing pressure" in the chest.',
        prompt: 'Your best sequence?',
        choices: [
          { id: 'a', text: 'Call 108, help them sit upright, loosen tight clothes, stay calm', isCorrect: true, feedback: 'Fast EMS activation + comfort position while waiting is key.' },
          { id: 'b', text: 'Drive them alone to a far hospital', isCorrect: false, feedback: 'Ambulance has oxygen, monitors, and can start treatment en route.' },
          { id: 'c', text: 'Tell them to walk it off', isCorrect: false, feedback: 'Exertion can worsen a cardiac event.' },
          { id: 'd', text: 'Give someone else\'s heart medicine', isCorrect: false, feedback: 'Never give unprescribed cardiac drugs.' },
        ],
        points: 30,
      },
      {
        id: 'hd-s2',
        title: 'Unconscious — no breathing',
        situation: 'After chest pain, the person collapses. Not responding. Not breathing normally.',
        prompt: 'What do you do first?',
        choices: [
          { id: 'a', text: 'Shout for help, call 108, start CPR immediately', isCorrect: true, feedback: 'CPR within the first minutes is life-saving.' },
          { id: 'b', text: 'Slap face repeatedly for 5 minutes', isCorrect: false, feedback: 'Ineffective — begin CPR and get an AED if available.' },
          { id: 'c', text: 'Put a pillow under the head and wait', isCorrect: false, feedback: 'Cardiac arrest needs compressions, not passive waiting.' },
          { id: 'd', text: 'Offer sips of water', isCorrect: false, feedback: 'Do not give anything by mouth to an unconscious person.' },
        ],
        points: 30,
      },
    ],
  },
  {
    id: 'diabetes-day',
    name: 'World Diabetes Day',
    emoji: '🩺',
    month: 11,
    day: 14,
    tagline: 'Spot sugar emergencies before they escalate',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    quizPoints: 40,
    scenarioBonus: 30,
    quiz: [
      {
        id: 'dd1',
        question: 'Signs of LOW blood sugar (hypoglycemia) include:',
        options: ['Shaking, sweating, confusion', 'Slow breathing only', 'High fever only', 'Ear pain'],
        correctIndex: 0,
        explanation: 'Shakiness, sweat, confusion, and irritability are common hypoglycemia signs.',
      },
      {
        id: 'dd2',
        question: 'If a conscious diabetic has low sugar, give:',
        options: ['Fast-acting sugar (juice, glucose)', 'Insulin immediately', 'Salt water', 'A large fatty meal only'],
        correctIndex: 0,
        explanation: '15g fast carbs, then recheck. Use glucagon/emergency help if unconscious.',
      },
      {
        id: 'dd3',
        question: 'Diabetic ketoacidosis (DKA) warning signs include:',
        options: ['Fruity breath, vomiting, deep breathing', 'Mild itch', 'Hair loss', 'Dry skin only'],
        correctIndex: 0,
        explanation: 'DKA is serious — fruity breath, nausea, abdominal pain, altered mental state.',
      },
      {
        id: 'dd4',
        question: 'Foot wounds in diabetics should be:',
        options: ['Cleaned & checked promptly — infection risk is high', 'Ignored if small', 'Treated only with home heat', 'Soaked in hot oil'],
        correctIndex: 0,
        explanation: 'Even small foot injuries can become severe in diabetes — seek care early.',
      },
      {
        id: 'dd5',
        question: 'Storing insulin generally requires:',
        options: ['Cool storage per label — often refrigerator before opening', 'Freezer for all types', 'Direct sunlight', 'Room temp always after manufacture'],
        correctIndex: 0,
        explanation: 'Follow the package insert — most unopened vials/pens need refrigeration.',
      },
    ],
    scenarios: [
      {
        id: 'dd-s1',
        title: 'Friend becomes confused at lunch',
        situation: 'Your friend with diabetes skips lunch. They start sweating, slurring words, and seem confused.',
        prompt: 'Best action?',
        choices: [
          { id: 'a', text: 'Give fast sugar if awake & swallowing, then monitor', isCorrect: true, feedback: 'Rule of 15: fast carbs, wait 15 min, recheck.' },
          { id: 'b', text: 'Inject insulin immediately', isCorrect: false, feedback: 'Insulin would dangerously lower sugar further.' },
          { id: 'c', text: 'Make them exercise to "wake up"', isCorrect: false, feedback: 'Activity burns more glucose — worsens hypoglycemia.' },
          { id: 'd', text: 'Wait an hour to see if it passes', isCorrect: false, feedback: 'Hypoglycemia can progress to seizures — act now.' },
        ],
        points: 30,
      },
      {
        id: 'dd-s2',
        title: 'Unconscious diabetic',
        situation: 'Same friend is now unresponsive. You cannot wake them. You find a glucose meter reading "LOW".',
        prompt: 'What should you do?',
        choices: [
          { id: 'a', text: 'Call 108, place in recovery position, do NOT force food/drink', isCorrect: true, feedback: 'Unconscious patients need EMS — choking risk if given oral sugar.' },
          { id: 'b', text: 'Pour juice into their mouth', isCorrect: false, feedback: 'Aspiration risk — use glucagon if trained & available, else EMS.' },
          { id: 'c', text: 'Leave them alone to sleep it off', isCorrect: false, feedback: 'Severe hypoglycemia can be fatal without treatment.' },
          { id: 'd', text: 'Give a large meal immediately', isCorrect: false, feedback: 'Only conscious, swallowing patients get oral glucose.' },
        ],
        points: 30,
      },
    ],
  },
  {
    id: 'mental-health-day',
    name: 'World Mental Health Day',
    emoji: '🧠',
    month: 10,
    day: 10,
    tagline: 'Calm support in crisis moments',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)',
    quizPoints: 40,
    scenarioBonus: 30,
    quiz: [
      {
        id: 'mh1',
        question: 'If someone mentions self-harm, you should:',
        options: ['Listen calmly, don\'t leave them alone, get professional help', 'Change the topic', 'Argue they are wrong', 'Share their message publicly'],
        correctIndex: 0,
        explanation: 'Non-judgmental listening and connecting to help (108, Kiran 1800-599-0019) saves lives.',
      },
      {
        id: 'mh2',
        question: 'During a panic attack, helpful support includes:',
        options: ['Slow breathing together, grounding, reassurance', 'Shouting at them to stop', 'Crowding many people around', 'Forcing them to run'],
        correctIndex: 0,
        explanation: 'Grounding and paced breathing reduce panic intensity.',
      },
      {
        id: 'mh3',
        question: 'India\'s Kiran Mental Health helpline number is:',
        options: ['1800-599-0019', '100', '108', '101'],
        correctIndex: 0,
        explanation: 'Kiran (1800-599-0019) is a 24×7 national mental health helpline.',
      },
      {
        id: 'mh4',
        question: 'After a traumatic accident, common reactions include:',
        options: ['Shock, numbness, anxiety — support helps recovery', 'Only physical injuries matter', 'Immediate full memory loss forever', 'No emotional impact'],
        correctIndex: 0,
        explanation: 'Psychological first aid is part of holistic emergency care.',
      },
      {
        id: 'mh5',
        question: 'You should NOT promise a person in crisis:',
        options: ['That you will keep suicidal plans completely secret', 'That help is available', 'That you care', 'That they are not alone'],
        correctIndex: 0,
        explanation: 'Safety comes first — break confidentiality if needed to prevent harm.',
      },
    ],
    scenarios: [
      {
        id: 'mh-s1',
        title: 'Panic after witnessing crash',
        situation: 'After a minor accident, a bystander hyperventilates, trembles, and says "I can\'t breathe".',
        prompt: 'Best support?',
        choices: [
          { id: 'a', text: 'Move to quiet spot, guide slow breathing, stay with them', isCorrect: true, feedback: 'Calm presence and breathing coaching stabilizes panic.' },
          { id: 'b', text: 'Tell them to "snap out of it"', isCorrect: false, feedback: 'Dismissive language increases distress.' },
          { id: 'c', text: 'Record video for social media', isCorrect: false, feedback: 'Privacy and dignity matter — focus on the person.' },
          { id: 'd', text: 'Leave them alone immediately', isCorrect: false, feedback: 'Stay nearby until breathing slows and they feel safer.' },
        ],
        points: 30,
      },
      {
        id: 'mh-s2',
        title: 'Teammate overwhelmed during SOS',
        situation: 'During an SOS response, a helper freezes and says they cannot go forward.',
        prompt: 'What do you do?',
        choices: [
          { id: 'a', text: 'Pair them with another helper, assign a calm task, check in', isCorrect: true, feedback: 'Structured support prevents burnout and keeps the team effective.' },
          { id: 'b', text: 'Force them to continue alone', isCorrect: false, feedback: 'Pressure can cause mistakes and trauma.' },
          { id: 'c', text: 'Mock them in the group chat', isCorrect: false, feedback: 'Shame reduces future willingness to help.' },
          { id: 'd', text: 'Ignore their distress entirely', isCorrect: false, feedback: 'Debrief and peer support are part of emergency readiness.' },
        ],
        points: 30,
      },
    ],
  },
  {
    id: 'first-aid-day',
    name: 'World First Aid Day',
    emoji: '🩹',
    month: 9,
    day: 13,
    tagline: 'Golden minutes start with you',
    color: '#10b981',
    gradient: 'linear-gradient(135deg,#10b981,#059669)',
    quizPoints: 40,
    scenarioBonus: 30,
    quiz: [
      {
        id: 'fa1',
        question: 'Recovery position is used when someone is:',
        options: ['Unconscious but breathing', 'In cardiac arrest', 'Fully alert', 'Has a small paper cut'],
        correctIndex: 0,
        explanation: 'Side-lying recovery position keeps the airway open for unconscious breathing patients.',
      },
      {
        id: 'fa2',
        question: 'For a suspected spinal injury, you should:',
        options: ['Minimize movement & stabilize head/neck', 'Sit them up quickly', 'Twist to check back pain', 'Pull by the arms'],
        correctIndex: 0,
        explanation: 'Only move if immediate danger (fire) — otherwise stabilize and wait for EMS.',
      },
      {
        id: 'fa3',
        question: 'Burn first aid — first step:',
        options: ['Cool running water 15–20 min', 'Apply butter/oil', 'Pop blisters', 'Ice directly on skin'],
        correctIndex: 0,
        explanation: 'Cool running water reduces depth of burn. No oils or ice directly on wound.',
      },
      {
        id: 'fa4',
        question: 'Choking adult who cannot cough/speak — do:',
        options: ['Back blows & abdominal thrusts (Heimlich)', 'Give water', 'Chest compressions only', 'Slap the back once and wait'],
        correctIndex: 0,
        explanation: 'Alternate 5 back blows and 5 abdominal thrusts for severe choking.',
      },
      {
        id: 'fa5',
        question: 'SOS countdown in Arogya Raksha lets you:',
        options: ['Cancel false alarms before dispatch', 'Skip calling ambulance always', 'Disable location sharing', 'Auto-delete your profile'],
        correctIndex: 0,
        explanation: 'The 10-second window prevents accidental emergency dispatches.',
      },
    ],
    scenarios: [
      {
        id: 'fa-s1',
        title: 'Fall on stairs — neck pain',
        situation: 'Someone falls down stairs. Awake but reports neck pain and tingling in fingers.',
        prompt: 'Your approach?',
        choices: [
          { id: 'a', text: 'Call 108, hold head steady, don\'t remove helmet if worn', isCorrect: true, feedback: 'Suspect spinal injury — minimal movement until EMS.' },
          { id: 'b', text: 'Help them stand to "walk it off"', isCorrect: false, feedback: 'Movement can worsen spinal cord damage.' },
          { id: 'c', text: 'Massage the neck hard', isCorrect: false, feedback: 'Never manipulate a suspected spine injury.' },
          { id: 'd', text: 'Drive with them bouncing in a auto-rickshaw', isCorrect: false, feedback: 'Stable ambulance transport is safer.' },
        ],
        points: 30,
      },
      {
        id: 'fa-s2',
        title: 'Kitchen burn emergency',
        situation: 'A cook spills hot oil on their forearm. Skin is red, blistering, they are in pain.',
        prompt: 'Immediate first aid?',
        choices: [
          { id: 'a', text: 'Cool under running water, remove tight jewelry, cover loosely', isCorrect: true, feedback: 'Cooling limits tissue damage; loose cover reduces infection.' },
          { id: 'b', text: 'Apply toothpaste or oil', isCorrect: false, feedback: 'Home remedies trap heat and increase infection risk.' },
          { id: 'c', text: 'Break blisters to drain fluid', isCorrect: false, feedback: 'Intact blisters protect against infection — don\'t pop them.' },
          { id: 'd', text: 'Wrap tightly with plastic wrap', isCorrect: false, feedback: 'Tight dressings restrict blood flow — use loose sterile cover.' },
        ],
        points: 30,
      },
    ],
  },
];

export function getEventById(id: string): HealthAwarenessEvent | undefined {
  return HEALTH_AWARENESS_EVENTS.find((e) => e.id === id);
}

/** Days within ±window of the awareness date (handles year wrap). */
export function isEventActive(event: HealthAwarenessEvent, now = new Date(), windowDays = 7): boolean {
  const year = now.getFullYear();
  const eventDate = new Date(year, event.month - 1, event.day);
  const diffMs = now.getTime() - eventDate.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (Math.abs(diffDays) <= windowDays) return true;
  // Check adjacent year for Dec/Jan edge cases
  const prevYearDate = new Date(year - 1, event.month - 1, event.day);
  const nextYearDate = new Date(year + 1, event.month - 1, event.day);
  const diffPrev = (now.getTime() - prevYearDate.getTime()) / (24 * 60 * 60 * 1000);
  const diffNext = (nextYearDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  return Math.abs(diffPrev) <= windowDays || Math.abs(diffNext) <= windowDays;
}

export function daysUntilEvent(event: HealthAwarenessEvent, now = new Date()): number {
  const year = now.getFullYear();
  let target = new Date(year, event.month - 1, event.day);
  if (target.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
    target = new Date(year + 1, event.month - 1, event.day);
  }
  return Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export function getActiveEvents(now = new Date()): HealthAwarenessEvent[] {
  return HEALTH_AWARENESS_EVENTS.filter((e) => isEventActive(e, now));
}

export function getFeaturedEvent(now = new Date()): HealthAwarenessEvent {
  const active = getActiveEvents(now);
  if (active.length) return active[0]!;
  return [...HEALTH_AWARENESS_EVENTS].sort(
    (a, b) => daysUntilEvent(a, now) - daysUntilEvent(b, now)
  )[0]!;
}

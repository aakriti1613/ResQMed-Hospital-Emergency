/** BCP-47 speech recognition locales for app language codes */
export const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  te: 'te-IN',
};

/**
 * Wake phrases across English, Hindi, and Telugu (native script + romanized).
 * Transcript is checked against ALL phrases so SOS works regardless of UI language.
 */
export const WAKE_PHRASES: string[] = [
  // English
  'help me',
  'medical emergency',
  'i need help',
  'need help',
  'emergency',
  'save me',
  'sos',
  // Hindi. Devanagari
  'मेरी मदद करो',
  'मदद करो',
  'मुझे मदद',
  'मदद चाहिए',
  'आपातकाल',
  'बचाओ',
  // Hindi. Romanized (browser may transcribe Hindi speech this way)
  'meri madad karo',
  'madad karo',
  'mujhe madad',
  'madad chahiye',
  'aapatakal',
  // Telugu. Telugu script
  'నాకు సహాయం',
  'సహాయం చేయండి',
  'సహాయం కావాలి',
  'అత్యవసర',
  'ఎమర్జెన్సీ',
  // Telugu. Romanized
  'naku sahayam',
  'sahayam cheyandi',
  'sahayam kavali',
  'atyavasaram',
];

export function matchesWakePhrase(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  return WAKE_PHRASES.some((phrase) => normalized.includes(phrase.toLowerCase()));
}

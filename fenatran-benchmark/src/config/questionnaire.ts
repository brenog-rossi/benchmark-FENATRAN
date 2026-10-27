// Editable content of the benchmark. Bump QUESTIONNAIRE_VERSION when features or scale change.
export const QUESTIONNAIRE_VERSION = '2026.1'

export const OTHER = 'Other'

export const SCALE = {
  min: 0,
  max: 5,
  labels: { 0: 'Very poor / not present', 5: 'Excellent' },
} as const

export const BRANDS = [
  'Volvo',
  'Mercedes-Benz',
  'Scania',
  'DAF',
  'Iveco',
  'Volkswagen',
  'Foton',
  'Sinotruk',
  'XCMG',
  'BYD',
  'JAC',
  'Sany',
  OTHER,
] as const

export type Feature = { id: string; title: string }

export const FEATURES: readonly Feature[] = [
  {
    id: 'chassis-robustness',
    title:
      'Robustness and quality of chassis solutions and mounted parts (tanks, cross members, battery box, etc.)',
  },
  {
    id: 'cable-line-installation',
    title: 'Quality of cable, pneumatic line and connector installation',
  },
  { id: 'cab-gaps-flushes', title: 'Cab quality impression: gaps and flushes between panels' },
  { id: 'suspension-installation', title: 'Suspension installation (front, rear and cab)' },
  { id: 'cab-entry-exit', title: 'Comfort getting in and out of the vehicle' },
  { id: 'cab-interior-impression', title: 'Overall impression of the cab interior' },
  { id: 'seats', title: 'Driver and passenger seats' },
  { id: 'steering-adjustments', title: 'Steering adjustments' },
  {
    id: 'interior-convenience',
    title: 'Interior convenience items (air conditioning, parking cooler, fridge, etc.)',
  },
  { id: 'bed', title: 'Bed' },
  { id: 'cab-space', title: 'Cab space and ease of movement inside' },
  { id: 'interior-storage', title: 'Interior storage space' },
  { id: 'multimedia-screen', title: 'Multimedia screen' },
]

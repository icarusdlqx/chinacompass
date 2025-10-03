export const CATEGORY_ORDER = [
  'international',
  'domestic_politics',
  'business',
  'society',
  'technology',
  'military',
  'science',
  'opinion',
  'uncategorized'
] as const

export const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  international: 'International',
  domestic_politics: 'Domestic Politics',
  business: 'Business/Economy',
  society: 'Society',
  technology: 'Technology',
  military: 'Military/Defense',
  science: 'Science/Research',
  opinion: 'Opinion/Commentary',
  uncategorized: 'Uncategorized'
}

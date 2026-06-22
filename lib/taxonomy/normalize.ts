export const ROOT_ORDER = [
  'women',
  'men',
  'accessories',
  'home',
  'fragrance',
  'gifting',
] as const

const ROOT_ALIASES: Record<string, string> = {
  'c-women': 'women',
  'c-men': 'men',
  'cat_accessories': 'accessories',
  'c-home': 'home',
  'c-fragrance': 'fragrance',
  'c-gifting': 'gifting',
  women: 'women',
  men: 'men',
  accessories: 'accessories',
  home: 'home',
  fragrance: 'fragrance',
  gifting: 'gifting',
}

export type CategoryNode = {
  id: string
  slug: string
  name: string
  level: number
  path: string | null
  parentId: string | null
  active?: boolean
  hidden?: boolean
  children?: CategoryNode[]
}

export function canonicalRootSlug(node: Pick<CategoryNode, 'id' | 'slug' | 'level'>) {
  if (node.level !== 1) return node.slug
  return ROOT_ALIASES[node.slug] || ROOT_ALIASES[node.id] || node.slug
}

export function normalizeTree(nodes: CategoryNode[]): CategoryNode[] {
  const normalized = nodes.map((node) => ({
    ...node,
    slug: node.level === 1 ? canonicalRootSlug(node) : node.slug,
    children: normalizeTree(node.children ?? []),
  }))

  return normalized.sort((a, b) => {
    if (a.level === 1 && b.level === 1) {
      return ROOT_ORDER.indexOf(a.slug as any) - ROOT_ORDER.indexOf(b.slug as any)
    }
    return a.name.localeCompare(b.name)
  })
}
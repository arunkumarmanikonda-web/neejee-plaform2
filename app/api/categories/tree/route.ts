import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeTree } from '@/lib/taxonomy/normalize'

type CatRow = {
  id: string
  slug: string
  name: string
  level: number
  path: string | null
  parentId: string | null
  active: boolean
  hidden: boolean
}

type Node = CatRow & {
  children: Node[]
  directSellableCount: number
  descendantSellableCount: number
}

function buildTree(rows: CatRow[]): Node[] {
  const map = new Map<string, Node>()

  rows.forEach((r) => {
    map.set(r.id, {
      ...r,
      children: [],
      directSellableCount: 0,
      descendantSellableCount: 0,
    })
  })

  const roots: Node[] = []

  for (const node of map.values()) {
    if (!node.parentId || !map.has(node.parentId)) {
      if (node.level === 1 || !node.parentId) { roots.push(node) }
    } else {
      map.get(node.parentId)!.children.push(node)
    }
  }

  return roots
}

function sumVisibility(node: Node): number {
  let total = node.directSellableCount
  for (const child of node.children) {
    total += sumVisibility(child)
  }
  node.descendantSellableCount = total
  return total
}

function filterPublic(nodes: Node[]): Node[] {
  function keep(node: Node): Node | null {
    if (node.level === 1) {
      if (!node.active || node.hidden) return null
      return {
        ...node,
        children: node.children.map(keep).filter(Boolean) as Node[],
      }
    }

    const visibleChildren = node.children.map(keep).filter(Boolean) as Node[]
    const branchSellable = node.directSellableCount > 0 || visibleChildren.length > 0

    if (!node.active || node.hidden || !branchSellable) return null

    return {
      ...node,
      children: visibleChildren,
    }
  }

  return nodes.map(keep).filter(Boolean) as Node[]
}

function filterPreview(nodes: Node[]): Node[] {
  const keep = (node: Node): Node | null => {
    if (!node.active || node.hidden) return null

    const previewChildren = node.children.map(keep).filter(Boolean) as Node[]

    return {
      ...node,
      children: previewChildren,
    }
  }

  return nodes.map(keep).filter(Boolean) as Node[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('visible')
  const visibleOnly = mode === 'true'
  const previewVisible = mode === 'preview'

  const categories = await prisma.category.findMany({
    where: {
      active: true,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      level: true,
      path: true,
      parentId: true,
      active: true,
      hidden: true,
    },
  })

  const sellableProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      variants: {
        some: {
          inventory: {
            gt: 0,
          },
        },
      },
    },
    select: {
      categoryId: true,
    },
  })

  const categorySellableCounts = new Map<string, number>()
  for (const row of sellableProducts) {
    if (!row.categoryId) continue
    categorySellableCounts.set(
      row.categoryId,
      (categorySellableCounts.get(row.categoryId) ?? 0) + 1
    )
  }

  const tree = buildTree(categories as CatRow[])

  const assignCounts = (nodes: Node[]) => {
    for (const node of nodes) {
      node.directSellableCount = categorySellableCounts.get(node.id) ?? 0
      assignCounts(node.children)
      sumVisibility(node)
    }
  }

  assignCounts(tree)

  const fullTree = normalizeTree(tree as any)
  const output = visibleOnly
    ? normalizeTree(filterPublic(fullTree as any) as any)
    : previewVisible
      ? normalizeTree(filterPreview(fullTree as any) as any)
      : fullTree

  return NextResponse.json(output)
}

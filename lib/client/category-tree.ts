'use client';

type CategoryTreeNode = {
  id: string;
  slug: string;
  name: string;
  level: number;
  path: string | null;
  parentId?: string | null;
  active?: boolean;
  hidden?: boolean;
  children?: CategoryTreeNode[];
  [key: string]: unknown;
};

let publicTreePromise: Promise<CategoryTreeNode[]> | null = null;

function normalizeTreePayload(data: unknown): CategoryTreeNode[] {
  if (Array.isArray(data)) return data as CategoryTreeNode[];
  if (data && typeof data === 'object') {
    const tree = (data as { tree?: unknown }).tree;
    if (Array.isArray(tree)) return tree as CategoryTreeNode[];
  }
  return [];
}

async function loadTree(preview: boolean): Promise<CategoryTreeNode[]> {
  const url = preview
    ? `/api/categories/tree?visible=preview&cb=${Date.now()}`
    : '/api/categories/tree?visible=true';
  const res = await fetch(url, preview ? { cache: 'no-store' } : undefined);
  if (!res.ok) return [];
  return normalizeTreePayload(await res.json());
}

export function getCategoryTree(preview = false): Promise<CategoryTreeNode[]> {
  if (preview) return loadTree(true);
  if (!publicTreePromise) {
    publicTreePromise = loadTree(false).catch((error) => {
      publicTreePromise = null;
      throw error;
    });
  }
  return publicTreePromise;
}

export type { CategoryTreeNode };

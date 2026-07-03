export type CategoryNodeInput = {
  id: string;
  slug: string;
  name: string;
  path?: string | null;
  level?: number | null;
  parentId?: string | null;
  parent?: CategoryNodeInput | null;
};

export type ProductHierarchySource = {
  category?: CategoryNodeInput | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  categoryPath?: string | null;
  categoryLevel?: number | null;
};

export type ProductReadCategoryNode = {
  id: string;
  name: string;
  slug: string;
  path: string;
  level: number;
  parentId: string | null;
};

export type ProductReadHierarchy = {
  lineage: ProductReadCategoryNode[];
  breadcrumb: string[];
  breadcrumbSlugs: string[];
  path: string | null;
  depth: number;
  mainCategory: ProductReadCategoryNode | null;
  subCategory: ProductReadCategoryNode | null;
  subSubCategory: ProductReadCategoryNode | null;
  leafCategory: ProductReadCategoryNode | null;
};

function cleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function cleanLevel(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeCategoryNode(
  node: CategoryNodeInput
): ProductReadCategoryNode {
  const slug = cleanString(node.slug) ?? '';
  const path = cleanString(node.path) ?? slug;

  return {
    id: cleanString(node.id) ?? slug,
    name: cleanString(node.name) ?? slug,
    slug,
    path,
    level: cleanLevel(node.level, 0),
    parentId: cleanString(node.parentId),
  };
}

export function flattenCategoryLineage(
  category: CategoryNodeInput | null | undefined
): ProductReadCategoryNode[] {
  if (!category) return [];

  const lineage: ProductReadCategoryNode[] = [];
  let cursor: CategoryNodeInput | null | undefined = category;
  const seen = new Set<string>();

  while (cursor) {
    const normalized = normalizeCategoryNode(cursor);
    const key = normalized.id || normalized.slug;

    if (key && !seen.has(key)) {
      lineage.push(normalized);
      seen.add(key);
    }

    cursor = cursor.parent;
  }

  return lineage.reverse();
}

function lineageFromPath(
  source: ProductHierarchySource
): ProductReadCategoryNode[] {
  const rawPath = cleanString(source.categoryPath);
  if (!rawPath) return [];

  const segments = rawPath
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!segments.length) return [];

  return segments.map((slug, index) => {
    const path = segments.slice(0, index + 1).join('/');
    const isLeaf = index === segments.length - 1;

    return {
      id: isLeaf ? cleanString(source.categoryId) ?? slug : slug,
      slug,
      name: isLeaf ? cleanString(source.categoryName) ?? slug : slug,
      path,
      level: index + 1,
      parentId: index > 0 ? segments[index - 1] : null,
    };
  });
}

function dedupeLineage(
  nodes: ProductReadCategoryNode[]
): ProductReadCategoryNode[] {
  const byId = new Set<string>();
  const bySlug = new Set<string>();
  const result: ProductReadCategoryNode[] = [];

  for (const node of nodes) {
    const idKey = cleanString(node.id);
    const slugKey = cleanString(node.slug);

    if (idKey && byId.has(idKey)) continue;
    if (slugKey && bySlug.has(slugKey)) continue;

    if (idKey) byId.add(idKey);
    if (slugKey) bySlug.add(slugKey);

    result.push(node);
  }

  return result;
}

export function buildHierarchy(
  source: ProductHierarchySource
): ProductReadHierarchy {
  const nestedLineage = flattenCategoryLineage(source.category);
  const fallbackLineage = lineageFromPath(source);

  const lineage = dedupeLineage(
    nestedLineage.length > 0 ? nestedLineage : fallbackLineage
  );

  const breadcrumb = lineage.map((node) => node.name);
  const breadcrumbSlugs = lineage.map((node) => node.slug);
  const leafCategory = lineage.length ? lineage[lineage.length - 1] : null;

  return {
    lineage,
    breadcrumb,
    breadcrumbSlugs,
    path: leafCategory?.path ?? cleanString(source.categoryPath),
    depth: lineage.length,
    mainCategory: lineage[0] ?? null,
    subCategory: lineage[1] ?? null,
    subSubCategory: lineage[2] ?? null,
    leafCategory,
  };
}

export function buildCategoryBreadcrumbs(
  hierarchy: ProductReadHierarchy
): Array<{ name: string; href: string }> {
  return hierarchy.lineage.map((node) => ({
    name: node.name,
    href: `/categories/${node.path || node.slug}`,
  }));
}

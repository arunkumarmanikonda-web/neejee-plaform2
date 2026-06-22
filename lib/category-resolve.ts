// Flexible category resolution — given a URL slug, return Prisma where-clause matching products.
// Handles: full path, exact category slug, craft-as-category, name-fuzzy fallback.
// v26.3c — removed DEPARTMENT_KEYWORDS keyword-soup fallback. It pre-empted the proper
//          category-slug match for L1 slugs like 'home', causing products whose name didn't
//          contain hard-coded keywords (e.g. 'Ottoman Mosaic Lantern' missing the word 'lamp')
//          to be excluded. Taxonomy is now authoritative — slug → Category lookup is enough.
import { prisma } from './prisma';

export async function resolveCategoryWhere(slug: string): Promise<{
  where: any;
  matchedCategory: { id: string; slug: string; name: string; level?: number; path?: string | null; gender?: string | null } | null;
  matchMode: 'slug' | 'craft' | 'name-fuzzy' | 'path' | 'all';
  descendantIds?: string[];
}> {
  if (!slug || slug === 'all') {
    return { where: { status: 'ACTIVE' }, matchedCategory: null, matchMode: 'all' };
  }

  // If slug contains slashes, treat it as a full path (e.g. 'women/sarees/banarasi')
  // Resolve to the category by its 'path' field, then include all descendant categories.
  if (slug.includes('/')) {
    const cleanPath = slug.replace(/^\/+|\/+$/g, '');
    const cat = await prisma.category.findFirst({
      where: { path: cleanPath, active: true },
      select: { id: true, slug: true, name: true, level: true, path: true, gender: true },
    });
    if (cat) {
      const descendants = await prisma.category.findMany({
        where: { path: { startsWith: cleanPath + '/' }, active: true },
        select: { id: true },
      });
      const allIds = [cat.id, ...descendants.map(d => d.id)];
      return {
        where: { status: 'ACTIVE', categoryId: { in: allIds } },
        matchedCategory: cat,
        matchMode: 'path',
        descendantIds: allIds,
      };
    }
    // Path didn't match — fall through to legacy slug resolution using the last segment
    const lastSegment = cleanPath.split('/').pop() || cleanPath;
    return resolveCategoryWhere(lastSegment);
  }

  // 1. Exact slug match on Category (covers L1/L2/L3). Include descendants via path prefix.
  const cat = await prisma.category.findFirst({
    where: { slug: { equals: slug, mode: 'insensitive' } },
    select: { id: true, slug: true, name: true, level: true, path: true, gender: true },
  });
  if (cat) {
    let allIds = [cat.id];
    if (cat.path) {
      const descendants = await prisma.category.findMany({
        where: { path: { startsWith: cat.path + '/' }, active: true },
        select: { id: true },
      });
      allIds = [cat.id, ...descendants.map(d => d.id)];
    }
    return {
      where: { status: 'ACTIVE', categoryId: { in: allIds } },
      matchedCategory: cat,
      matchMode: 'slug',
      descendantIds: allIds,
    };
  }

  // 2. Treat slug as craft (e.g. 'banarasi', 'phulkari')
  const craftMatch = await prisma.product.findFirst({
    where: { status: 'ACTIVE', craft: { equals: slug, mode: 'insensitive' } },
    select: { id: true },
  });
  if (craftMatch) {
    return {
      where: { status: 'ACTIVE', craft: { equals: slug, mode: 'insensitive' } },
      matchedCategory: { id: '', slug, name: slug.charAt(0).toUpperCase() + slug.slice(1) },
      matchMode: 'craft',
    };
  }

  // 3. Fuzzy match on category name (e.g. 'sarees' → match category 'Saree')
  const fuzzy = slug.replace(/s$/, ''); // strip trailing 's' (plural)
  const fuzzyCat = await prisma.category.findFirst({
    where: { name: { contains: fuzzy, mode: 'insensitive' } },
    select: { id: true, slug: true, name: true },
  });
  if (fuzzyCat) {
    return {
      where: { status: 'ACTIVE', categoryId: fuzzyCat.id },
      matchedCategory: fuzzyCat,
      matchMode: 'name-fuzzy',
    };
  }

  // 4. Last resort: match products whose name/craft/material contains the term
  return {
    where: {
      status: 'ACTIVE',
      OR: [
        { craft: { contains: fuzzy, mode: 'insensitive' } },
        { name: { contains: fuzzy, mode: 'insensitive' } },
        { material: { contains: fuzzy, mode: 'insensitive' } },
        { category: { name: { contains: fuzzy, mode: 'insensitive' } } },
      ],
    },
    matchedCategory: { id: '', slug, name: slug.charAt(0).toUpperCase() + slug.slice(1) },
    matchMode: 'name-fuzzy',
  };
}
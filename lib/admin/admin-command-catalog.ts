import type { FinancePermission } from '@/lib/finance/roles';

export type AdminCommandItem = {
  href: string;
  label: string;
  group: string;
  desc: string;
  keywords: string[];
  aliases?: string[];
  financePerm?: FinancePermission;
  boost?: number;
};

export const ADMIN_COMMAND_ITEMS: AdminCommandItem[] = [
  { href: '/admin', label: 'Overview', group: 'Operations', desc: 'Admin landing page and safe-mode dashboard.', keywords: ['dashboard', 'overview', 'home', 'admin'] },
  { href: '/admin/orders', label: 'Orders', group: 'Operations', desc: 'Review recent orders and fulfillment activity.', keywords: ['orders', 'fulfillment', 'shipping'] },
  { href: '/admin/disputes', label: 'Disputes', group: 'Operations', desc: 'Review dispute cases and interventions.', keywords: ['disputes', 'claims', 'cases'] },
  { href: '/admin/customers', label: 'Customers', group: 'Operations', desc: 'Search customers and account activity.', keywords: ['customers', 'accounts', 'users'] },
  { href: '/admin/customers/segments', label: 'Segments', group: 'Operations', desc: 'Audience segmentation and lifecycle targeting.', keywords: ['segments', 'cohorts', 'audience'] },
  { href: '/admin/reviews', label: 'Reviews', group: 'Operations', desc: 'Moderate product and customer reviews.', keywords: ['reviews', 'ratings', 'ugc'] },

  { href: '/admin/analytics', label: 'Analytics', group: 'Growth', desc: 'Reporting and performance pages.', keywords: ['analytics', 'reports', 'metrics', 'kpi'] },
  { href: '/admin/forecast', label: 'Demand Forecast', group: 'Growth', desc: 'Demand forecast workspace.', keywords: ['forecast', 'demand', 'prediction'] },
  { href: '/admin/loyalty', label: "Founder's Circle", group: 'Growth', desc: 'Loyalty configuration and activity.', keywords: ['loyalty', 'members', 'rewards'] },
  { href: '/admin/campaigns', label: 'Campaigns', group: 'Growth', desc: 'Campaign planning and control.', keywords: ['campaigns', 'marketing', 'growth'] },
  { href: '/admin/marketing', label: 'Email Broadcasts', group: 'Growth', desc: 'Email broadcast and messaging workflows.', keywords: ['email', 'broadcasts', 'newsletter'] },
  { href: '/admin/abandoned', label: 'Abandoned Carts', group: 'Growth', desc: 'Recovery flows and abandoned-cart monitoring.', keywords: ['abandoned', 'carts', 'recovery'] },
  { href: '/admin/marketing-studio', label: 'Marketing Studio', group: 'Growth', desc: 'Creative drafting and campaign production.', keywords: ['studio', 'creative', 'assets'] },
    { href: '/admin/integrations/meta', label: 'Meta Accounts', group: 'Growth', desc: 'Facebook Pages and Instagram business account linking, readiness, and connection health.', keywords: ['meta', 'facebook', 'instagram', 'business manager', 'pages', 'social accounts'], aliases: ['facebook accounts', 'instagram accounts', 'meta integration'], boost: 2 },
{ href: '/admin/marketing-approvals', label: 'Marketing Approvals', group: 'Growth', desc: 'Approval queue for marketing outputs.', keywords: ['approvals', 'marketing', 'review'] },

  { href: '/admin/products', label: 'Products', group: 'Catalog', desc: 'Product CRUD, pricing, media, and edits.', keywords: ['products', 'catalog', 'sku', 'pricing'] },
  { href: '/admin/catalogues', label: 'Catalogues', group: 'Catalog', desc: 'Catalogue generation and exports.', keywords: ['catalogues', 'catalogs', 'exports', 'pdf'] },
  { href: '/admin/merchandising', label: 'Merchandising', group: 'Catalog', desc: 'Curated launch and catalogue merchandising.', keywords: ['merchandising', 'launches', 'curation'] },
  { href: '/admin/categories', label: 'Categories', group: 'Catalog', desc: 'Taxonomy and storefront categories.', keywords: ['categories', 'taxonomy', 'navigation'] },
  { href: '/admin/crafts', label: 'Crafts', group: 'Catalog', desc: 'Craft definitions and editorial organization.', keywords: ['crafts', 'heritage', 'taxonomy'] },
  { href: '/admin/ai-photo-studio', label: 'AI Photo Studio', group: 'Catalog', desc: 'AI-assisted catalogue media workflows.', keywords: ['photo', 'studio', 'images', 'ai'] },
  { href: '/admin/ai-photo-requests', label: 'Vendor Photo Queue', group: 'Catalog', desc: 'Vendor media intake and requests.', keywords: ['photo queue', 'vendor photos', 'media requests'] },
  { href: '/admin/inventory', label: 'Inventory', group: 'Catalog', desc: 'Inventory visibility and stock admin.', keywords: ['inventory', 'stock', 'warehouse'] },
  { href: '/admin/drops', label: 'Drops', group: 'Catalog', desc: 'Drop planning and merchandising windows.', keywords: ['drops', 'launch', 'release'] },
  { href: '/admin/waitlist', label: 'Waitlist', group: 'Catalog', desc: 'Waitlist and demand-intent monitoring.', keywords: ['waitlist', 'back in stock', 'lead'] },
  { href: '/admin/coupons', label: 'Coupons', group: 'Catalog', desc: 'Coupon setup and campaign incentives.', keywords: ['coupons', 'offers', 'discounts'] },

  { href: '/admin/sellers', label: 'Sellers', group: 'Marketplace', desc: 'Seller records, review, and controls.', keywords: ['sellers', 'marketplace', 'vendors'] },
  { href: '/admin/agreements', label: 'Agreements', group: 'Marketplace', desc: 'Agreement records and review.', keywords: ['agreements', 'contracts', 'signing'] },
  { href: '/admin/legal-signatories', label: 'Legal Signatories', group: 'Marketplace', desc: 'Company signatories and legal setup.', keywords: ['legal signatories', 'signers', 'legal'] },
  { href: '/admin/seller-onboarding', label: 'Seller Onboarding', group: 'Marketplace', desc: 'Onboarding and verification workspace.', keywords: ['seller onboarding', 'kyc', 'activation'] },
  { href: '/admin/seller-inventory', label: 'Seller Inventory Queue', group: 'Marketplace', desc: 'Seller inventory intake queue.', keywords: ['seller inventory', 'queue', 'submissions'] },
  { href: '/admin/seller-change-requests', label: 'Seller Changes', group: 'Marketplace', desc: 'Seller change request review.', keywords: ['seller changes', 'change requests', 'review'] },
  { href: '/admin/vendors', label: 'Vendors', group: 'Marketplace', desc: 'Vendor records and controls.', keywords: ['vendors', 'purchase', 'supplier'] },
  { href: '/admin/vendor-change-requests', label: 'Vendor Changes', group: 'Marketplace', desc: 'Vendor change request queue.', keywords: ['vendor changes', 'approvals'] },
  { href: '/admin/purchase-orders', label: 'Purchase Orders', group: 'Marketplace', desc: 'PO flows and supplier handling.', keywords: ['purchase orders', 'po', 'procurement'] },

  { href: '/admin/erp', label: 'ERP Home', group: 'ERP', desc: 'ERP control panel and navigation root.', keywords: ['erp', 'integration', 'sync'] },
  { href: '/admin/erp/dashboard', label: 'Sync Dashboard', group: 'ERP', desc: 'ERP sync overview.', keywords: ['sync dashboard', 'erp dashboard'] },
  { href: '/admin/erp/failures', label: 'Failure Queue', group: 'ERP', desc: 'ERP dead-letter and failure handling.', keywords: ['failures', 'queue', 'dead letter'] },
  { href: '/admin/erp/reconciliation', label: 'Reconciliation', group: 'ERP', desc: 'ERP reconciliation workflow.', keywords: ['reconciliation', 'erp'], aliases: ['erp recon'] },

  { href: '/admin/finance/pnl', label: 'P&L', group: 'Finance', desc: 'Profit and loss reporting.', keywords: ['pnl', 'profit', 'loss', 'finance'], aliases: ['profit and loss'], financePerm: 'finance.read', boost: 3 },
  { href: '/admin/finance/expenses', label: 'Expenses', group: 'Finance', desc: 'Expense records and approvals.', keywords: ['expenses', 'spend', 'costs'], aliases: ['expense ledger'], financePerm: 'finance.read' },
  { href: '/admin/finance/trial-balance', label: 'Trial Balance', group: 'Finance', desc: 'Trial balance reporting.', keywords: ['trial balance', 'ledger', 'accounts'], aliases: ['tb'], financePerm: 'finance.read' },
  { href: '/admin/finance/bank-reconciliation', label: 'Bank Reconciliation', group: 'Finance', desc: 'Match bank transactions and ledger entries.', keywords: ['bank reconciliation', 'reco', 'bank'], aliases: ['bank reco'], financePerm: 'finance.read' },
  { href: '/admin/finance/seller-payouts', label: 'Seller Payouts', group: 'Finance', desc: 'Seller payout review and processing.', keywords: ['seller payouts', 'settlements', 'seller finance'], aliases: ['seller settlements'], financePerm: 'finance.read' },
  { href: '/admin/finance/vendor-payouts', label: 'Vendor Payouts', group: 'Finance', desc: 'Vendor payout review and processing.', keywords: ['vendor payouts', 'vendor settlements'], aliases: ['vendor settlements'], financePerm: 'finance.read' },

  { href: '/admin/cms', label: 'CMS Pages', group: 'Content', desc: 'CMS page management.', keywords: ['cms', 'pages', 'content'] },
  { href: '/admin/seo', label: 'SEO Control Plane', group: 'Content', desc: 'Default metadata, social preview, canonical, and robots controls.', keywords: ['seo', 'metadata', 'open graph', 'twitter', 'canonical', 'robots'], aliases: ['seo settings', 'metadata settings', 'open graph'], boost: 2 },
  { href: '/admin/taxonomy', label: 'Taxonomy', group: 'Content', desc: 'Taxonomy management tools.', keywords: ['taxonomy', 'content', 'hierarchy'] },
    { href: '/admin/taxonomy/ai', label: 'Taxonomy AI Planner', group: 'Content', desc: 'AI-assisted taxonomy planning and suggested parent/category generation.', keywords: ['taxonomy ai', 'category planner', 'category ai', 'taxonomy planner'], aliases: ['ai taxonomy', 'category planning'], boost: 2 },
{ href: '/admin/journal', label: 'Journal (auto)', group: 'Content', desc: 'Journal automation workspace.', keywords: ['journal', 'editorial', 'content'] },
  { href: '/admin/banners', label: 'Banners', group: 'Content', desc: 'Banner asset management.', keywords: ['banners', 'hero', 'creative'] },
  { href: '/admin/badges', label: 'Seals & Badges', group: 'Content', desc: 'Badge asset management.', keywords: ['badges', 'seals', 'labels'] },
  { href: '/admin/assets', label: 'Asset Library', group: 'Content', desc: 'Asset library and media browsing.', keywords: ['assets', 'media', 'library'] },
  { href: '/admin/ai', label: 'AI Manager', group: 'Content', desc: 'AI management and utility pages.', keywords: ['ai manager', 'prompts', 'tools'] },

  { href: '/admin/team', label: 'Team & Roles', group: 'Admin', desc: 'Role and team administration.', keywords: ['team', 'roles', 'permissions'] },
  { href: '/admin/legal-entity', label: 'Legal Entity', group: 'Admin', desc: 'Legal entity setup and company metadata.', keywords: ['legal entity', 'company details'] },
  { href: '/admin/notifications', label: 'Notification Logs', group: 'Admin', desc: 'Notification log review.', keywords: ['notifications', 'logs', 'messages'] },
  { href: '/admin/settings/sms', label: 'SMS & OTP', group: 'Admin', desc: 'SMS, OTP, sender, and template controls.', keywords: ['sms', 'otp', 'fast2sms', 'templates'] },
  { href: '/admin/profile', label: 'My Profile', group: 'Admin', desc: 'Current admin profile settings.', keywords: ['profile', 'my account'] },
  { href: '/admin/settings', label: 'Settings', group: 'Admin', desc: 'Core admin settings and configuration.', keywords: ['settings', 'config', 'preferences'] },
];

export const ADMIN_FEATURED_HREFS = [
  '/admin/products',
  '/admin/orders',
  '/admin/customers',
  '/admin/categories',
  '/admin/analytics',
  '/admin/seo',
  '/admin/erp',
  '/admin/sellers',
];
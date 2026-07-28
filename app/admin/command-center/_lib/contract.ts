export type SearchEntityKind =
  | 'command'
  | 'page'
  | 'seller'
  | 'user'
  | 'order'
  | 'catalog'
  | 'ticket'
  | 'seo'
  | 'setting'
  | 'kyc';

export type CommandActionId =
  | 'open'
  | 'edit'
  | 'review'
  | 'approve'
  | 'reject'
  | 'verify'
  | 'copy-link';

export type CommandAction = {
  id: CommandActionId;
  label: string;
  href?: string;
};

export type CommandCenterResult = {
  id: string;
  kind: SearchEntityKind;
  title: string;
  subtitle: string;
  href: string;
  actions: CommandAction[];
  score?: number;
  matchedFields?: string[];
  reason?: string;
};

export type CommandCenterGroupedResults = Partial<
  Record<SearchEntityKind, CommandCenterResult[]>
>;

export type CommandCenterSearchResponse = {
  query: string;
  total: number;
  grouped: CommandCenterGroupedResults;
  results: CommandCenterResult[];
};

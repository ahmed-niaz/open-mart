export type ActivityType = 'order' | 'payment' | 'admin_audit';

export interface ActivityFeedItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface RecentActivityResult {
  items: ActivityFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

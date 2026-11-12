export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  MEDIA_CLEANUP: 'media-cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const FORCE_WORKERS_ENABLED = Symbol('FORCE_WORKERS_ENABLED');

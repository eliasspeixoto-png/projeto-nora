export type NotificationPriority = 'high' | 'normal';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  image?: string;
  tag?: string;
  renotify?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface SendToUserParams extends PushNotificationPayload {
  userId: string;
}

export interface SendToRoleParams extends PushNotificationPayload {
  role: 'admin' | 'tecnico' | 'vendedor' | 'distribuidor';
  companyId: string;
}

export interface NotificationRead {
    id: string;
    title?: string;
    message?: string;
    content?: string;
    type?: 'order' | 'stock' | 'system' | string;
    is_read?: boolean;
    read?: boolean;
    data?: any;
    created_at?: string;
    updated_at?: string;
    time?: Date;
}

export interface UnreadCountResponse {
    unread_count?: number;
    count?: number;
    [key: string]: any;
}

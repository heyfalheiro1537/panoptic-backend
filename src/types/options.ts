export interface BillableOptions {
    apiKey?: string;
    project?: string;
    username: string;  // Required - used for MongoDB collection routing
    env?: 'production' | 'development' | 'staging';
    autoConnect?: boolean;
}

export interface SDKConfig {
    /** Project identifier */
    project?: string;
    /** Environment (defaults to NODE_ENV or 'development') */
    env?: 'production' | 'development' | 'staging';
}

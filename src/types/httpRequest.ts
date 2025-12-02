export interface HttpRequest {
    headers: Record<string, string | undefined>;
    method?: string;
    path?: string;
    ip?: string;
    user?: {
        id?: string;
        organizationId?: string;
    };
}
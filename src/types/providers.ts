export enum ProvidersType {
    INFRA = 'infrastructure',
    AI = 'artificial intelligence',

}

export enum Providers {
    OPENAI = 'OpenAI',
    AWS = 'Amazon Web Services (AWS)',
    GOOGLE = 'Google Cloud (GCP)',
    MONGODB = 'MongoDB Atlas',
    USER_DEFINED = "Custom"
}

export enum AwsServices {
    EC2 = "EC2",
    S3 = "S3",
    LAMBDA = "Lambda",
    RDS = "RDS",
    DYNAMODB = "DynamoDB",
    CLOUDFRONT = "CloudFront",
    EKS = "EKS",
    ECS = "ECS",
    SNS = "SNS",
    SQS = "SQS",
    ATHENA = "Athena",
}


export enum GoogleServices {
    COMPUTE_ENGINE = "Compute Engine",
    CLOUD_STORAGE = "Cloud Storage",
    BIGQUERY = "BigQuery",
    CLOUD_FUNCTIONS = "Cloud Functions",
    CLOUD_RUN = "Cloud Run",
    PUBSUB = "Pub/Sub",
    FIRESTORE = "Firestore",
    SPANNER = "Cloud Spanner",
}


export enum MongoServices {
    ATLAS = "Atlas Cluster",
    DATA_FEDERATION = "Data Federation",
    CHARTS = "Charts",
    ATLAS_SEARCH = "Atlas Search",
    ATLAS_STREAMS = "Atlas Streams",
}


export enum OpenAIServices {
    GPT4 = "GPT-4",
    GPT4o = "GPT-4o",
    GPT4oMini = "GPT-4o-mini",
    EMBEDDINGS = "Embeddings",
    TTS = "Text-to-Speech",
    WHISPER = "Whisper",
    REASONING = "Reasoning Models",
}

export enum Undefined {

}

export interface ProviderServicesMap {
    [Providers.AWS]: AwsServices;
    [Providers.GOOGLE]: GoogleServices;
    [Providers.MONGODB]: MongoServices;
    [Providers.OPENAI]: OpenAIServices;
    [Providers.USER_DEFINED]: any;
}
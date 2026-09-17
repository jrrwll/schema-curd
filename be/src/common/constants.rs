pub const DEFAULT_LISTEN_PORT: u16 = 8000;
pub const DEFAULT_DATABASE_URL: &str = "sqlite://schema.sqlite";
pub const DEFAULT_LOG_FILTER: &str = "schema_curd=info,sqlx::query=info";

pub const ACCESS_TOKEN_TTL_SECONDS: i64 = 10 * 60;
pub const REFRESH_TOKEN_TTL_SECONDS: u64 = 7 * 24 * 60 * 60;
pub const MIN_JWT_SECRET_LENGTH: u64 = 16;
pub const MAX_REFRESH_TOKEN_LENGTH: u64 = 512;
pub const MAX_REQUEST_BODY_BYTES: usize = 2 * 1024 * 1024;

pub const MAX_PAGE_SIZE: u32 = 500;
pub const MAX_PAGE_NO: u32 = 10000;

pub const DEFAULT_PAGE_NO: u32 = 1;
pub const DEFAULT_PAGE_SIZE: u32 = 20;
pub const MAX_GRANT_LIST_COUNT: u32 = 100;
pub const MAX_DISCOVERY_LIST_COUNT: u32 = 500;

pub const MAX_TABLES_PER_DATASOURCE: i64 = 1_000;

pub const NAME_MAX_LENGTH: usize = 100;
pub const DISPLAY_NAME_MAX_LENGTH: usize = 30;
pub const PASSWORD_MIN_LENGTH: usize = 8;
pub const PASSWORD_MAX_LENGTH: usize = 256;

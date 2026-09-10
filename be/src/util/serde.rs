use corers::axum::ApiError;
use serde::{Serialize, de::DeserializeOwned};

pub fn serialize_config<T: ?Sized + Serialize>(config: &T) -> Result<String, ApiError> {
    serde_json::to_string(config).map_err(ApiError::unknown)
}

pub fn deserialize_config<T: DeserializeOwned + Default>(config: Option<String>) -> Result<T, ApiError> {
    let Some(config) = config else {
        return Ok(T::default());
    };
    serde_json::from_str(&config).map_err(ApiError::unknown)
}

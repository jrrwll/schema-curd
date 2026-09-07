use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuListResult {
    pub name: String,
    pub display_name: String,
    pub tables: Vec<MenuTableResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuTableResult {
    pub name: String,
    pub display_name: String,
}

#[cfg(feature = "mysql")]
pub use mysql::*;
#[cfg(feature = "mysql")]
mod mysql;

#[cfg(feature = "sqlite")]
pub use sqlite::*;
#[cfg(feature = "sqlite")]
mod sqlite;

#[cfg(not(any(
    feature = "sqlite",
    feature = "mysql",
)))]
compile_error!("one system database feature must be enabled");

#[cfg(all(
    feature = "sqlite",
    feature = "mysql",
))]
compile_error!("only one system database feature can be enabled");

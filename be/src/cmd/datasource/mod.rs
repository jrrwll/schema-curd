pub use backup::*;
pub use restore::*;

mod backup;
mod restore;

use rexl::argparse::{ArgParserRunnable, FromArgs};
use serde::Serialize;

#[derive(Debug, Serialize, FromArgs)]
pub struct DatasourceCli {
    pub help: bool,
}

impl ArgParserRunnable for DatasourceCli {
    fn run(self) {
        println!("{:?}", self);
    }
}

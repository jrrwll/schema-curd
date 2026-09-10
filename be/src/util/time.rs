use std::collections::HashSet;
use std::fmt::Display;
use std::hash::Hash;

use chrono::NaiveDateTime;

pub fn format_datetime(dt: NaiveDateTime) -> String {
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn vec_diff<T: Hash + Eq>(a: Vec<T>, b: Vec<T>) -> Vec<T> {
    let b_set: HashSet<_> = b.into_iter().collect();
    a.into_iter().filter(|item| !b_set.contains(item)).collect()
}

pub fn vec_diff_ref<'a, T: Hash + Eq>(a: &'a [T], b: &[T]) -> Vec<&'a T> {
    let b_set: HashSet<_> = b.iter().collect();
    a.iter().filter(|item| !b_set.contains(item)).collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Either<L, R> {
    Left(L),
    Right(R),
}

impl<L, R> Either<L, R> {
    pub fn is_left(&self) -> bool {
        matches!(self, Either::Left(_))
    }

    pub fn is_right(&self) -> bool {
        matches!(self, Either::Right(_))
    }

    pub fn left(&self) -> Option<&L> {
        match self {
            Either::Left(l) => Some(l),
            Either::Right(_) => None,
        }
    }

    pub fn right(&self) -> Option<&R> {
        match self {
            Either::Right(r) => Some(r),
            Either::Left(_) => None,
        }
    }

    pub fn map_left<F, U>(self, f: F) -> Either<U, R>
    where F: FnOnce(L) -> U {
        match self {
            Either::Left(l) => Either::Left(f(l)),
            Either::Right(r) => Either::Right(r),
        }
    }

    pub fn map_right<F, U>(self, f: F) -> Either<L, U>
    where F: FnOnce(R) -> U {
        match self {
            Either::Left(l) => Either::Left(l),
            Either::Right(r) => Either::Right(f(r)),
        }
    }

    pub fn map<F, G, U, V>(self, f: F, g: G) -> Either<U, V>
    where
        F: FnOnce(L) -> U,
        G: FnOnce(R) -> V, {
        match self {
            Either::Left(l) => Either::Left(f(l)),
            Either::Right(r) => Either::Right(g(r)),
        }
    }

    pub fn either<F, G, T>(self, left_fn: F, right_fn: G) -> T
    where
        F: FnOnce(L) -> T,
        G: FnOnce(R) -> T, {
        match self {
            Either::Left(l) => left_fn(l),
            Either::Right(r) => right_fn(r),
        }
    }

    pub fn left_or(self, default: L) -> L {
        match self {
            Either::Left(l) => l,
            Either::Right(_) => default,
        }
    }

    pub fn right_or(self, default: R) -> R {
        match self {
            Either::Right(r) => r,
            Either::Left(_) => default,
        }
    }

    pub fn left_or_else<F>(self, f: F) -> L
    where F: FnOnce(R) -> L {
        match self {
            Either::Left(l) => l,
            Either::Right(r) => f(r),
        }
    }

    pub fn right_or_else<F>(self, f: F) -> R
    where F: FnOnce(L) -> R {
        match self {
            Either::Right(r) => r,
            Either::Left(l) => f(l),
        }
    }

    pub fn flip(self) -> Either<R, L> {
        match self {
            Either::Left(l) => Either::Right(l),
            Either::Right(r) => Either::Left(r),
        }
    }
}

impl<L, R> Either<L, R>
where L: Default
{
    pub fn left_or_default(self) -> L {
        match self {
            Either::Left(l) => l,
            Either::Right(_) => L::default(),
        }
    }
}

impl<L, R> Either<L, R>
where R: Default
{
    pub fn right_or_default(self) -> R {
        match self {
            Either::Right(r) => r,
            Either::Left(_) => R::default(),
        }
    }
}

impl<L, R> Display for Either<L, R>
where
    L: Display,
    R: Display,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Either::Left(l) => write!(f, "Left({})", l),
            Either::Right(r) => write!(f, "Right({})", r),
        }
    }
}

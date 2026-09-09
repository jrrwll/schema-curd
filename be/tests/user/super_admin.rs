use argon2::{
    Argon2, PasswordHasher,
    password_hash::{SaltString, rand_core::OsRng},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand_core::RngCore;
use schema_curd::util::verify_password;

#[tokio::test]
async fn test_insert_sql() {
    let mut password_bytes = [0_u8; 18];
    OsRng.fill_bytes(&mut password_bytes);
    let password = URL_SAFE_NO_PAD.encode(password_bytes);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
        .unwrap()
        .to_string();

    println!("\nusername: super_admin");
    println!("password: {password}\n");
    println!(
        "insert into sys_user (name, password, display_name, super_admin) values ('super_admin', '{}', 'Super Admin', 1);",
        password_hash.replace('\'', "''")
    );

    let matched = verify_password(password.clone(), password_hash.clone()).await.unwrap();
    println!("verify_password: {password} == {password_hash} is {matched}");
    assert!(matched);
}

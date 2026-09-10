create table datasource_info (
    id integer primary key autoincrement,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by integer default null,
    updated_by integer default null,
    name varchar(100) not null,
    display_name varchar(30) not null,
    disabled integer not null default 0,
    url varchar(500) not null,
    username varchar(500) not null default '',
    password varchar(500) not null default '',
    config text
);

create unique index uk_datasource_info_name_deleted_at
    on datasource_info(name, deleted_at);

create table table_info (
    id integer primary key autoincrement,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by integer default null,
    updated_by integer default null,
    datasource_name varchar(100) not null,
    name varchar(100) not null,
    display_name varchar(30) not null,
    disabled integer not null default 0,
    table_name varchar(200) not null,
    table_config text,
    columns_config text
);

create unique index uk_table_info_datasource_name_name_deleted_at
    on table_info(datasource_name, name, deleted_at);
create unique index idx_table_info_datasource_name_table_name
    on table_info(datasource_name, table_name);

create table sys_user (
    id integer primary key autoincrement,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by integer default null,
    updated_by integer default null,
    name varchar(100) not null,
    password varchar(1000) not null,
    display_name varchar(30) not null,
    disabled integer not null default 0,
    super_admin integer not null default 0
);

create unique index uk_sys_user_name_deleted_at
    on sys_user(name, deleted_at);

create table sys_user_role (
    id integer primary key autoincrement,
    created_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by integer default null,
    deleted_by integer default null,
    user_id integer not null,
    resource_type varchar(50) not null,
    resource_id integer not null,
    role varchar(30) not null
);

create unique index uk_sys_user_user_resource_deleted_at
    on sys_user_role(user_id, resource_type, resource_id, deleted_at);

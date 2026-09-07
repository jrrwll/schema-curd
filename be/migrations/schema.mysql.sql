create table datasource_info (
    id bigint not null auto_increment,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by bigint null default null,
    updated_by bigint null default null,
    name varchar(100) not null comment 'datasource name',
    display_name varchar(30) not null comment 'display name',
    disabled tinyint(1) not null default 0 comment 'disabled flag',
    url varchar(500) not null comment 'connection url',
    username varchar(500) not null default '' comment 'username',
    password varchar(500) not null default '' comment 'password',
    config mediumtext comment 'json configuration',
    primary key (id),
    unique key uk_name_deleted_at (name, deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_bin comment='datasource information';

create table table_info (
    id bigint not null auto_increment,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by bigint null default null,
    updated_by bigint null default null,
    datasource_name varchar(100) not null comment 'datasource name',
    name varchar(100) not null comment 'table name',
    display_name varchar(30) not null comment 'display name',
    disabled tinyint(1) not null default 0 comment 'disabled flag',
    table_name varchar(200) not null comment 'physical table name',
    table_config mediumtext comment 'table json configuration',
    columns_config mediumtext comment 'columns json configuration',
    primary key (id),
    unique key uk_datasource_name_name_deleted_at (datasource_name, name, deleted_at),
    key idx_datasource_name_table_name(datasource_name, table_name)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_bin comment='table information';

create table sys_user (
    id bigint not null auto_increment,
    created_at datetime not null default current_timestamp,
    updated_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by bigint null default null,
    updated_by bigint null default null,
    name varchar(100) not null comment 'username',
    password varchar(1000) not null comment 'password',
    display_name varchar(30) not null comment 'user display name',
    disabled tinyint(1) not null default 0 comment 'disabled flag',
    super_admin tinyint(1) not null default 0 comment 'super admin flag',
    primary key (id),
    unique key uk_name_deleted_at (name, deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_bin comment='user information';

create table sys_user_role (
    id bigint not null auto_increment,
    created_at datetime not null default current_timestamp,
    deleted_at bigint not null default 0,
    created_by bigint null default null comment 'grantor user id',
    deleted_by bigint null default null comment 'revoker user id',
    user_id bigint not null comment 'user id',
    role varchar(30) not null comment 'role enum',
    resource_type varchar(50) not null comment 'resource type',
    resource_id bigint not null comment 'resource id',
    primary key (id),
    unique key uk_user_resource_deleted_at (
        user_id, resource_type, resource_id, deleted_at
    )
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_bin comment='user role association';

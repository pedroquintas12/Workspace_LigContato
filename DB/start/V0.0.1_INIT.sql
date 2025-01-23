-- Active: 1730257054821@@localhost@3306@workspace_ligcontato

create table auth(
`ID_auth` bigint unsigned primary key auto_increment,
`username` varchar(244),  
`password` varchar(200),
`origin` varchar(50),
`status` varchar(1),
`created_by` int,
`modified_by` int,
`created_date` datetime,
`modified_date` datetime,
`deleted` int,
unique key `UNQ_AUTH_USERNAME` (`username`, `deleted`)
);

create table auth_roles(
`ID_auth` bigint unsigned,
`roles` varchar(40),
KEY `IDX_AUTH_ROLES`(`ID_auth`, `roles`),
key `FK_AUTH_ROLES_IDX`(`ID_auth`),
constraint `FK_AUTH_ROLES` foreign key (`ID_auth`) references `auth` (`ID_auth`) ON delete NO ACTION ON UPDATE NO ACTION

)





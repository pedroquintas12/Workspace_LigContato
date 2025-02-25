-- ----------------------------------------------------------------------------
-- MySQL Workbench Migration
-- Migrated Schemata: workspace_ligcontato
-- Source Schemata: workspace_ligcontato
-- Created: Mon Feb 24 09:24:10 2025
-- Workbench Version: 8.0.38
-- ----------------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Schema workspace_ligcontato
-- ----------------------------------------------------------------------------
DROP SCHEMA IF EXISTS `workspace_ligcontato` ;
CREATE SCHEMA IF NOT EXISTS `workspace_ligcontato` ;

-- ----------------------------------------------------------------------------
-- Table workspace_ligcontato.alembic_version
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workspace_ligcontato`.`alembic_version` (
  `version_num` VARCHAR(32) NOT NULL,
  PRIMARY KEY (`version_num`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Table workspace_ligcontato.auth
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workspace_ligcontato`.`auth` (
  `ID_auth` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(244) NOT NULL,
  `password` TEXT NOT NULL,
  `role` VARCHAR(40) NOT NULL,
  `origin` VARCHAR(50) NOT NULL,
  `status` VARCHAR(1) NOT NULL DEFAULT 'L',
  `status_logado` VARCHAR(1) NOT NULL DEFAULT 'N',
  `created_by` INT NOT NULL DEFAULT '1',
  `modified_by` INT NOT NULL DEFAULT '1',
  `last_login` DATETIME NULL DEFAULT NULL,
  `last_logout` DATETIME NULL DEFAULT NULL,
  `created_date` DATETIME NOT NULL,
  `modified_date` DATETIME NOT NULL,
  `deleted` INT NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID_auth`))
ENGINE = InnoDB
AUTO_INCREMENT = 7
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Table workspace_ligcontato.auth_inatividade
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workspace_ligcontato`.`auth_inatividade` (
  `ID_inatividade` BIGINT NOT NULL AUTO_INCREMENT,
  `ID_auth` BIGINT UNSIGNED NULL DEFAULT NULL,
  `ID_log` BIGINT NULL DEFAULT NULL,
  `username` VARCHAR(50) NULL DEFAULT NULL,
  `tempo_inatividade` DECIMAL(5,2) NULL DEFAULT NULL,
  `data` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`ID_inatividade`),
  INDEX `FK_AUTH_INATIVIDADE` (`ID_auth` ASC) VISIBLE,
  CONSTRAINT `FK_AUTH_INATIVIDADE`
    FOREIGN KEY (`ID_auth`)
    REFERENCES `workspace_ligcontato`.`auth` (`ID_auth`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Table workspace_ligcontato.history_login
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workspace_ligcontato`.`history_login` (
  `ID_history` BIGINT NOT NULL AUTO_INCREMENT,
  `ID_auth` BIGINT UNSIGNED NULL DEFAULT NULL,
  `Data_login` DATETIME NULL DEFAULT NULL,
  `Data_logout` DATETIME NULL DEFAULT NULL,
  `Created_date` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`ID_history`),
  INDEX `FK_AUTH_LOGIN` (`ID_auth` ASC) VISIBLE,
  CONSTRAINT `FK_AUTH_LOGIN`
    FOREIGN KEY (`ID_auth`)
    REFERENCES `workspace_ligcontato`.`auth` (`ID_auth`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Table workspace_ligcontato.log_actions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workspace_ligcontato`.`log_actions` (
  `ID_log` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ID_auth` BIGINT UNSIGNED NULL DEFAULT NULL,
  `username` VARCHAR(244) NULL DEFAULT NULL,
  `estado` TEXT NULL DEFAULT NULL,
  `diario` TEXT NULL DEFAULT NULL,
  `complemento` TINYINT NULL DEFAULT NULL,
  `status` VARCHAR(10) NULL DEFAULT NULL,
  `inicio` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `fim` TIMESTAMP NULL DEFAULT NULL,
  `data_publicacao` DATE NULL DEFAULT NULL,
  `tempo_decorrido` BIGINT NULL DEFAULT NULL,
  PRIMARY KEY (`ID_log`),
  INDEX `FK_AUTH_USERNAME_idx` (`username` ASC) VISIBLE,
  INDEX `FK_AUTH_ACTIONS` (`ID_auth` ASC) VISIBLE,
  CONSTRAINT `FK_AUTH_ACTIONS`
    FOREIGN KEY (`ID_auth`)
    REFERENCES `workspace_ligcontato`.`auth` (`ID_auth`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Table workspace_ligcontato.log_updates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `workspace_ligcontato`.`log_updates` (
  `ID_log_update` BIGINT NOT NULL AUTO_INCREMENT,
  `last_update` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_log_update`))
ENGINE = InnoDB
AUTO_INCREMENT = 2
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci;

-- ----------------------------------------------------------------------------
-- Trigger workspace_ligcontato.after_auth_update
-- ----------------------------------------------------------------------------
DELIMITER $$
USE `workspace_ligcontato`$$
CREATE DEFINER=`root`@`localhost` TRIGGER `after_auth_update` AFTER UPDATE ON `auth` FOR EACH ROW BEGIN
    -- Se 'last_login' foi atualizado, significa que o usu�rio fez login
    IF NEW.last_login IS NOT NULL AND NEW.last_login != OLD.last_login THEN
        INSERT INTO history_login (ID_auth, Data_login, Created_date)
        VALUES (NEW.ID_auth, NEW.last_login, NOW());
    END IF;

    -- Se 'last_logout' foi atualizado, significa que o usu�rio fez logout
    IF NEW.last_logout IS NOT NULL AND NEW.last_logout != OLD.last_logout THEN
        UPDATE history_login
        SET Data_logout = NEW.last_logout
        WHERE ID_auth = NEW.ID_auth 
        AND Data_logout IS NULL
        ORDER BY ID_history DESC
        LIMIT 1; -- Atualiza o �ltimo login sem logout registrado
    END IF;
END;

-- ----------------------------------------------------------------------------
-- Trigger workspace_ligcontato.after_actions_change
-- ----------------------------------------------------------------------------
DELIMITER $$
USE `workspace_ligcontato`$$
CREATE DEFINER=`root`@`localhost` TRIGGER `after_actions_change` AFTER INSERT ON `log_actions` FOR EACH ROW BEGIN
    UPDATE log_updates
    SET last_update = NOW()
    WHERE ID_log_update = 1;
END;

-- ----------------------------------------------------------------------------
-- Trigger workspace_ligcontato.after_actions_update
-- ----------------------------------------------------------------------------
DELIMITER $$
USE `workspace_ligcontato`$$
CREATE DEFINER=`root`@`localhost` TRIGGER `after_actions_update` AFTER UPDATE ON `log_actions` FOR EACH ROW BEGIN
    UPDATE log_updates
    SET last_update = NOW()
    WHERE ID_log_update = 1;
END;

-- ----------------------------------------------------------------------------
-- Trigger workspace_ligcontato.after_actions_delete
-- ----------------------------------------------------------------------------
DELIMITER $$
USE `workspace_ligcontato`$$
CREATE DEFINER=`root`@`localhost` TRIGGER `after_actions_delete` AFTER DELETE ON `log_actions` FOR EACH ROW BEGIN
    UPDATE log_updates
    SET last_update = NOW()
    WHERE ID_log_update = 1;
END;
SET FOREIGN_KEY_CHECKS = 1;

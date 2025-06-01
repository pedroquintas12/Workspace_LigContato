
DELIMITER //

CREATE TRIGGER after_auth_update
AFTER UPDATE ON auth
FOR EACH ROW
BEGIN
    -- Se 'last_login' foi atualizado, significa que o usuário fez login
    IF NEW.last_login IS NOT NULL AND NEW.last_login != OLD.last_login THEN
        INSERT INTO history_login (ID_auth, Data_login, Created_date)
        VALUES (NEW.ID_auth, NEW.last_login, NOW());
    END IF;

    -- Se 'last_logout' foi atualizado, significa que o usuário fez logout
    IF NEW.last_logout IS NOT NULL AND NEW.last_logout != OLD.last_logout THEN
        UPDATE history_login
        SET Data_logout = NEW.last_logout
        WHERE ID_auth = NEW.ID_auth 
        AND Data_logout IS NULL
        ORDER BY ID_history DESC
        LIMIT 1; -- Atualiza o último login sem logout registrado
    END IF;
END;
//

DELIMITER ;



DELIMITER $$

CREATE TRIGGER after_actions_change
AFTER INSERT ON log_actions
FOR EACH ROW
BEGIN
    UPDATE log_updates
    SET last_update = NOW()
    WHERE ID_log_update = 1;
END $$

CREATE TRIGGER after_actions_update
AFTER UPDATE ON log_actions
FOR EACH ROW
BEGIN
    UPDATE log_updates
    SET last_update = NOW()
    WHERE ID_log_update = 1;
END $$

CREATE TRIGGER after_actions_delete
AFTER DELETE ON log_actions
FOR EACH ROW
BEGIN
    UPDATE log_updates
    SET last_update = NOW()
    WHERE ID_log_update = 1;
END $$

DELIMITER ;
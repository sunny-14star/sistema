-- ==========================================================
-- Sistema de Gestión Escolar - Politécnico Ramón Dubert Novo
-- Script de Base de Datos para MySQL / MariaDB (XAMPP phpMyAdmin)
-- ==========================================================

-- 1. Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS `sistema_escolar` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- 2. Usar la base de datos
USE `sistema_escolar`;

-- 3. Crear la tabla de estudiantes
CREATE TABLE IF NOT EXISTS `estudiantes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `matricula` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `grado` VARCHAR(100) NOT NULL,
  `seccion` VARCHAR(10) NOT NULL,
  `fechaNacimiento` DATE NULL,
  `genero` VARCHAR(20) DEFAULT 'No especificado',
  `estado` VARCHAR(50) DEFAULT 'Activo',
  `tutor` VARCHAR(255) DEFAULT 'No especificado',
  `telefono` VARCHAR(50) DEFAULT 'Sin teléfono',
  `email` VARCHAR(150) NULL,
  `observaciones` TEXT NULL,
  `fechaRegistro` DATE NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_matricula` (`matricula`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- ¡Listo! Puedes importar este archivo directamente en phpMyAdmin:
-- 1. Abre http://localhost/phpmyadmin/
-- 2. Haz clic en la pestaña "Importar"
-- 3. Selecciona este archivo database.sql y presiona "Continuar"
-- ==========================================================

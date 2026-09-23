<?php
/**
 * api.php - Backend REST API para conectar el Sistema Escolar con MySQL
 * Compatible con XAMPP / WampServer / phpMyAdmin
 */

// Cabeceras HTTP para permitir comunicación con el frontend
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Responder inmediatamente a peticiones preflight OPTIONS del navegador
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==========================================================
// CONFIGURACIÓN DE LA BASE DE DATOS (XAMPP por defecto)
// ==========================================================
$db_host = 'localhost';
$db_name = 'sistema_escolar';
$db_user = 'root';
$db_pass = ''; // En XAMPP la contraseña de root viene vacía por defecto

try {
    $pdo = new PDO(
        "mysql:host={$db_host};dbname={$db_name};charset=utf8mb4",
        $db_user,
        $db_pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'No se pudo conectar a MySQL: ' . $e->getMessage(),
        'hint' => 'Asegúrate de que MySQL esté encendido en XAMPP y de haber importado database.sql en phpMyAdmin.'
    ]);
    exit;
}

// Método HTTP de la petición
$method = $_SERVER['REQUEST_METHOD'];

// Para solicitudes con método sobreescrito (ej. en algunos servidores)
if ($method === 'POST' && isset($_POST['_method'])) {
    $method = strtoupper($_POST['_method']);
}

// ==========================================================
// RUTAS DE LA API
// ==========================================================

switch ($method) {

    // ------------------------------------------------------
    // 1. OBTENER ESTUDIANTES (GET)
    // ------------------------------------------------------
    case 'GET':
        // Comprobar estado de conexión
        if (isset($_GET['ping'])) {
            echo json_encode([
                'success' => true,
                'message' => 'Conexión a MySQL activa exitosamente',
                'database' => $db_name
            ]);
            exit;
        }

        // Obtener un estudiante específico por ID
        if (isset($_GET['id'])) {
            $stmt = $pdo->prepare('SELECT * FROM estudiantes WHERE id = ?');
            $stmt->execute([$_GET['id']]);
            $estudiante = $stmt->fetch();

            if ($estudiante) {
                echo json_encode($estudiante);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Estudiante no encontrado']);
            }
            exit;
        }

        // Obtener todos los estudiantes ordenados del más reciente al más antiguo
        $stmt = $pdo->query('SELECT * FROM estudiantes ORDER BY id DESC');
        $estudiantes = $stmt->fetchAll();
        echo json_encode($estudiantes);
        break;

    // ------------------------------------------------------
    // 2. AGREGAR NUEVO ESTUDIANTE (POST)
    // ------------------------------------------------------
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Datos JSON inválidos']);
            exit;
        }

        $matricula = trim($data['matricula'] ?? '');
        $nombre = trim($data['nombre'] ?? '');
        $grado = trim($data['grado'] ?? '');
        $seccion = trim($data['seccion'] ?? '');
        $fechaNacimiento = !empty($data['fechaNacimiento']) ? $data['fechaNacimiento'] : null;
        $genero = !empty($data['genero']) ? $data['genero'] : 'No especificado';
        $estado = !empty($data['estado']) ? $data['estado'] : 'Activo';
        $tutor = !empty($data['tutor']) ? trim($data['tutor']) : 'No especificado';
        $telefono = !empty($data['telefono']) ? trim($data['telefono']) : 'Sin teléfono';
        $email = !empty($data['email']) ? trim($data['email']) : null;
        $observaciones = !empty($data['observaciones']) ? trim($data['observaciones']) : null;
        $fechaRegistro = !empty($data['fechaRegistro']) ? $data['fechaRegistro'] : date('Y-m-d');

        if (empty($matricula) || empty($nombre) || empty($grado) || empty($seccion)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Matrícula, Nombre, Grado y Sección son obligatorios']);
            exit;
        }

        try {
            $stmt = $pdo->prepare('
                INSERT INTO estudiantes 
                (matricula, nombre, grado, seccion, fechaNacimiento, genero, estado, tutor, telefono, email, observaciones, fechaRegistro)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');

            $stmt->execute([
                $matricula,
                $nombre,
                $grado,
                $seccion,
                $fechaNacimiento,
                $genero,
                $estado,
                $tutor,
                $telefono,
                $email,
                $observaciones,
                $fechaRegistro
            ]);

            $idGenerado = $pdo->lastInsertId();

            http_response_code(201);
            echo json_encode([
                'success' => true,
                'message' => "Estudiante '{$nombre}' guardado exitosamente en MySQL",
                'id' => (int)$idGenerado
            ]);
        } catch (PDOException $e) {
            // Código de error 23000 = duplicado de clave única
            if ($e->getCode() == 23000) {
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => "Ya existe un estudiante con la matrícula {$matricula}"]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error al guardar en MySQL: ' . $e->getMessage()]);
            }
        }
        break;

    // ------------------------------------------------------
    // 3. ACTUALIZAR ESTUDIANTE EXISTENTE (PUT)
    // ------------------------------------------------------
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);

        if (!$data || empty($data['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID de estudiante no proporcionado']);
            exit;
        }

        $id = (int)$data['id'];
        $matricula = trim($data['matricula'] ?? '');
        $nombre = trim($data['nombre'] ?? '');
        $grado = trim($data['grado'] ?? '');
        $seccion = trim($data['seccion'] ?? '');
        $fechaNacimiento = !empty($data['fechaNacimiento']) ? $data['fechaNacimiento'] : null;
        $genero = !empty($data['genero']) ? $data['genero'] : 'No especificado';
        $estado = !empty($data['estado']) ? $data['estado'] : 'Activo';
        $tutor = !empty($data['tutor']) ? trim($data['tutor']) : 'No especificado';
        $telefono = !empty($data['telefono']) ? trim($data['telefono']) : 'Sin teléfono';
        $email = !empty($data['email']) ? trim($data['email']) : null;
        $observaciones = !empty($data['observaciones']) ? trim($data['observaciones']) : null;

        try {
            $stmt = $pdo->prepare('
                UPDATE estudiantes SET 
                    matricula = ?, 
                    nombre = ?, 
                    grado = ?, 
                    seccion = ?, 
                    fechaNacimiento = ?, 
                    genero = ?, 
                    estado = ?, 
                    tutor = ?, 
                    telefono = ?, 
                    email = ?, 
                    observaciones = ?
                WHERE id = ?
            ');

            $stmt->execute([
                $matricula,
                $nombre,
                $grado,
                $seccion,
                $fechaNacimiento,
                $genero,
                $estado,
                $tutor,
                $telefono,
                $email,
                $observaciones,
                $id
            ]);

            echo json_encode([
                'success' => true,
                'message' => "Estudiante '{$nombre}' actualizado exitosamente en MySQL"
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                http_response_code(409);
                echo json_encode(['success' => false, 'error' => "La matrícula {$matricula} ya pertenece a otro estudiante"]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Error al actualizar en MySQL: ' . $e->getMessage()]);
            }
        }
        break;

    // ------------------------------------------------------
    // 4. ELIMINAR ESTUDIANTE (DELETE)
    // ------------------------------------------------------
    case 'DELETE':
        $id = null;
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
        } else {
            $data = json_decode(file_get_contents('php://input'), true);
            if (isset($data['id'])) {
                $id = (int)$data['id'];
            }
        }

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID no especificado']);
            exit;
        }

        try {
            $stmt = $pdo->prepare('DELETE FROM estudiantes WHERE id = ?');
            $stmt->execute([$id]);

            echo json_encode([
                'success' => true,
                'message' => 'Estudiante eliminado exitosamente de MySQL'
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Error al eliminar de MySQL: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Método HTTP no permitido']);
        break;
}

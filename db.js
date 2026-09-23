/**
 * db.js - Capa de persistencia para el Sistema Escolar
 * Soporta conexión directa a MySQL (vía api.php en XAMPP)
 * y respaldo local automático con IndexedDB para modo sin servidor.
 */

const DB_NAME = 'SistemaEscolarDB';
const DB_VERSION = 1;
const STORE_NAME = 'estudiantes';

class EscuelaDB {
  constructor() {
    this.db = null;
    this.modo = 'detectando'; // 'mysql' | 'indexeddb'
    this.apiUrl = 'api.php';
  }

  /**
   * Inicializa la base de datos detectando si MySQL (api.php) está disponible
   */
  async init() {
    // 1. Intentar conectar a la API de MySQL (XAMPP)
    try {
      const resp = await fetch(`${this.apiUrl}?ping=1`, { 
        method: 'GET',
        cache: 'no-cache'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          this.modo = 'mysql';
          console.log('🟢 Conectado exitosamente a la base de datos MySQL (XAMPP)');
          return this.modo;
        }
      }
    } catch (err) {
      // Si api.php no responde (ej: abierto con doble clic como file://), usar IndexedDB
      console.info('ℹ️ Servidor MySQL (api.php) no disponible. Iniciando base de datos local (IndexedDB).');
    }

    // 2. Modo Respaldo: Inicializar IndexedDB en el navegador
    this.modo = 'indexeddb';
    await this.initIndexedDB();
    return this.modo;
  }

  /**
   * Inicialización de la base de datos local IndexedDB
   */
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });

          store.createIndex('matricula', 'matricula', { unique: true });
          store.createIndex('nombre', 'nombre', { unique: false });
          store.createIndex('grado', 'grado', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('fechaRegistro', 'fechaRegistro', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Error al abrir IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Obtiene todos los estudiantes almacenados
   */
  async obtenerTodos() {
    if (this.modo === 'mysql') {
      const res = await fetch(this.apiUrl, { cache: 'no-cache' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al consultar estudiantes en MySQL');
      }
      return await res.json();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Obtiene un estudiante por su ID
   */
  async obtenerPorId(id) {
    if (this.modo === 'mysql') {
      const res = await fetch(`${this.apiUrl}?id=${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al obtener estudiante desde MySQL');
      }
      return await res.json();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(Number(id));

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Agrega un nuevo estudiante a la base de datos
   */
  async agregarEstudiante(estudiante) {
    const nuevoRegistro = {
      ...estudiante,
      fechaRegistro: estudiante.fechaRegistro || new Date().toISOString().split('T')[0]
    };

    if (this.modo === 'mysql') {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoRegistro)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar en MySQL');
      }
      return data.id;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(nuevoRegistro);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        if (e.target.error.name === 'ConstraintError') {
          reject(new Error(`Ya existe un estudiante con la matrícula ${estudiante.matricula}`));
        } else {
          reject(e.target.error);
        }
      };
    });
  }

  /**
   * Actualiza los datos de un estudiante existente
   */
  async actualizarEstudiante(estudiante) {
    const datosActualizados = {
      ...estudiante,
      id: Number(estudiante.id)
    };

    if (this.modo === 'mysql') {
      const res = await fetch(this.apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosActualizados)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al actualizar en MySQL');
      }
      return true;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(datosActualizados);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        if (e.target.error.name === 'ConstraintError') {
          reject(new Error(`La matrícula ${estudiante.matricula} ya pertenece a otro alumno`));
        } else {
          reject(e.target.error);
        }
      };
    });
  }

  /**
   * Elimina un estudiante de la base de datos
   */
  async eliminarEstudiante(id) {
    if (this.modo === 'mysql') {
      const res = await fetch(`${this.apiUrl}?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al eliminar en MySQL');
      }
      return true;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(Number(id));

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Cuenta la cantidad total de estudiantes
   */
  async contarEstudiantes() {
    if (this.modo === 'mysql') {
      const lista = await this.obtenerTodos();
      return lista.length;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }
}

// Instancia global accesible para la app
window.dbEscuela = new EscuelaDB();

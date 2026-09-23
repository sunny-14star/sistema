/**
 * app.js - Lógica de Interfaz y Controladores del Sistema Escolar
 * Conecta los botones, filtros y formularios con la base de datos IndexedDB.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Estado global de la aplicación
  let todosLosEstudiantes = [];
  let sortColumn = 'matricula';
  let sortDirection = 'asc';

  // Referencias a elementos del DOM
  const tableBody = document.getElementById('students-table-body');
  const emptyState = document.getElementById('empty-state');
  const resultsCount = document.getElementById('results-count');

  // KPIs / Estadísticas
  const statTotal = document.getElementById('stat-total');
  const statActivos = document.getElementById('stat-activos');
  const statBecados = document.getElementById('stat-becados');
  const statPendientes = document.getElementById('stat-pendientes');

  // Filtros
  const filterSearch = document.getElementById('filter-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const filterGrado = document.getElementById('filter-grado');
  const filterSeccion = document.getElementById('filter-seccion');
  const filterEstado = document.getElementById('filter-estado');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnEmptyClear = document.getElementById('btn-empty-clear');

  // Modales
  const modalStudent = document.getElementById('modal-student');
  const modalView = document.getElementById('modal-view');
  const modalDelete = document.getElementById('modal-delete');
  const studentForm = document.getElementById('student-form');
  const modalTitle = document.getElementById('modal-title');
  const toastContainer = document.getElementById('toast-container');

  // Botones de Cabecera
  const btnOpenAddModal = document.getElementById('btn-open-add-modal');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnGenMatricula = document.getElementById('btn-gen-matricula');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  const btnPrintCard = document.getElementById('btn-print-card');

  // Indicador de estado de base de datos
  const dbStatusIndicator = document.getElementById('db-status-indicator');

  function actualizarIndicadorBD(modo) {
    if (!dbStatusIndicator) return;
    if (modo === 'mysql') {
      dbStatusIndicator.textContent = '🟢 MySQL (XAMPP)';
      dbStatusIndicator.className = 'db-status-badge db-status-mysql';
      dbStatusIndicator.title = 'Conectado a base de datos MySQL en XAMPP / phpMyAdmin';
    } else if (modo === 'indexeddb') {
      dbStatusIndicator.textContent = '🔵 BD Local';
      dbStatusIndicator.className = 'db-status-badge db-status-local';
      dbStatusIndicator.title = 'Usando base de datos local del navegador (IndexedDB). Abre el proyecto desde XAMPP para usar MySQL.';
    } else {
      dbStatusIndicator.textContent = '⏳ Conectando...';
      dbStatusIndicator.className = 'db-status-badge db-status-connecting';
    }
  }

  // ==========================================
  // INICIALIZACIÓN DE LA BASE DE DATOS
  // ==========================================
  try {
    const modo = await window.dbEscuela.init();
    actualizarIndicadorBD(modo);
    await cargarDatosDesdeBD();
    if (modo === 'mysql') {
      showToast('Conectado a MySQL (XAMPP / phpMyAdmin)', 'success');
    } else {
      showToast('Base de datos local lista', 'info');
    }
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    if (dbStatusIndicator) {
      dbStatusIndicator.textContent = '🔴 Error BD';
      dbStatusIndicator.className = 'db-status-badge db-status-error';
    }
    showToast('Error al conectar la base de datos: ' + error.message, 'danger');
  }

  /**
   * Lee todos los registros desde IndexedDB y actualiza la vista
   */
  async function cargarDatosDesdeBD() {
    todosLosEstudiantes = await window.dbEscuela.obtenerTodos();
    actualizarEstadisticas(todosLosEstudiantes);
    renderizarTabla();
  }

  // ==========================================
  // FILTRADO Y RENDERIZADO
  // ==========================================

  /**
   * Normaliza texto para búsquedas insensibles a mayúsculas y acentos
   */
  function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Filtra los estudiantes según los criterios actuales
   */
  function obtenerEstudiantesFiltrados() {
    const busqueda = normalizarTexto(filterSearch.value.trim());
    const grado = filterGrado.value;
    const seccion = filterSeccion.value;
    const estado = filterEstado.value;

    return todosLosEstudiantes.filter(est => {
      // Coincidencia de búsqueda libre
      if (busqueda) {
        const matchNombre = normalizarTexto(est.nombre).includes(busqueda);
        const matchMatricula = normalizarTexto(est.matricula).includes(busqueda);
        const matchTutor = normalizarTexto(est.tutor).includes(busqueda);
        const matchEmail = normalizarTexto(est.email).includes(busqueda);
        const matchTelefono = normalizarTexto(est.telefono).includes(busqueda);

        if (!matchNombre && !matchMatricula && !matchTutor && !matchEmail && !matchTelefono) {
          return false;
        }
      }

      // Filtros selectores
      if (grado && est.grado !== grado) return false;
      if (seccion && est.seccion !== seccion) return false;
      if (estado && est.estado !== estado) return false;

      return true;
    });
  }

  /**
   * Renderiza las filas en la tabla según filtros y orden actual
   */
  function renderizarTabla() {
    let filtrados = obtenerEstudiantesFiltrados();

    // Ordenamiento
    filtrados.sort((a, b) => {
      let valA = a[sortColumn] || '';
      let valB = b[sortColumn] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // Actualizar contador
    resultsCount.textContent = `${filtrados.length} de ${todosLosEstudiantes.length} Alumnos`;

    if (filtrados.length === 0) {
      tableBody.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    // Generar filas
    tableBody.innerHTML = filtrados.map(est => {
      const iniciales = obtenerIniciales(est.nombre);
      const estadoBadgeClass = obtenerClaseEstado(est.estado);

      return `
        <tr>
          <td>
            <span class="matricula-tag">${escapeHTML(est.matricula)}</span>
          </td>
          <td>
            <div class="student-name-cell">
              <div class="student-avatar">${iniciales}</div>
              <div class="student-info-meta">
                <span class="student-fullname">${escapeHTML(est.nombre)}</span>
                <span class="student-sub">${est.genero || 'Estudiante'} • Reg: ${est.fechaRegistro || 'N/A'}</span>
              </div>
            </div>
          </td>
          <td>
            <strong>${escapeHTML(est.grado)}</strong>
            <span style="color: var(--text-muted); font-size: 0.85rem;"> (Sección ${escapeHTML(est.seccion)})</span>
          </td>
          <td>
            <div style="font-weight: 500;">${escapeHTML(est.tutor)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">📞 ${escapeHTML(est.telefono)}</div>
          </td>
          <td>
            <span class="badge ${estadoBadgeClass}">${escapeHTML(est.estado)}</span>
          </td>
          <td style="text-align: center;">
            <div class="table-actions" style="justify-content: center;">
              <button class="btn-action btn-view" title="Ver Expediente Completo" onclick="verFichaEstudiante(${est.id})">
                👁️
              </button>
              <button class="btn-action btn-edit" title="Editar Estudiante" onclick="abrirEditarEstudiante(${est.id})">
                ✏️
              </button>
              <button class="btn-action btn-delete" title="Eliminar de la Base de Datos" onclick="confirmarEliminarEstudiante(${est.id})">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Actualiza las tarjetas de estadísticas superiores
   */
  function actualizarEstadisticas(estudiantes) {
    statTotal.textContent = estudiantes.length;
    statActivos.textContent = estudiantes.filter(e => e.estado === 'Activo').length;
    statBecados.textContent = estudiantes.filter(e => e.estado === 'Becado').length;
    statPendientes.textContent = estudiantes.filter(e => e.estado === 'Pendiente' || e.estado === 'Inactivo').length;
  }

  function obtenerIniciales(nombre) {
    if (!nombre) return 'AL';
    const partes = nombre.trim().split(' ');
    if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }

  function obtenerClaseEstado(estado) {
    switch (estado) {
      case 'Activo': return 'badge-activo';
      case 'Becado': return 'badge-becado';
      case 'Pendiente': return 'badge-pendiente';
      case 'Inactivo': return 'badge-inactivo';
      default: return 'badge-activo';
    }
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // CONTROLADORES DE EVENTOS DE FILTRO
  // ==========================================

  // Búsqueda en vivo con el teclado
  filterSearch.addEventListener('input', () => {
    btnClearSearch.style.display = filterSearch.value ? 'block' : 'none';
    renderizarTabla();
  });

  btnClearSearch.addEventListener('click', () => {
    filterSearch.value = '';
    btnClearSearch.style.display = 'none';
    filterSearch.focus();
    renderizarTabla();
  });

  // Filtros de selección
  filterGrado.addEventListener('change', renderizarTabla);
  filterSeccion.addEventListener('change', renderizarTabla);
  filterEstado.addEventListener('change', renderizarTabla);

  // Botón Limpiar filtros
  function limpiarTodosLosFiltros() {
    filterSearch.value = '';
    btnClearSearch.style.display = 'none';
    filterGrado.value = '';
    filterSeccion.value = '';
    filterEstado.value = '';
    renderizarTabla();
    showToast('Filtros restablecidos', 'info');
  }

  btnResetFilters.addEventListener('click', limpiarTodosLosFiltros);
  btnEmptyClear.addEventListener('click', limpiarTodosLosFiltros);

  // Ordenamiento por encabezados de columna
  document.querySelectorAll('.data-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'asc';
      }

      // Actualizar indicadores visuales
      document.querySelectorAll('.data-table th.sortable').forEach(header => {
        header.textContent = header.textContent.replace(/[ ⬍▲▼]/g, '') + ' ⬍';
      });
      th.textContent = th.textContent.replace(/[ ⬍▲▼]/g, '') + (sortDirection === 'asc' ? ' ▲' : ' ▼');

      renderizarTabla();
    });
  });

  // ==========================================
  // GESTIÓN DE MODALES
  // ==========================================

  function abrirModal(modalElement) {
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function cerrarModales() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }

  // Cerrar al pulsar botones de cerrar o backdrop
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', cerrarModales);
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModales();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModales();
  });

  // ==========================================
  // CREACIÓN Y EDICIÓN DE ESTUDIANTES (CRUD)
  // ==========================================

  // Abrir modal para crear
  btnOpenAddModal.addEventListener('click', () => {
    studentForm.reset();
    document.getElementById('form-student-id').value = '';
    modalTitle.textContent = '➕ Registrar Nuevo Estudiante';
    sugerirSiguienteMatricula();
    abrirModal(modalStudent);
  });

  // Generador de código de matrícula
  function sugerirSiguienteMatricula() {
    const anio = new Date().getFullYear();
    let maxNum = 0;
    todosLosEstudiantes.forEach(est => {
      if (est.matricula) {
        const match = est.matricula.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    const numero = maxNum + 1;
    const codigo = `ESC-${anio}-${numero.toString().padStart(3, '0')}`;
    const input = document.getElementById('form-matricula');
    if (input) input.value = codigo;
  }

  btnGenMatricula.addEventListener('click', sugerirSiguienteMatricula);

  // Abrir modal para editar (accesible globalmente)
  window.abrirEditarEstudiante = async (id) => {
    try {
      const est = await window.dbEscuela.obtenerPorId(id);
      if (!est) return showToast('Estudiante no encontrado', 'danger');

      document.getElementById('form-student-id').value = est.id;
      document.getElementById('form-matricula').value = est.matricula;
      document.getElementById('form-nombre').value = est.nombre;
      document.getElementById('form-grado').value = est.grado;
      document.getElementById('form-seccion').value = est.seccion;
      document.getElementById('form-fecha-nac').value = est.fechaNacimiento || '';
      document.getElementById('form-genero').value = est.genero || 'Femenino';
      document.getElementById('form-estado').value = est.estado;
      document.getElementById('form-tutor').value = est.tutor;
      document.getElementById('form-telefono').value = est.telefono;
      document.getElementById('form-email').value = est.email || '';
      document.getElementById('form-observaciones').value = est.observaciones || '';

      modalTitle.textContent = '✏️ Editar Datos del Estudiante';
      abrirModal(modalStudent);
    } catch (err) {
      showToast('Error al cargar datos del estudiante: ' + err.message, 'danger');
    }
  };

  // Guardar formulario (Crear o Actualizar)
  studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('form-student-id').value;
    const matricula = document.getElementById('form-matricula').value.trim();
    const nombre = document.getElementById('form-nombre').value.trim();
    const grado = document.getElementById('form-grado').value;
    const seccion = document.getElementById('form-seccion').value;
    const fechaNacimiento = document.getElementById('form-fecha-nac').value;
    const genero = document.getElementById('form-genero').value;
    const estado = document.getElementById('form-estado').value;
    const tutor = document.getElementById('form-tutor').value.trim() || 'No especificado';
    const telefono = document.getElementById('form-telefono').value.trim() || 'Sin teléfono';
    const email = document.getElementById('form-email').value.trim();
    const observaciones = document.getElementById('form-observaciones').value.trim();

    const datosEstudiante = {
      matricula,
      nombre,
      grado,
      seccion,
      fechaNacimiento,
      genero,
      estado,
      tutor,
      telefono,
      email,
      observaciones
    };

    try {
      if (id) {
        // Actualizar
        datosEstudiante.id = Number(id);
        await window.dbEscuela.actualizarEstudiante(datosEstudiante);
        showToast(`Estudiante "${nombre}" actualizado correctamente`, 'success');
      } else {
        // Crear nuevo
        await window.dbEscuela.agregarEstudiante(datosEstudiante);
        showToast(`Estudiante "${nombre}" registrado con éxito en la base de datos`, 'success');
      }

      cerrarModales();
      await cargarDatosDesdeBD();
    } catch (error) {
      console.error('Error al guardar:', error);
      showToast(error.message, 'danger');
    }
  });

  // ==========================================
  // ELIMINACIÓN DE ESTUDIANTES
  // ==========================================

  window.confirmarEliminarEstudiante = async (id, nombre) => {
    document.getElementById('delete-student-id').value = id;
    if (nombre) {
      document.getElementById('delete-student-name').textContent = nombre;
    } else {
      const est = todosLosEstudiantes.find(e => e.id === Number(id)) || await window.dbEscuela.obtenerPorId(id);
      document.getElementById('delete-student-name').textContent = est ? est.nombre : `ID ${id}`;
    }
    abrirModal(modalDelete);
  };

  btnConfirmDelete.addEventListener('click', async () => {
    const id = document.getElementById('delete-student-id').value;
    if (!id) return;

    try {
      await window.dbEscuela.eliminarEstudiante(id);
      showToast('Estudiante eliminado correctamente de la base de datos', 'info');
      cerrarModales();
      await cargarDatosDesdeBD();
    } catch (err) {
      showToast('Error al eliminar estudiante: ' + err.message, 'danger');
    }
  });

  // ==========================================
  // VER FICHA / EXPEDIENTE DETALLADO
  // ==========================================

  window.verFichaEstudiante = async (id) => {
    try {
      const est = await window.dbEscuela.obtenerPorId(id);
      if (!est) return;

      const container = document.getElementById('student-detail-content');
      container.innerHTML = `
        <div class="student-id-card">
          <div class="student-card-header">
            <div class="student-card-avatar">${obtenerIniciales(est.nombre)}</div>
            <div class="student-card-title">
              <h2>${escapeHTML(est.nombre)}</h2>
              <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.35rem;">
                <span class="matricula-tag">${escapeHTML(est.matricula)}</span>
                <span class="badge ${obtenerClaseEstado(est.estado)}">${escapeHTML(est.estado)}</span>
              </div>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Grado y Grupo</span>
              <span class="detail-value">${escapeHTML(est.grado)} - Sección "${escapeHTML(est.seccion)}"</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Fecha de Nacimiento</span>
              <span class="detail-value">${est.fechaNacimiento ? est.fechaNacimiento : 'No especificada'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Género</span>
              <span class="detail-value">${est.genero || 'No especificado'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Tutor Legal / Acudiente</span>
              <span class="detail-value">${escapeHTML(est.tutor)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Teléfono de Contacto</span>
              <span class="detail-value">📞 ${escapeHTML(est.telefono)}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Correo Electrónico</span>
              <span class="detail-value">✉️ ${est.email ? escapeHTML(est.email) : 'Sin correo registrado'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Fecha de Inscripción</span>
              <span class="detail-value">📅 ${est.fechaRegistro || 'N/A'}</span>
            </div>
          </div>

          <div class="detail-item" style="margin-top: 0.5rem; background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <span class="detail-label">Observaciones y Notas</span>
            <p style="font-size: 0.9rem; margin-top: 0.3rem; color: #334155;">
              ${est.observaciones ? escapeHTML(est.observaciones) : 'Ninguna observación médica o académica registrada.'}
            </p>
          </div>
        </div>
      `;

      abrirModal(modalView);
    } catch (err) {
      showToast('Error al consultar ficha: ' + err.message, 'danger');
    }
  };

  btnPrintCard.addEventListener('click', () => {
    window.print();
  });

  // ==========================================
  // EXPORTAR A EXCEL (CSV)
  // ==========================================

  btnExportCsv.addEventListener('click', () => {
    const lista = obtenerEstudiantesFiltrados();
    if (lista.length === 0) {
      return showToast('No hay estudiantes para exportar', 'warning');
    }

    // Cabeceras del CSV
    const headers = [
      'Matricula',
      'Nombre Completo',
      'Grado',
      'Seccion',
      'Estado',
      'Fecha Nacimiento',
      'Genero',
      'Tutor',
      'Telefono',
      'Email',
      'Observaciones',
      'Fecha Registro'
    ];

    // Formatear filas
    const rows = lista.map(est => [
      `"${(est.matricula || '').replace(/"/g, '""')}"`,
      `"${(est.nombre || '').replace(/"/g, '""')}"`,
      `"${(est.grado || '').replace(/"/g, '""')}"`,
      `"${(est.seccion || '').replace(/"/g, '""')}"`,
      `"${(est.estado || '').replace(/"/g, '""')}"`,
      `"${(est.fechaNacimiento || '').replace(/"/g, '""')}"`,
      `"${(est.genero || '').replace(/"/g, '""')}"`,
      `"${(est.tutor || '').replace(/"/g, '""')}"`,
      `"${(est.telefono || '').replace(/"/g, '""')}"`,
      `"${(est.email || '').replace(/"/g, '""')}"`,
      `"${(est.observaciones || '').replace(/"/g, '""')}"`,
      `"${(est.fechaRegistro || '').replace(/"/g, '""')}"`
    ].join(','));

    // UTF-8 BOM (\uFEFF) para garantizar que Excel abra acentos y caracteres especiales correctamente
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const fechaHoy = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Estudiantes_Politecnico_Ramon_Dubert_Novo_${fechaHoy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Se exportaron ${lista.length} registros a Excel (CSV)`, 'success');
  });



  // ==========================================
  // NOTIFICACIONES TOAST
  // ==========================================

  function showToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icono = 'ℹ️';
    if (tipo === 'success') icono = '✅';
    if (tipo === 'danger') icono = '❌';
    if (tipo === 'warning') icono = '⚠️';

    toast.innerHTML = `<span>${icono}</span><span>${escapeHTML(mensaje)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(1rem)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});

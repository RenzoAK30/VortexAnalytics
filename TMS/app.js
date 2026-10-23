// CONFIGURACIÓN OFICIAL DE SUPABASE
const SUPABASE_URL = 'https://medgjttpoxpnhawkwfln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZGdqdHRwb3hwbmhhd2t3ZmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODc1MzAsImV4cCI6MjEwODE2MzUzMH0.xax6XWGjjPdjwG4Kn7vwO69EkBgSlCkV6U_SjeQjT74';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const loginForm = document.getElementById('login-form');
    const btnLogout = document.getElementById('btn-logout');
    const userBadge = document.getElementById('user-badge');
    const btnToggleFlota = document.getElementById('btn-toggle-flota');
    const flotaFlotante = document.getElementById('flota-flotante');
    const cerrarFlotante = document.getElementById('cerrar-flotante');
    const btnAdminPanel = document.getElementById('btn-admin-panel');
    const adminModal = document.getElementById('admin-modal');
    const cerrarAdminModal = document.getElementById('cerrar-admin-modal');

    // Comprobar sesión activa
    const sessionUser = localStorage.getItem('vortex_user');
    if (sessionUser) {
        activarSesion(JSON.parse(sessionUser));
    }

    // Evento de Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usuarioInput = document.getElementById('usuario-input').value.trim();
        const claveInput = document.getElementById('clave-input').value.trim();

        // Superusuario predeterminado de respaldo
        if (usuarioInput.toUpperCase() === 'RCARRANZA' && claveInput === '3012031131') {
            const adminUser = { id: 'PROG-01', nombre: 'RCARRANZA', usuario: 'RCARRANZA', rol: 'ADMIN' };
            activarSesion(adminUser);
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from('programadores')
                .select('*')
                .ilike('usuario', usuarioInput);

            if (error || !data || data.length === 0) {
                alert('Usuario no encontrado en la base de datos.');
                return;
            }

            const userRecord = data[0];
            const claveBD = String(userRecord.clave || userRecord.CLAVE || '').trim();

            if (claveBD === claveInput) {
                activarSesion(userRecord);
            } else {
                alert('Clave incorrecta.');
            }
        } catch (err) {
            console.error(err);
            alert('Error al conectar con Supabase.');
        }
    });

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('vortex_user');
        appScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    });

    btnToggleFlota.addEventListener('click', () => flotaFlotante.classList.toggle('hidden'));
    cerrarFlotante.addEventListener('click', () => flotaFlotante.classList.add('hidden'));

    btnAdminPanel.addEventListener('click', () => {
        adminModal.classList.remove('hidden');
        cargarDatosCrudUnidades();
        cargarDatosCrudConductores();
        cargarDatosEnganches();
    });

    cerrarAdminModal.addEventListener('click', () => adminModal.classList.add('hidden'));

    function activarSesion(user) {
        localStorage.setItem('vortex_user', JSON.stringify(user));
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        const nombreMostrar = user.NOMBRE || user.nombre || user.USUARIO || 'Usuario';
        const esAdmin = (user.USUARIO === 'RCARRANZA' || user.rol === 'ADMIN' || user.ROL === 'ADMIN');
        userBadge.textContent = `${nombreMostrar} (${esAdmin ? 'ADMIN' : 'PROGRAMADOR'})`;

        if (esAdmin) {
            btnAdminPanel.classList.remove('hidden');
        } else {
            btnAdminPanel.classList.add('hidden');
        }

        cargarTableroFlotaYAsignaciones();
    }
});

// CARGAR FLOTA Y GANTT DESDE SUPABASE (ASIGNACIONES BASE)
async function cargarTableroFlotaYAsignaciones() {
    try {
        const { data: asignaciones, error } = await supabaseClient
            .from('asignaciones_base')
            .select(`
                id,
                conductor:conductor_dni (dni, conductor, telefono),
                tracto:tracto_codigo (codigo_interno, placa, tipo),
                carreta:carreta_codigo (codigo_interno, placa, tipo)
            `)
            .eq('activo', true);

        if (error) {
            console.warn("No se pudieron cargar asignaciones base, usando datos simulados", error);
            renderizarFlotaYCalendario([]);
            return;
        }

        renderizarFlotaYCalendario(asignaciones || []);
    } catch (e) {
        console.error(e);
    }
}

function renderizarFlotaYCalendario(listaAsignaciones) {
    const contenedorFlota = document.getElementById('lista-unidades-disponibles');
    contenedorFlota.innerHTML = '';

    if (listaAsignaciones.length === 0) {
        contenedorFlota.innerHTML = `<div class="text-xs text-slate-400 p-3 text-center">No hay unidades enganchadas. Configure los enganches en el Panel Admin.</div>`;
        renderGanttGrid([]);
        return;
    }

    listaAsignaciones.forEach(asig => {
        const unidadObj = {
            id: asig.id,
            conductor: asig.conductor?.conductor || 'Sin Conductor',
            tracto: asig.tracto?.placa || 'S/Tracto',
            carreta: asig.carreta?.placa || 'S/Carreta',
            tipoCarreta: asig.carreta?.tipo || ''
        };

        const card = document.createElement('div');
        card.className = 'draggable-card bg-slate-900 border border-slate-700 p-3 rounded-lg shadow cursor-pointer hover:border-blue-500';
        card.setAttribute('draggable', 'true');
        card.innerHTML = `
            <div class="font-bold text-xs text-blue-400">${unidadObj.conductor}</div>
            <div class="text-xs text-slate-400 mt-1 flex justify-between">
                <span>Tracto: <strong>${unidadObj.tracto}</strong></span>
                <span>Carreta: <strong>${unidadObj.carreta}</strong></span>
            </div>
        `;

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify(unidadObj));
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        contenedorFlota.appendChild(card);
    });

    renderGanttGrid(listaAsignaciones);
}

function renderGanttGrid(asignaciones) {
    const tbody = document.getElementById('gantt-tbody');
    tbody.innerHTML = '';

    if (asignaciones.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 text-xs">Sin flota disponible en el calendario.</td></tr>`;
        return;
    }

    asignaciones.forEach(asig => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-700/50';

        const conductorNombre = asig.conductor?.conductor || 'S/Chofer';
        const tractoPlaca = asig.tracto?.placa || '';
        const carretaPlaca = asig.carreta?.placa || '';

        const tdInfo = document.createElement('td');
        tdInfo.className = 'p-3 border-b border-slate-700 bg-slate-900/40 text-xs';
        tdInfo.innerHTML = `
            <div class="font-bold text-slate-200">${conductorNombre}</div>
            <div class="text-slate-400 text-[10px]">Tr: ${tractoPlaca} | Cr: ${carretaPlaca}</div>
        `;
        tr.appendChild(tdInfo);

        const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
        dias.forEach(dia => {
            const tdCell = document.createElement('td');
            tdCell.className = 'droppable-cell p-2 border-b border-slate-700 h-20 align-top relative';

            tdCell.addEventListener('dragover', (e) => {
                e.preventDefault();
                tdCell.classList.add('drag-over');
            });
            tdCell.addEventListener('dragleave', () => tdCell.classList.remove('drag-over'));
            tdCell.addEventListener('drop', (e) => {
                e.preventDefault();
                tdCell.classList.remove('drag-over');
                const dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) return;
                const unidadData = JSON.parse(dataStr);

                const viajeTag = document.createElement('div');
                viajeTag.className = 'bg-blue-600/80 hover:bg-blue-500 text-white p-2 rounded text-xs shadow cursor-pointer';
                viajeTag.innerHTML = `
                    <div class="font-semibold">Viaje Asignado</div>
                    <div class="text-[10px] text-blue-200">Tr: ${unidadData.tracto}</div>
                    <span class="inline-block mt-1 px-1.5 py-0.5 bg-blue-900 text-[9px] rounded uppercase font-bold">Programado</span>
                `;
                tdCell.appendChild(viajeTag);
            });

            tr.appendChild(tdCell);
        });

        tbody.appendChild(tr);
    });
}

// GESTIÓN DE PESTAÑAS DEL PANEL ADMIN
function cambiarTabAdmin(tab) {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.add('hidden'));
    document.getElementById(`seccion-${tab}`).classList.remove('hidden');

    ['unidades', 'conductores', 'enganches'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (t === tab) {
            btn.className = 'px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold shadow';
        } else {
            btn.className = 'px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600';
        }
    });
}

// CRUD UNIDADES
async function cargarDatosCrudUnidades() {
    const tbody = document.getElementById('tabla-crud-unidades');
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">Cargando unidades...</td></tr>`;

    const { data, error } = await supabaseClient.from('unidades').select('*').order('codigo_interno');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-400">Error al cargar unidades</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    data.forEach(uni => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-700/30';
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-200">${uni.codigo_interno}</td>
            <td class="p-3 text-slate-300">${uni.placa || '-'}</td>
            <td class="p-3 text-slate-300">${uni.tipo}</td>
            <td class="p-3 text-slate-300">${uni.marca || '-'}</td>
            <td class="p-3 text-right">
                <button onclick="eliminarUnidad('${uni.codigo_interno}')" class="bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded text-[10px]">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('form-unidad').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo_interno = document.getElementById('uni-codigo').value.trim();
    const placa = document.getElementById('uni-placa').value.trim();
    const tipo = document.getElementById('uni-tipo').value;
    const marca = document.getElementById('uni-marca').value.trim();

    const { error } = await supabaseClient.from('unidades').insert([{ codigo_interno, placa, tipo, marca }]);
    if (error) {
        alert('Error al guardar unidad: ' + error.message);
    } else {
        alert('Unidad guardada exitosamente.');
        document.getElementById('form-unidad').reset();
        cargarDatosCrudUnidades();
    }
});

async function eliminarUnidad(codigo) {
    if (!confirm(`¿Eliminar la unidad ${codigo}?`)) return;
    const { error } = await supabaseClient.from('unidades').delete().eq('codigo_interno', codigo);
    if (error) alert('Error al eliminar: ' + error.message);
    else cargarDatosCrudUnidades();
}

// CRUD CONDUCTORES
async function cargarDatosCrudConductores() {
    const tbody = document.getElementById('tabla-crud-conductores');
    tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400">Cargando conductores...</td></tr>`;

    const { data, error } = await supabaseClient.from('conductores').select('*').order('conductor');
    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-400">Error al cargar conductores</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    data.forEach(cond => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-700/30';
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-200">${cond.dni}</td>
            <td class="p-3 text-slate-300">${cond.conductor}</td>
            <td class="p-3 text-slate-300">${cond.licencia_conductor || '-'}</td>
            <td class="p-3 text-slate-300">${cond.telefono || '-'}</td>
            <td class="p-3 text-right">
                <button onclick="eliminarConductor('${cond.dni}')" class="bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded text-[10px]">Eliminar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('form-conductor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dni = document.getElementById('cond-dni').value.trim();
    const conductor = document.getElementById('cond-nombre').value.trim();
    const licencia_conductor = document.getElementById('cond-licencia').value.trim();
    const telefono = document.getElementById('cond-telefono').value.trim();

    const { error } = await supabaseClient.from('conductores').insert([{ dni, conductor, licencia_conductor, telefono }]);
    if (error) {
        alert('Error al guardar conductor: ' + error.message);
    } else {
        alert('Conductor guardado exitosamente.');
        document.getElementById('form-conductor').reset();
        cargarDatosCrudConductores();
    }
});

async function eliminarConductor(dni) {
    if (!confirm(`¿Eliminar al conductor DNI ${dni}?`)) return;
    const { error } = await supabaseClient.from('conductores').delete().eq('dni', dni);
    if (error) alert('Error al eliminar: ' + error.message);
    else cargarDatosCrudConductores();
}

// ASIGNACIONES Y ENGANCHES
async function cargarDatosEnganches() {
    // Cargar selectores
    const selectCond = document.getElementById('eng-conductor');
    const selectTracto = document.getElementById('eng-tracto');
    const selectCarreta = document.getElementById('eng-carreta');

    selectCond.innerHTML = '<option value="">Seleccionar Conductor...</option>';
    selectTracto.innerHTML = '<option value="">Seleccionar Tracto...</option>';
    selectCarreta.innerHTML = '<option value="">Seleccionar Carreta...</option>';

    const { data: conds } = await supabaseClient.from('conductores').select('dni, conductor').order('conductor');
    if (conds) conds.forEach(c => selectCond.innerHTML += `<option value="${c.dni}">${c.conductor}</option>`);

    const { data: unis } = await supabaseClient.from('unidades').select('codigo_interno, placa, tipo').order('codigo_interno');
    if (unis) {
        unis.forEach(u => {
            if (u.tipo === 'TRACTO') {
                selectTracto.innerHTML += `<option value="${u.codigo_interno}">${u.placa} (${u.codigo_interno})</option>`;
            } else {
                selectCarreta.innerHTML += `<option value="${u.codigo_interno}">${u.placa} - ${u.tipo}</option>`;
            }
        });
    }

    // Cargar tabla de enganches existentes
    const tbody = document.getElementById('tabla-crud-enganches');
    tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400">Cargando enganches...</td></tr>`;

    const { data: asigs, error } = await supabaseClient
        .from('asignaciones_base')
        .select(`
            id,
            conductor:conductor_dni (conductor),
            tracto:tracto_codigo (placa),
            carreta:carreta_codigo (placa, tipo)
        `);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-red-400">Error al cargar enganches</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    asigs.forEach(asig => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-700/30';
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-200">${asig.conductor?.conductor || 'N/D'}</td>
            <td class="p-3 text-slate-300">${asig.tracto?.placa || 'N/D'}</td>
            <td class="p-3 text-slate-300">${asig.carreta?.placa || 'N/D'} (${asig.carreta?.tipo || ''})</td>
            <td class="p-3 text-right">
                <button onclick="eliminarEnganche('${asig.id}')" class="bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded text-[10px]">Desenganchar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('form-enganche').addEventListener('submit', async (e) => {
    e.preventDefault();
    const conductor_dni = document.getElementById('eng-conductor').value;
    const tracto_codigo = document.getElementById('eng-tracto').value;
    const carreta_codigo = document.getElementById('eng-carreta').value;

    const { error } = await supabaseClient.from('asignaciones_base').insert([{
        conductor_dni,
        tracto_codigo,
        carreta_codigo,
        activo: true
    }]);

    if (error) {
        alert('Error al enganchar: ' + error.message);
    } else {
        alert('Unidad enganchada correctamente.');
        cargarDatosEnganches();
        cargarTableroFlotaYAsignaciones();
    }
});

async function eliminarEnganche(id) {
    if (!confirm('¿Desea desenganchar esta unidad?')) return;
    const { error } = await supabaseClient.from('asignaciones_base').delete().eq('id', id);
    if (error) alert('Error: ' + error.message);
    else {
        cargarDatosEnganches();
        cargarTableroFlotaYAsignaciones();
    }
}
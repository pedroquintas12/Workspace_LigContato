let userRole = ""; // Será definido pelo backend ao carregar a página.

function getStatusBadge(status) {
    if (status === "L") return '<span class="badge bg-warning text-dark">LENDO-VSAP</span>';
    if (status === "F") return '<span class="badge bg-success">FINALIZADO</span>';
    if (status === "Em andamento") return '<span class="badge bg-info text-dark">EM ANDAMENTO</span>';
    return status;
}

function parseDate(dateString) {
    const [day, month, year, hour, minute, second] = dateString.split(/[\s\/:]/);
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
}

function calculateElapsedTime(startTime) {
    const start = parseDate(startTime);
    const now = new Date();
    const elapsedMs = now - start;

    if (isNaN(start.getTime()) || elapsedMs < 0) return "Tempo inválido";

    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
}

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("toggle-btn");
    const mainContent = document.getElementById("main-content");

    const closeShiftButton = document.getElementById('close-shift-btn');
    closeShiftButton.addEventListener('click', () => {
        bloquearAcesso(); // Bloqueia o acesso quando o turno é fechado
    });

    // Botão para abrir turno
    const openShiftButton = document.getElementById('open-shift-btn');
    openShiftButton.addEventListener('click', () => {
        desbloquearAcesso(); // Desbloqueia o acesso quando o turno é aberto
    });

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        mainContent.classList.toggle("shifted");
    });

    const streamTableBody = document.getElementById("stream-table-body");
    const logsTableBody = document.getElementById("logs-table-body");

    const eventSource = new EventSource("/api/actions/stream");
    const listSource = new EventSource("/api/actions/stream_listar");

    eventSource.onmessage = event => {
        const data = JSON.parse(event.data);
        streamTableBody.innerHTML = data.map(action => {
            const elapsedTime = action.fim ? "-" : calculateElapsedTime(action.inicio);
            const status = action.fim ? action.fim : "Em andamento";

            return `
                <tr>
                    <td>${action.ID_log}</td>
                    <td>${action.username}</td>
                    <td>${action.estado}</td>
                    <td>${action.diario}</td>
                    <td>${getStatusBadge(action.status)}</td>
                    <td>${action.inicio}</td>
                    <td>${getStatusBadge(status)}</td>
                    <td>${elapsedTime}</td>
                </tr>
            `;
        }).join("");
    };
    listSource.onmessage = event => {
        const list = JSON.parse(event.data);
        logsTableBody.innerHTML = list.map(log => {
            const elapsedTime = log.fim ? "-" : calculateElapsedTime(log.inicio);
            const status = log.fim ? log.fim : "Em andamento";

            console.log(list); // Apenas para debugar os dados recebidos

            return `
                <tr>
                    <td>${log.ID_log}</td>
                    <td>${log.username}</td>
                    <td>${log.estado}</td>
                    <td>${log.diario}</td>
                    <td>${getStatusBadge(log.status)}</td>
                    <td>${log.inicio}</td>
                    <td>${getStatusBadge(status)}</td>
                </tr>
            `;
        }).join("");
    };

    // Função para bloquear o acesso
    async function bloquearAcesso() {
        try {
            const response = await fetch('/api/bloquear_acesso', {
                method: 'GET',
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: result.message,
                    showConfirmButton: false,
                    timer: 5000,
                    position: 'top-end',
                    toast: true,
                    background: '#28a745',
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro!',
                    text: result.message,
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: "erro ao fechar turno!",
            });
        }
    }

    // Função para desbloquear o acesso
    async function desbloquearAcesso() {
        try {
            const response = await fetch('/api/desbloquear_acesso', {
                method: 'GET',
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: result.message,
                    showConfirmButton: false,
                    timer: 5000,
                    position: 'top-end',
                    toast: true,
                    background: '#28a745',
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro!',
                    text: result.message,
                });
            }
        } catch (err) {
            console.error('Erro ao desbloquear o acesso:', err);
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Erro ao enviar a requisição. Tente novamente.',
            });
        }
    }


});
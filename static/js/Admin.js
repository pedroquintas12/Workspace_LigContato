import { fetchWithAuth } from './auth.js';

let activeLogs = [];
let currentPage = 1; // Página inicial
let totalPages = 1; // Total de páginas (será atualizado pela API)
const perPage = 10; // Registros por página

function getStatusBadge(status) {
    if (status === "L") return '<span class="badge bg-warning text-dark">LENDO-VSAP</span>';
    if (status === "F") return '<span class="badge bg-success">FINALIZADO</span>';
    if (status === "Em andamento") return '<span class="badge bg-info text-dark">EM ANDAMENTO</span>';
    return status;
}

function parseDate(dateString) {
    const [day, month, year, hour, minute, second] = dateString.split(/[/\s:]/);
    return new Date(`${year}-${month}-${day} ${hour}:${minute}:${second}`);
}

function calculateElapsedTime(startTime) {
    const start = parseDate(startTime);
    const now = new Date();
    const elapsedMs = now - start;

    if (isNaN(start.getTime()) || elapsedMs < 0) return "Tempo inválido";

    const hours = Math.floor(elapsedMs / 3600000); // 1 hora = 3600000 ms
    const minutes = Math.floor((elapsedMs % 3600000) / 60000); // Minutos restantes
    const seconds = Math.floor((elapsedMs % 60000) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
}

function updateElapsedTime() {
    document.querySelectorAll("#stream-table-body tr").forEach(row => {
        const logId = row.cells[0].textContent;
        const log = activeLogs.find(l => l.ID_log == logId);
        if (log && !log.fim) {
            row.cells[7].textContent = calculateElapsedTime(log.inicio);
        }
    });
}
function formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours}h ${minutes}m ${secs}s`;
}
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("toggle-btn");
    const mainContent = document.getElementById("main-content");
    const closeBtn = document.getElementById("close-shift-btn");
    const openBtn = document.getElementById("open-shift-btn")
    const logsTableBody = document.getElementById("logs-table-body");
    const prevPageBtn = document.getElementById("prev-page");
    const nextPageBtn = document.getElementById("next-page");
    const pageInfo = document.getElementById("page-info");
    const streamTableBody = document.getElementById("stream-table-body");

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        mainContent.classList.toggle("shifted");
    });

    closeBtn.addEventListener("click", () => {
            bloquearAcesso()
    });

    openBtn.addEventListener("click", () => {
        desbloquearAcesso()
    });




    const eventSource = new EventSource("/api/actions/stream");

    eventSource.onmessage = event => {
        const data = JSON.parse(event.data);
        activeLogs = data;

        streamTableBody.innerHTML = data.map(action => {
            const complementoCheckbox = `
            <input type="checkbox" class="form-check-input"${action.complemento ? "checked" : ""} disabled>
        `;
            const elapsedTime = action.fim ? "-" : calculateElapsedTime(action.inicio);
            const status = action.fim ? action.fim : "Em andamento";
            console.log("Tempo decorrido: " + action.elapsedTime)
            console.log("tempo de incio " + action.inicio)
            console.log("tempo de fim " + action.fim)
            return `
                <tr>
                    <td>${action.ID_log}</td>
                    <td>${action.username}</td>
                    <td>${action.estado}</td>
                    <td>${action.diario}</td>
                    <td>${complementoCheckbox}</td>
                    <td>${getStatusBadge(action.status)}</td>
                    <td>${action.inicio}</td>
                    <td>${elapsedTime}</td>
                </tr>
            `;
        }).join("");
    };

    setInterval(updateElapsedTime, 1000);
// Função para buscar os dados paginados
    async function fetchLogs(page) {
        try {
            const response = await fetchWithAuth(`/api/actions/stream_listar?page=${page}&per_page=${perPage}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error("Erro ao carregar os dados");
            }

            // Atualiza as variáveis de controle da páginação
            currentPage = result.current_page;
            totalPages = result.total_pages;

            // Atualiza a tabela com os novos dados
            logsTableBody.innerHTML = result.data.map(log => {
                const complementoCheckbox = `<input type="checkbox" class="form-check-input" ${log.complemento ? "checked" : ""} disabled>`;
                const status = log.fim ? log.fim : "Em andamento";
                return `
                    <tr>
                        <td>${log.ID_log}</td>
                        <td>${log.username}</td>
                        <td>${log.estado}</td>
                        <td>${log.diario}</td>
                        <td>${complementoCheckbox}</td>
                        <td>${getStatusBadge(log.status)}</td>
                        <td>${log.inicio}</td>
                        <td>${getStatusBadge(status)}</td>
                        <td>${formatElapsedTime(log.tempo_decorrido)}</td>
                    </tr>
                `;
            }).join("");

            // Atualiza os botões de navegação
            updatePaginationControls();

        } catch (error) {
            console.error("Erro ao buscar os logs:", error);
        }
    }

    // Atualiza os botões de paginação
    function updatePaginationControls() {
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    // Eventos dos botões de paginação
    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            fetchLogs(currentPage - 1);
        }
    });

    nextPageBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            fetchLogs(currentPage + 1);
        }
    });

    // Carrega a primeira página ao iniciar
    fetchLogs(currentPage);
    });

    // Função para bloquear o acesso
    async function bloquearAcesso() {
        try {
            const response = await fetchWithAuth('/api/bloquear_acesso', {
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
            const response = await fetchWithAuth('/api/desbloquear_acesso', {
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


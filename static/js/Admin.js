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

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        mainContent.classList.toggle("shifted");
    });

    const streamTableBody = document.getElementById("stream-table-body");
    const logsTableBody = document.getElementById("logs-table-body");
    const closeShiftButton = document.getElementById("close-shift-btn");

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

    if (userRole === "FUNC") closeShiftButton.classList.add("disabled");

    closeShiftButton.addEventListener("click", () => {
        if (!closeShiftButton.classList.contains("disabled")) {
            fetch("/api/actions/finalizar", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "F" })
            })
                .then(res => res.json())
                .then(data => alert(data.message))
                .catch(err => console.error("Erro ao fechar turno:", err));
        }
    });

});
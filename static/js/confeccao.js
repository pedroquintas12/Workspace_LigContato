import { fetchWithAuth } from './auth.js';


function getStatuslogin(status) {
    if (status === "L") return '<span class="badge bg-success">LIBERADO</span>';
    if (status === "B") return '<span class="badge bg-danger">BLOQUEADO</span>';
    return status;
}

function getCookie(name) {
    const cookies = document.cookie.split("; "); // Divide os cookies em pares chave=valor
    for (let cookie of cookies) {
        const [key, value] = cookie.split("="); // Separa a chave do valor
        if (key === name) {
            return decodeURIComponent(value); // Decodifica valores que tenham caracteres especiais
        }
    }
    return null; // Retorna null se o cookie não for encontrado
}
const toke = getCookie("api.token")

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("user-table-body");
    const errorMessage = document.getElementById("error-message");
    const loadingSpinner = document.getElementById("loading-spinner");


    console.log(toke)
    // Exibir o carregamento
    loadingSpinner.classList.remove("d-none");

    fetch("http://api.ligcontato.com.br:8881/api/users", {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${toke}`             
        },
        credentials: 'include'
     })
    .then(response => {
        if (!response.ok) {
            throw new Error("Erro ao carregar os dados: " + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        // Limpa a tabela antes de adicionar novos dados
        tableBody.innerHTML = "";

        data.forEach(user => {
            const row = document.createElement("tr");
            row.setAttribute("id", `${user.ID_auth}`); 
            row.innerHTML = `
                <td>${String(user.cod_escritorio).padStart(3, '0')}</td>
                <td>${user.username}</td>
                <td>${getStatuslogin(user.status)}
            `;

            // Adiciona evento de clique para abrir os detalhes do usuário
            row.addEventListener("click", () => sendUserId(user.ID_auth));

            tableBody.appendChild(row);
        });

        // Esconde o spinner de carregamento
        loadingSpinner.classList.add("d-none");
    })
    .catch(error => {
        console.error("Erro ao buscar os usuários:", error);
        errorMessage.textContent = error.message;
        errorMessage.classList.remove("d-none");
        loadingSpinner.classList.add("d-none");
    });
});


function sendUserId(userId) {

    fetchWithAuth(`http://api.ligcontato.com.br:8881/api/users/${userId}/detail`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${toke}`             

        },
        credentials: 'include',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Erro ao enviar o ID: " + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log(data)
        showUserDetails(data);  // Passa os detalhes do usuário para a função showUserDetails
    })
    .catch(error => {
        console.error("Erro ao enviar o ID do usuário:", error);
        alert("Erro ao selecionar usuário.");
    });
}

function showUserDetails(userArray) {
    if (!userArray || userArray.length === 0) {
        console.error("Usuário não encontrado ou resposta inválida.");
        alert("Usuário não encontrado.");
        return;
    }

    const user = userArray[0]; // Pegando o primeiro item do array

    Swal.fire({
        title: `Detalhes de ${user.username}`,
        html: `
            <p><strong>ID:</strong> ${user.ID_auth}</p>
            <p><strong>ID Token:</strong> ${user.ID_token}</p>
            <p><strong>Último Login:</strong> ${user.lastLogin}</p>
            <p><strong>Saldo de Confecção:</strong> ${user.Saldo}<p>
            <p><strong>Limite de confecção Atual:</strong> ${user.limiteConfeccao}<p>
            <p><strong>Limite de Confecção para:</strong> 
                <input type="number" id="limiteInput" value="" min="1">
            </p>
            <button id="verHistorico" class="swal2-confirm swal2-styled" style="margin-right: 10px;">📜 Ver Histórico</button>
            <button id="bloquearUsuario" class="swal2-cancel swal2-styled" style="background-color: red;">🚫 Bloquear</button>
        `,
        showCancelButton: true,
        confirmButtonText: "Salvar Alterações",
        cancelButtonText: "Fechar",
        preConfirm: () => {
            const novoLimite = document.getElementById("limiteInput").value;
            return updateUserLimit(user.ID_auth, novoLimite);
        }
    });

    // Event Listener para puxar o histórico
    document.getElementById("verHistorico").addEventListener("click", () => {
        fetchUserHistory(user.ID_auth);
    });

    // Event Listener para bloquear o usuário
    document.getElementById("bloquearUsuario").addEventListener("click", () => {
        bloquearUsuario(user.ID_auth, user.username);
    });
}



function updateUserLimit(userId, newLimit) {
    return fetchWithAuth(`http://192.168.1.8:8000/api/users/${userId}/update_limit`, {
        method: "PATCH",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limiteConfeccao: newLimit })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Erro ao atualizar limite.");
        }
        return response.json();
    })
    .then(() => {
        Swal.fire({
            icon: "success",
            title: "Atualizado com sucesso!",
            text: "O limite de confecção foi atualizado.",
        });
    })
    .catch(error => {
        Swal.fire({
            icon: "error",
            title: "Erro",
            text: error.message,
        });
    });
}


function fetchUserHistory(userId) {
    // Mostra o spinner enquanto carrega os dados
    const spinner = document.getElementById("loading-spinner");
    spinner.classList.remove("d-none");
    
    fetchWithAuth(`http://api.ligcontato.com.br:8881/api/users/${userId}/history`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json',
                    'Authorization': `Bearer ${toke}`             
                    },
        credentials: 'include'

    })
    
    .then(response => {
        if (!response.ok) {
            throw new Error("Erro ao puxar histórico.");
        }
        return response.json();
    })
    .then(historyData => {
        showHistoryModal(userId, historyData);
    })
    .catch(error => {
        Swal.fire({
            icon: "error",
            title: "Erro",
            text: error.message,
        });
    })
    .finally(() => {
        // Esconde o spinner quando o carregamento for concluído
        spinner.classList.add("d-none");
    });
}


function bloquearUsuario(userId, username) {
    Swal.fire({
        title: `Tem certeza que deseja bloquear ${username}?`,
        text: "O usuário não poderá mais acessar o sistema.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Sim, bloquear!",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            fetchWithAuth(`http://192.168.1.8:8000/api/users/${userId}/block`, {
                method: "PATCH",
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Erro ao bloquear usuário.");
                }
                return response.json();
            })
            .then(() => {
                Swal.fire({
                    icon: "success",
                    title: "Usuário bloqueado!",
                    text: `${username} foi bloqueado com sucesso.`,
                });
            })
            .catch(error => {
                Swal.fire({
                    icon: "error",
                    title: "Erro",
                    text: error.message,
                });
            });
        }
    });
}



function showHistoryModal(userId, historyData) {
    let historyHtml = `
        <p style="font-size: 14px; font-style: italic; color: gray;">(Exibindo registros disponíveis)</p>
        <label for="startDate">Data Início:</label>
        <input type="date" id="startDate" class="swal2-input">
        <label for="endDate">Data Final:</label>
        <input type="date" id="endDate" class="swal2-input">
        <button id="filterHistory" class="swal2-confirm swal2-styled">🔍 Filtrar</button>
        <br><br>
        <table class="table table-bordered table-striped">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Ação</th>
                </tr>
            </thead>
            <tbody id="historyTableBody">
    `;

    if (historyData.length === 0) {
        historyHtml += "<tr><td colspan='2'>Sem histórico disponível.</td></tr>";
    } else {
        historyData.forEach(entry => {
            historyHtml += `
                <tr>
                    <td>${entry.data}</td>
                    <td>${entry.peca}</td>
                </tr>
            `;
        });
    }

    historyHtml += "</tbody></table>";

    Swal.fire({
        title: "Histórico do Usuário",
        html: historyHtml,
        icon: "info",
        confirmButtonText: "Fechar",
        width: '80%',
        didOpen: () => {
            // Certificar-se de que o botão de filtro existe
            const filterButton = document.getElementById("filterHistory");
            if (filterButton) {
                filterButton.addEventListener("click", () => {
                    filterHistory(historyData);
                });
            }
        }
    });
}

function filterHistory(historyData) {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    // Filtrar os dados com base nas datas selecionadas
    const filteredData = historyData.filter(entry => {
        const entryDate = new Date(entry.data);
        const start = new Date(startDate);
        const end = new Date(endDate);

        return entryDate >= start && entryDate <= end;
    });

    // Mostrar o histórico filtrado
    showFilteredHistory(filteredData);
}


function showFilteredHistory(filteredData) {
    const historyTableBody = document.getElementById("historyTableBody");
    historyTableBody.innerHTML = ""; // Limpa a tabela antes de adicionar os novos dados

    if (filteredData.length === 0) {
        historyTableBody.innerHTML = "<tr><td colspan='2'>Nenhum registro encontrado.</td></tr>";
    } else {
        filteredData.forEach(entry => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${entry.data}</td>
                <td>${entry.peca}</td>
            `;
            historyTableBody.appendChild(row);
        });
    }
}

// Evento para o botão de adicionar
document.getElementById('addButton').addEventListener('click', function () {
    Swal.fire({
        title: 'Cadastrar Escritório',
        html:
            '<input id="codEscritorio" class="swal2-input" placeholder="Código do Escritório">' +
            '<input id="limiteConfeccao" class="swal2-input" placeholder="Limite de Confecção" type="number">',
        showCancelButton: true,
        confirmButtonText: 'Registrar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const codEscritorio = document.getElementById('codEscritorio').value;
            const limiteConfeccao = document.getElementById('limiteConfeccao').value;
            
            if (!codEscritorio || !limiteConfeccao) {
                Swal.showValidationMessage('Por favor, preencha todos os campos!');
                return false;
            }

            // Envia a requisição para a API
            return fetchWithAuth('http://api.ligcontato.com.br:8881/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${toke}`             
                },
                body: JSON.stringify({
                    codigo_escritorio: codEscritorio,
                    limite_confeccoes: limiteConfeccao
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Swal.fire('Sucesso!', data.message , 'success');
                } else {
                    Swal.fire('Erro!', data.erro , 'error');
                }
            })
            .catch(error => {
                Swal.fire({
                    icon: "error",
                    title: "Erro",
                    text: error.message,
                });
            })
        }
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const toggleButton = document.getElementById("toggle-btn");

    toggleButton.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        mainContent.classList.toggle("shifted");
    });
});

export async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, options);

    // Se a resposta for 401 (não autorizado), mostrar alerta e redirecionar
    if (response.status === 401) {
        const data = await response.json();
        Swal.fire({
            title: "Sessão Expirada!",
            text: data.error || "Sua sessão expirou. Faça login novamente.",
            icon: "warning",
            confirmButtonText: "OK"
        }).then(() => {
            window.location.href = "/signin";
        });
        return;
    }

    if (response.redirected) {
        window.location.href = response.url;
        return;
    }
    

    try {
        return response;
    } catch (error) {
        throw new Error("Erro ao processar resposta do servidor.");
    }
}
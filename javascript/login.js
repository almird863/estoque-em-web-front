const botaoGoogle = document.getElementById("botao-google");
const erroLogin = document.getElementById("erro-login");

function mostrarErro(texto) {
    erroLogin.textContent = texto;
    erroLogin.hidden = false;
}

function esconderErro() {
    erroLogin.hidden = true;
    erroLogin.textContent = "";
}

// Pergunta ao servidor se já existe uma sessão válida (cookie) neste navegador
async function sessaoValida() {
    try {
        const resposta = await fetch(`${url_server}/api/usuarios/eu`, { credentials: "include" });
        return resposta.ok;
    } catch {
        return false;
    }
}

// O Google chama esta função quando a pessoa escolhe a conta.
// resposta.credential é um token que PROVA a identidade; o servidor o confere com o Google.
async function aoReceberCredencial(resposta) {
    esconderErro();

    try {
        const retorno = await fetch(`${url_server}/api/usuarios/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // permite o servidor gravar o cookie de sessão
            body: JSON.stringify({ credencial: resposta.credential }),
        });

        const corpo = await retorno.json().catch(() => ({}));
        if (!retorno.ok) {
            throw new Error(corpo.erro || `Erro ${retorno.status}`);
        }

        // Confere se o navegador guardou o cookie, senão a próxima página mandaria de volta para cá
        if (!(await sessaoValida())) {
            throw new Error(
                "O navegador bloqueou o cookie de sessão. Isso acontece no Safari e em todos os navegadores do iPhone (que usam o motor do Safari). Use um computador ou um celular Android, ou desative o bloqueio de cookies entre sites."
            );
        }

        window.location.href = "index.html";
    } catch (erro) {
        mostrarErro(
            erro instanceof TypeError
                ? "Não foi possível conectar ao servidor. Se ele estava parado, pode levar até 1 minuto para acordar: aguarde e tente de novo. Se persistir, abra o console (F12) para ver o motivo."
                : erro.message
        );
        console.error(erro);
    }
}

function iniciarBotaoGoogle() {
    if (GOOGLE_CLIENT_ID.includes("486979187580-8uu48jbd8tcino2u5ie0rhktqbfcd3pa.apps.googleusercontent.com")) {
        mostrarErro("Falta configurar o Client ID do Google em javascript/config.js.");
        return;
    }
    if (typeof google === "undefined") {
        mostrarErro("Não foi possível carregar o login do Google. Verifique a sua conexão.");
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: aoReceberCredencial,
    });

    // O próprio Google desenha o botão oficial
    google.accounts.id.renderButton(botaoGoogle, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        locale: "pt-BR",
        width: 280,
    });
}

async function iniciar() {
    // O botão aparece na hora; a conferência da sessão roda ao mesmo tempo.
    // (O servidor gratuito do Render dorme quando fica parado e pode levar cerca de um minuto
    // para responder; a pessoa não precisa esperar para ver o botão.)
    iniciarBotaoGoogle();

    // Quem já está logado vai direto para o sistema
    if (await sessaoValida()) {
        window.location.replace("index.html");
    }
}

// O script do Google carrega de forma assíncrona; esperamos a página inteira carregar
window.addEventListener("load", iniciar);
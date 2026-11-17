const url_server = "http://localhost:3000";

/* ---------- Referências ao HTML ---------- */
const corpoTabela = document.getElementById("corpo-tabela");
const totalItens = document.getElementById("titulo-total-items");
const estoqueBaixo = document.getElementById("titulo-estoque-baixo");

const botaoAdicionar = document.getElementById("btn-adicionar");
const dialogoProduto = document.getElementById("dialogo-produto");
const formProduto = document.getElementById("form-produto");
const erroProduto = document.getElementById("erro-produto");
const botaoSalvar = document.getElementById("btn-salvar");
const botaoCancelar = document.getElementById("btn-cancelar");
const tituloDialogo = document.getElementById("titulo-dialogo");
const botaoExcluir = document.getElementById("btn-excluir");

// Guarda os produtos carregados (para preencher o formulário ao editar)
const produtosPorId = new Map();

// null = cadastrando um produto novo | id = editando esse produto
let produtoEditandoId = null;

// Controla o "toque de novo para confirmar" do botão Excluir
let temporizadorConfirmacao = null;

// Respeita quem desativou animações no sistema
const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Comunicação com o servidor ---------- */
async function buscarJSON(url) {
    const resposta = await fetch(url);
    if (!resposta.ok) {
        throw new Error(`Erro ${resposta.status} ao buscar ${url}`);
    }
    return resposta.json();
}

async function enviarJSON(url, metodo, dados) {
    const resposta = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
    });

    // O servidor responde { erro: "..." } quando algo está errado
    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(corpo.erro || `Erro ${resposta.status}`);
    }
    return corpo;
}

/* ---------- Tabela e resumo ---------- */
function criarCelula(texto) {
    const td = document.createElement("td");
    td.textContent = texto; // textContent evita injeção de HTML
    return td;
}

// animar: linhas entram uma após a outra | destacar: linha recém-cadastrada pisca em verde
function criarLinha(produto, { indice = 0, animar = false, destacar = false } = {}) {
    const tr = document.createElement("tr");
    tr.dataset.id = produto._id;

    if (animar) {
        tr.classList.add("entrada");
        tr.style.setProperty("--i", Math.min(indice, 12)); // limita o atraso nas listas grandes
    }
    if (destacar) {
        tr.classList.add("destaque");
    }

    const tdQtd = criarCelula(produto.quantidade);
    if (produto.estoqueBaixo) {
        tdQtd.classList.add("estoque-baixo");
    }

    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Editar";
    botao.dataset.id = produto._id;
    botao.setAttribute("aria-label", `Editar ${produto.nome}`);

    const tdAcoes = document.createElement("td");
    tdAcoes.append(botao);

    tr.append(criarCelula(produto.codigo), criarCelula(produto.nome), tdQtd, tdAcoes);
    return tr;
}

function mostrarMensagem(texto) {
    const tr = document.createElement("tr");
    tr.className = "vazio";

    const td = criarCelula(texto);
    td.colSpan = 4;

    tr.append(td);
    corpoTabela.replaceChildren(tr);
}

function renderizarTabela(produtos, { animar = false, destacarId = null } = {}) {
    if (produtos.length === 0) {
        mostrarMensagem("Nenhum produto cadastrado ainda.");
        return;
    }

    const linhas = produtos.map((produto, indice) =>
        criarLinha(produto, { indice, animar, destacar: produto._id === destacarId })
    );
    corpoTabela.replaceChildren(...linhas);

    // Leva a tela até o produto novo (útil no celular, onde ele pode estar fora da vista)
    if (destacarId) {
        corpoTabela
            .querySelector(`tr[data-id="${destacarId}"]`)
            ?.scrollIntoView({ behavior: reduzirMovimento ? "auto" : "smooth", block: "center" });
    }
}

// Faz o número "subir" de 0 até o valor final, desacelerando no fim
function animarNumero(elemento, valorFinal, duracao = 700) {
    if (reduzirMovimento || !Number.isFinite(valorFinal) || valorFinal === 0) {
        elemento.textContent = valorFinal;
        return;
    }

    const inicio = performance.now();

    function passo(agora) {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const suavizado = 1 - Math.pow(1 - progresso, 3);
        elemento.textContent = Math.round(valorFinal * suavizado);

        if (progresso < 1) {
            requestAnimationFrame(passo);
        }
    }

    requestAnimationFrame(passo);
}

function renderizarResumo(resumo, { animar = false } = {}) {
    if (animar) {
        animarNumero(totalItens, resumo.totalProdutos);
        animarNumero(estoqueBaixo, resumo.estoqueBaixo);
    } else {
        totalItens.textContent = resumo.totalProdutos;
        estoqueBaixo.textContent = resumo.estoqueBaixo;
    }
}

// silencioso: true recarrega sem "Carregando…" e sem a animação de entrada (usado depois de salvar)
// destacarId: id do produto que deve receber o destaque
async function carregarEstoque({ silencioso = false, destacarId = null } = {}) {
    if (!silencioso) {
        mostrarMensagem("Carregando produtos…");
    }

    try {
        const [produtos, resumo] = await Promise.all([
            buscarJSON(`${url_server}/api/produtos`),
            buscarJSON(`${url_server}/api/resumo`),
        ]);

        produtosPorId.clear();
        produtos.forEach((produto) => produtosPorId.set(produto._id, produto));

        renderizarTabela(produtos, { animar: !silencioso, destacarId });
        renderizarResumo(resumo, { animar: !silencioso });
    } catch (erro) {
        console.error(erro);
        mostrarMensagem("Não foi possível carregar os produtos. Verifique se o servidor está rodando.");
        totalItens.textContent = "–";
        estoqueBaixo.textContent = "–";
    }
}

/* ---------- Cadastro de produto ---------- */
// TypeError = o fetch nem chegou ao servidor
function mensagemDeErro(erro) {
    return erro instanceof TypeError ? "Não foi possível conectar ao servidor." : erro.message;
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function mostrarErroFormulario(texto) {
    erroProduto.textContent = texto;
    erroProduto.hidden = false;
}

function esconderErroFormulario() {
    erroProduto.hidden = true;
    erroProduto.textContent = "";
}

// Sem argumento: abre vazio (cadastro). Com um produto: abre preenchido (edição).
function abrirDialogoProduto(produto = null) {
    formProduto.reset(); // volta aos valores iniciais (estoque mínimo = 10)
    esconderErroFormulario();

    produtoEditandoId = produto ? produto._id : null;
    botaoExcluir.hidden = !produto; // só aparece na edição
    cancelarConfirmacaoExclusao();
    tituloDialogo.textContent = produto ? `Editar produto ${produto.codigo}` : "Novo produto";
    botaoSalvar.textContent = produto ? "Salvar alterações" : "Salvar produto";

    if (produto) {
        formProduto.elements.nome.value = produto.nome;
        formProduto.elements.categoria.value = produto.categoria;
        formProduto.elements.quantidade.value = produto.quantidade;
        formProduto.elements.estoqueMinimo.value = produto.estoqueMinimo;
    }

    dialogoProduto.showModal();
}

function fecharDialogoProduto() {
    dialogoProduto.close();
}

async function salvarProduto(evento) {
    evento.preventDefault(); // impede o navegador de recarregar a página

    const dados = Object.fromEntries(new FormData(formProduto));

    esconderErroFormulario();
    botaoSalvar.disabled = true; // evita cadastrar duas vezes com cliques repetidos

    try {
        const editando = produtoEditandoId !== null;
        const url = editando
            ? `${url_server}/api/produtos/${produtoEditandoId}`
            : `${url_server}/api/produtos`;

        const produtoSalvo = await enviarJSON(url, editando ? "PUT" : "POST", dados);
        fecharDialogoProduto();
        await carregarEstoque({ silencioso: true, destacarId: produtoSalvo._id });
    } catch (erro) {
        mostrarErroFormulario(mensagemDeErro(erro));
    } finally {
        botaoSalvar.disabled = false;
    }
}

/* ---------- Exclusão de produto ---------- */
function cancelarConfirmacaoExclusao() {
    clearTimeout(temporizadorConfirmacao);
    botaoExcluir.classList.remove("confirmando");
    botaoExcluir.textContent = "Excluir produto";
}

async function excluirProduto() {
    // 1º toque: só pede confirmação (volta ao normal sozinho depois de 4 segundos)
    if (!botaoExcluir.classList.contains("confirmando")) {
        botaoExcluir.classList.add("confirmando");
        botaoExcluir.textContent = "Toque de novo para excluir";
        temporizadorConfirmacao = setTimeout(cancelarConfirmacaoExclusao, 4000);
        return;
    }

    // 2º toque: exclui de verdade
    clearTimeout(temporizadorConfirmacao);
    esconderErroFormulario();
    botaoExcluir.disabled = true;
    botaoSalvar.disabled = true;

    try {
        const id = produtoEditandoId;
        await enviarJSON(`${url_server}/api/produtos/${id}`, "DELETE");
        fecharDialogoProduto();

        // A linha desliza para fora antes de a lista ser recarregada
        corpoTabela.querySelector(`tr[data-id="${id}"]`)?.classList.add("saindo");
        await esperar(reduzirMovimento ? 0 : 350);

        await carregarEstoque({ silencioso: true });
    } catch (erro) {
        mostrarErroFormulario(mensagemDeErro(erro));
        cancelarConfirmacaoExclusao();
    } finally {
        botaoExcluir.disabled = false;
        botaoSalvar.disabled = false;
    }
}

// Seta, e não só a função, para o evento do clique não ser enviado como "produto"
botaoAdicionar.addEventListener("click", () => abrirDialogoProduto());

// Um único "ouvinte" na tabela atende todos os botões Editar, mesmo os criados depois
corpoTabela.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-id]");
    if (!botao) return;

    const produto = produtosPorId.get(botao.dataset.id);
    if (produto) {
        abrirDialogoProduto(produto);
    }
});
botaoCancelar.addEventListener("click", fecharDialogoProduto);
botaoExcluir.addEventListener("click", excluirProduto);
formProduto.addEventListener("submit", salvarProduto);

// Clicar fora da janela (no fundo escurecido) também fecha
dialogoProduto.addEventListener("click", (evento) => {
    if (evento.target === dialogoProduto) {
        fecharDialogoProduto();
    }
});

/* ---------- Início ---------- */
carregarEstoque();
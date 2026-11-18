// url_server vem de config.js (carregado antes deste arquivo)

/* ---------- Referências ao HTML ---------- */
// Usuário logado
const usuarioBarra = document.getElementById("usuario");
const usuarioFoto = document.getElementById("usuario-foto");
const usuarioNome = document.getElementById("usuario-nome");
const botaoSair = document.getElementById("btn-sair");

// Resumo e tabela
const corpoTabela = document.getElementById("corpo-tabela");
const totalItens = document.getElementById("titulo-total-items");
const estoqueBaixo = document.getElementById("titulo-estoque-baixo");

// Filtros
const formFiltros = document.getElementById("filtros");
const campoBusca = document.getElementById("busca");
const campoCategoria = formFiltros.elements.categoria;

// Janela: produto novo
const botaoAdicionar = document.getElementById("btn-adicionar");
const dialogoProduto = document.getElementById("dialogo-produto");
const formProduto = document.getElementById("form-produto");
const erroProduto = document.getElementById("erro-produto");
const botaoSalvar = document.getElementById("btn-salvar");
const botaoCancelar = document.getElementById("btn-cancelar");

// Janela: adicionar / remover quantidade
const dialogoMovimento = document.getElementById("dialogo-movimento");
const formMovimento = document.getElementById("form-movimento");
const tituloMovimento = document.getElementById("titulo-movimento");
const produtoMovimento = document.getElementById("movimento-produto");
const rotuloMovimento = document.getElementById("rotulo-movimento");
const campoQuantidade = document.getElementById("movimento-quantidade");
const quantidadeAtual = document.getElementById("movimento-atual");
const quantidadeDepois = document.getElementById("movimento-depois");
const erroMovimento = document.getElementById("erro-movimento");
const botaoConfirmar = document.getElementById("btn-confirmar-movimento");
const botaoCancelarMovimento = document.getElementById("btn-cancelar-movimento");
const botaoExcluir = document.getElementById("btn-excluir");

// Respeita quem desativou animações no sistema
const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Estado ---------- */
let todosProdutos = [];            // lista completa vinda do servidor (o filtro age sobre ela)
const produtosPorId = new Map();   // acesso rápido por id

// Qual produto e qual operação estão abertos na janela de movimentação
// { id: "...", tipo: "entrada" | "saida" }
let movimento = null;

// Controla o "toque de novo para confirmar" do botão Excluir
let temporizadorConfirmacao = null;

/* ---------- Comunicação com o servidor ---------- */
// Se o servidor responder 401, a sessão acabou: volta para o login
function irParaLogin() {
    window.location.replace("login.html");
}

// Erro próprio para "sessão inválida", para o resto do código saber distinguir de uma falha de rede
class SessaoExpirada extends Error {}

function verificarSessao(resposta) {
    if (resposta.status === 401) {
        irParaLogin();
        throw new SessaoExpirada("Sessão expirada. Faça login novamente.");
    }
}

// credentials: "include" faz o navegador enviar o cookie de sessão junto com o pedido
async function buscarJSON(url) {
    const resposta = await fetch(url, { credentials: "include" });
    verificarSessao(resposta);

    if (!resposta.ok) {
        throw new Error(`Erro ${resposta.status} ao buscar ${url}`);
    }
    return resposta.json();
}

async function enviarJSON(url, metodo, dados) {
    const resposta = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dados),
    });
    verificarSessao(resposta);

    // O servidor responde { erro: "..." } quando algo está errado
    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
        throw new Error(corpo.erro || `Erro ${resposta.status}`);
    }
    return corpo;
}

/* ---------- Utilidades ---------- */
// TypeError = o fetch nem chegou ao servidor
function mensagemDeErro(erro) {
    return erro instanceof TypeError ? "Não foi possível conectar ao servidor." : erro.message;
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function mostrarErro(elemento, texto) {
    elemento.textContent = texto;
    elemento.hidden = false;
}

function esconderErro(elemento) {
    elemento.hidden = true;
    elemento.textContent = "";
}

// Clicar no fundo escurecido (fora da janela) fecha a janela
function fecharAoClicarFora(dialogo) {
    dialogo.addEventListener("click", (evento) => {
        if (evento.target === dialogo) {
            dialogo.close();
        }
    });
}

/* ---------- Filtros ---------- */
// "Fritos", "fritos" e "frítos" contam como iguais
function normalizar(texto) {
    return String(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function filtrarProdutos(produtos) {
    const busca = normalizar(campoBusca.value.trim());
    const categoria = campoCategoria.value;

    return produtos.filter((produto) => {
        const combinaBusca =
            !busca ||
            normalizar(produto.nome).includes(busca) ||
            normalizar(produto.codigo).includes(busca);
        const combinaCategoria = categoria === "Todas" || produto.categoria === categoria;

        return combinaBusca && combinaCategoria;
    });
}

/* ---------- Tabela e resumo ---------- */
function criarCelula(texto) {
    const td = document.createElement("td");
    td.textContent = texto; // textContent evita injeção de HTML
    return td;
}

// acao: "entrada" (Adicionar) ou "saida" (Remover)
function criarBotaoAcao(produto, acao) {
    const botao = document.createElement("button");
    const entrada = acao === "entrada";

    botao.type = "button";
    botao.className = acao;
    botao.dataset.acao = acao;
    botao.dataset.id = produto._id;
    botao.textContent = entrada ? "Adicionar" : "Remover";
    botao.setAttribute(
        "aria-label",
        `${entrada ? "Adicionar ao" : "Remover do"} estoque de ${produto.nome}`
    );

    return botao;
}

// animar: linhas entram uma após a outra | destacar: linha alterada pisca em verde
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

    const acoes = document.createElement("div");
    acoes.className = "acoes-linha";
    acoes.append(criarBotaoAcao(produto, "entrada"), criarBotaoAcao(produto, "saida"));

    const tdAcoes = document.createElement("td");
    tdAcoes.append(acoes);

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

// Desenha a tabela com a lista completa + os filtros atuais
function renderizarTabela({ animar = false, destacarId = null } = {}) {
    if (todosProdutos.length === 0) {
        mostrarMensagem("Nenhum produto cadastrado ainda.");
        return;
    }

    const visiveis = filtrarProdutos(todosProdutos);
    if (visiveis.length === 0) {
        mostrarMensagem("Nenhum produto encontrado com esses filtros.");
        return;
    }

    const linhas = visiveis.map((produto, indice) =>
        criarLinha(produto, { indice, animar, destacar: produto._id === destacarId })
    );
    corpoTabela.replaceChildren(...linhas);

    // Leva a tela até o produto alterado (útil no celular, onde ele pode estar fora da vista)
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

        todosProdutos = produtos;
        produtosPorId.clear();
        produtos.forEach((produto) => produtosPorId.set(produto._id, produto));

        renderizarTabela({ animar: !silencioso, destacarId });
        renderizarResumo(resumo, { animar: !silencioso });
    } catch (erro) {
        console.error(erro);
        mostrarMensagem("Não foi possível carregar os produtos. Verifique se o servidor está rodando.");
        totalItens.textContent = "–";
        estoqueBaixo.textContent = "–";
    }
}

/* ---------- Produto novo ---------- */
function abrirDialogoProduto() {
    formProduto.reset(); // volta aos valores iniciais (estoque mínimo = 10)
    esconderErro(erroProduto);
    dialogoProduto.showModal();
}

async function salvarProduto(evento) {
    evento.preventDefault(); // impede o navegador de recarregar a página

    const dados = Object.fromEntries(new FormData(formProduto));

    esconderErro(erroProduto);
    botaoSalvar.disabled = true; // evita cadastrar duas vezes com cliques repetidos

    try {
        const novoProduto = await enviarJSON(`${url_server}/api/produtos`, "POST", dados);
        dialogoProduto.close();
        await carregarEstoque({ silencioso: true, destacarId: novoProduto._id });
    } catch (erro) {
        mostrarErro(erroProduto, mensagemDeErro(erro));
    } finally {
        botaoSalvar.disabled = false;
    }
}

/* ---------- Adicionar / remover quantidade ---------- */
function lerQuantidade() {
    const quantidade = Number(campoQuantidade.value);
    const valida = campoQuantidade.value !== "" && Number.isInteger(quantidade) && quantidade > 0;
    return { quantidade, valida };
}

// Mostra "Estoque atual → depois" enquanto a pessoa digita
function atualizarPrevia() {
    const produto = movimento && produtosPorId.get(movimento.id);
    if (!produto) return;

    const { quantidade, valida } = lerQuantidade();
    const depois =
        movimento.tipo === "entrada" ? produto.quantidade + quantidade : produto.quantidade - quantidade;

    quantidadeAtual.textContent = produto.quantidade;
    quantidadeDepois.textContent = valida && depois >= 0 ? depois : "–";
}

function abrirDialogoMovimento(produto, tipo) {
    const entrada = tipo === "entrada";

    movimento = { id: produto._id, tipo };

    formMovimento.reset();
    esconderErro(erroMovimento);
    cancelarConfirmacaoExclusao();

    tituloMovimento.textContent = entrada ? "Adicionar ao estoque" : "Remover do estoque";
    produtoMovimento.textContent = `${produto.codigo} · ${produto.nome}`;
    rotuloMovimento.textContent = entrada ? "Quantidade a adicionar" : "Quantidade a remover";

    botaoConfirmar.textContent = entrada ? "Adicionar" : "Remover";
    botaoConfirmar.className = tipo; // "entrada" (verde) ou "saida" (aço)

    botaoExcluir.hidden = entrada; // o Excluir só existe na janela de Remover

    atualizarPrevia();
    dialogoMovimento.showModal();
}

async function salvarMovimento(evento) {
    evento.preventDefault();

    const produto = produtosPorId.get(movimento.id);
    if (!produto) {
        mostrarErro(erroMovimento, "Produto não encontrado. Feche a janela e tente de novo.");
        return;
    }

    const { quantidade, valida } = lerQuantidade();
    if (!valida) {
        mostrarErro(erroMovimento, "Informe uma quantidade inteira maior que zero.");
        return;
    }

    const entrada = movimento.tipo === "entrada";
    if (!entrada && quantidade > produto.quantidade) {
        mostrarErro(erroMovimento, `Você só pode remover até ${produto.quantidade} unidade(s).`);
        return;
    }

    // O servidor recebe o produto completo com a quantidade já recalculada
    const dados = {
        nome: produto.nome,
        categoria: produto.categoria,
        estoqueMinimo: produto.estoqueMinimo,
        quantidade: entrada ? produto.quantidade + quantidade : produto.quantidade - quantidade,
    };

    esconderErro(erroMovimento);
    botaoConfirmar.disabled = true;

    try {
        const atualizado = await enviarJSON(`${url_server}/api/produtos/${produto._id}`, "PUT", dados);
        dialogoMovimento.close();
        await carregarEstoque({ silencioso: true, destacarId: atualizado._id });
    } catch (erro) {
        mostrarErro(erroMovimento, mensagemDeErro(erro));
    } finally {
        botaoConfirmar.disabled = false;
    }
}

/* ---------- Exclusão de produto (dentro da janela "Remover") ---------- */
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
    esconderErro(erroMovimento);
    botaoExcluir.disabled = true;
    botaoConfirmar.disabled = true;

    try {
        const id = movimento.id;
        await enviarJSON(`${url_server}/api/produtos/${id}`, "DELETE");
        dialogoMovimento.close();

        // A linha desliza para fora antes de a lista ser recarregada
        corpoTabela.querySelector(`tr[data-id="${id}"]`)?.classList.add("saindo");
        await esperar(reduzirMovimento ? 0 : 350);

        await carregarEstoque({ silencioso: true });
    } catch (erro) {
        mostrarErro(erroMovimento, mensagemDeErro(erro));
        cancelarConfirmacaoExclusao();
    } finally {
        botaoExcluir.disabled = false;
        botaoConfirmar.disabled = false;
    }
}

/* ---------- Usuário e sessão ---------- */
// Pergunta ao servidor quem está logado e mostra nome e foto.
// Se não houver sessão válida (401), buscarJSON já manda para o login e lança SessaoExpirada.
async function carregarUsuario() {
    const usuario = await buscarJSON(`${url_server}/api/usuarios/eu`);

    usuarioNome.textContent = usuario.nome;
    if (usuario.foto) {
        usuarioFoto.src = usuario.foto;
        usuarioFoto.hidden = false;
    } else {
        usuarioFoto.hidden = true;
    }
    usuarioBarra.hidden = false;
}

async function sair() {
    botaoSair.disabled = true;

    try {
        await enviarJSON(`${url_server}/api/usuarios/sair`, "POST");
    } catch (erro) {
        console.error(erro);
    }

    irParaLogin();
}

/* ---------- Eventos ---------- */
// Filtro: preventDefault impede o envio do formulário (que recarregaria a página)
formFiltros.addEventListener("submit", (evento) => {
    evento.preventDefault();
    renderizarTabela({ animar: true });
});

// Bônus: a lista também filtra enquanto você digita ou troca a categoria
campoBusca.addEventListener("input", () => renderizarTabela());
campoCategoria.addEventListener("change", () => renderizarTabela());

// Produto novo
botaoAdicionar.addEventListener("click", () => abrirDialogoProduto());
botaoCancelar.addEventListener("click", () => dialogoProduto.close());
formProduto.addEventListener("submit", salvarProduto);
fecharAoClicarFora(dialogoProduto);

// Adicionar / Remover: um único "ouvinte" na tabela atende todos os botões,
// mesmo os criados depois de cada recarga da lista
corpoTabela.addEventListener("click", (evento) => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;

    const produto = produtosPorId.get(botao.dataset.id);
    if (produto) {
        abrirDialogoMovimento(produto, botao.dataset.acao);
    }
});

campoQuantidade.addEventListener("input", atualizarPrevia);
formMovimento.addEventListener("submit", salvarMovimento);
botaoCancelarMovimento.addEventListener("click", () => dialogoMovimento.close());
botaoExcluir.addEventListener("click", excluirProduto);
fecharAoClicarFora(dialogoMovimento);

botaoSair.addEventListener("click", sair);

/* ---------- Início ---------- */
// Porteiro: a página só aparece depois de o servidor confirmar o login
async function iniciar() {
    try {
        await carregarUsuario();
    } catch (erro) {
        // Sem login: o navegador já está indo para o login.html. A página continua escondida.
        if (erro instanceof SessaoExpirada) {
            return;
        }
        // Outra falha (ex.: servidor fora do ar): mostra a página, e a tabela exibe o aviso de erro
        console.error(erro);
    }

    document.body.classList.remove("verificando");
    carregarEstoque();
}

// Voltar/avançar no navegador pode mostrar uma cópia antiga da página (cache).
// Por isso, ao reaparecer assim, a sessão é conferida de novo (ex.: depois de clicar em "Sair").
window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) {
        document.body.classList.add("verificando");
        iniciar();
    }
});

iniciar();
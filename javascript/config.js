// Configurações compartilhadas pelas páginas (login.html e index.html).
// Este arquivo precisa ser carregado ANTES dos outros scripts.

// Endereço da API:
// - no seu computador (localhost ou 127.0.0.1): usa o servidor local na porta 3000, com o mesmo
//   "nome" do endereço da página, para o cookie de sessão não ser bloqueado nos testes
// - publicado (GitHub Pages): usa o servidor do Render
const url_server = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `http://${window.location.hostname}:3000`
    : "https://estoque-em-web-back.onrender.com";

// Client ID do Google (Google Cloud Console > Credenciais). Não é segredo, pode ficar aqui.
const GOOGLE_CLIENT_ID = "486979187580-8uu48jbd8tcino2u5ie0rhktqbfcd3pa.apps.googleusercontent.com";
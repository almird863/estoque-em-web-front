const formLogin = document.getElementById('form-login')
const API_URL = 'http://localhost:3000'


formLogin.addEventListener('submit', (e) => {
    e.preventDefault()

    const campoNome = document.getElementById('form-login-nome').value
    const campoSenha = document.getElementById('form-login-senha').value

    const loginRequest = {
        nome: campoNome,
        senha: campoSenha
    }

    fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(loginRequest)
    })
        .then((res) => {
            if (!res.ok) { throw new Error('Falha no login') }
            return res.json()
        })
        .then((data) => {
            console.log(`Dados recebidos: ${data}`)
        })
        .catch((err) => {
            console.error(`Erro: ${err}`)
        })
})
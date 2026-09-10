function mostrarTela(id) {
    const telas = ["login", "cadastroUsuario", "dashboard", "producao", "movimentacaoEstoque", "historicoEntrega", "cadastroItem"];
    const telasInline = ["login", "cadastroUsuario"];

    telas.forEach((tela) => {
        const elemento = document.getElementById(tela);
        if (!elemento) return;

        const deveMostrar = tela === id;
        elemento.style.display = deveMostrar
            ? (telasInline.includes(tela) ? "inline-block" : "block")
            : "none";
    });
}

async function entrar(){
    const email = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: senha });
    if (error) {
        alert(error.message || "Não foi possível realizar o login.");
        return;
    }

    try {
        mostrarTela("dashboard");
    } catch (erro) {
        alert(erro.message);
    }
}

function mostrarCadastroUsuario(){
    mostrarTela("cadastroUsuario");
}

function voltarLogin(){
    mostrarTela("login");
}

function logout() {
    supabaseClient.auth.signOut().then(() => {
        mostrarTela("login");
    });
}

async function cadastrarUsuario(){
    const nome = document.getElementById("novoNome").value.trim();
    const email = document.getElementById("novoEmail").value.trim();
    const senha = document.getElementById("novaSenha").value;

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: senha,
        options: { data: { full_name: nome } }
    });

    if (error) {
        alert(error.message || "Não foi possível criar o usuário.");
        return;
    }

    alert(data.session
        ? "Usuário criado e autenticado."
        : "Usuário criado. Confirme o e-mail para entrar.");
    document.getElementById("novoNome").value = "";
    document.getElementById("novoEmail").value = "";
    document.getElementById("novaSenha").value = "";
    try {
        voltarLogin();
    } catch (erro) {
        alert(erro.message);
    }
}

async function recuperarSenha() {
    const emailInput = document.getElementById("usuario");
    const email = emailInput.value.trim();

    if (!email) {
        alert("Digite seu e-mail no campo de login para recuperar a senha.");
        emailInput.focus();
        return;
    }

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.href
        });
        if (error) throw error;
        alert("Se o e-mail existir, as instruções de recuperação foram enviadas.");
    } catch (error) {
        alert(`Não foi possível enviar o e-mail de recuperação: ${error.message}`);
    }
}
function showCadastroItem(){
    mostrarTela("cadastroItem");
}

function searchUp() {
    const input = document.getElementById("searchUp");
    const filtro = (input?.value || "").trim().toLowerCase();
    const linhas = document.querySelectorAll("#historicoLista tr");

    linhas.forEach((linha) => {
        const textoLinha = linha.textContent.toLowerCase();
        linha.style.display = textoLinha.includes(filtro) ? "" : "none";
    });
}

async function showHistorico(){
    mostrarTela("historicoEntrega");

    const status = document.getElementById("historicoStatus");
    const lista = document.getElementById("historicoLista");
    status.textContent = "Carregando entregas...";
    lista.innerHTML = "";

    try {
        const { data, error } = await supabaseClient
            .from("deliveries")
            .select("id, delivery_date, destination_name, destination_address, delivery_items(quantity, products(name))")
            .order("delivery_date", { ascending: false });

        if (error) throw error;

        if (!data.length) {
            status.textContent = "Nenhuma entrega cadastrada.";
            return;
        }

        data.forEach((entrega) => {
            const item = entrega.delivery_items?.[0];
            const linha = document.createElement("tr");
            [
                entrega.delivery_date,
                item?.products?.name || "-",
                item?.quantity ?? "-",
                entrega.destination_name || "-",
                entrega.destination_address || "-"
            ].forEach((valor) => {
                const celula = document.createElement("td");
                celula.textContent = valor;
                linha.appendChild(celula);
            });

            const acoes = document.createElement("td");
            const botaoExcluir = document.createElement("button");
            botaoExcluir.type = "button";
            botaoExcluir.textContent = "Excluir";
            botaoExcluir.className = "btn-excluir";
            botaoExcluir.addEventListener("click", () => excluirEntrega(entrega.id, botaoExcluir));
            acoes.appendChild(botaoExcluir);
            linha.appendChild(acoes);
            lista.appendChild(linha);
        });
        status.textContent = `${data.length} entrega(s) encontrada(s).`;
    } catch (erro) {
        status.textContent = `Não foi possível carregar o histórico: ${erro.message}`;
    }
}

async function excluirEntrega(entregaId, botao) {
    if (!window.confirm("Excluir esta entrega?")) return;

    botao.disabled = true;
    try {
        const { error: itemError } = await supabaseClient
            .from("delivery_items")
            .delete()
            .eq("delivery_id", entregaId);
        if (itemError) throw itemError;

        const { error: entregaError } = await supabaseClient
            .from("deliveries")
            .delete()
            .eq("id", entregaId);
        if (entregaError) throw entregaError;

        await showHistorico();
    } catch (erro) {
        botao.disabled = false;
        alert(`Não foi possível excluir a entrega: ${erro.message}`);
    }
}

    var btnLimparItem = document.getElementById('btnLimparItem');
    if (btnLimparItem) btnLimparItem.addEventListener('click', function(){
        var f = document.getElementById('formItem'); if (f) f.reset();
    });

function retornarDashboard(){
    mostrarTela("dashboard");
}

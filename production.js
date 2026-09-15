const movementTypes = ["entrada", "saida", "ajuste"];

function setSelectOptions(select, rows, label) {
    select.innerHTML = rows.length
        ? rows.map((row) => `<option value="${row.id}">${label(row)}</option>`).join("")
        : '<option value="">Nenhum registro disponível</option>';
    select.disabled = !rows.length;
}

async function loadProductionOptions() {
    const [{ data: products, error: productsError }, { data: items, error: itemsError }] = await Promise.all([
        supabaseClient.from("products").select("id, name").order("name"),
        supabaseClient.from("materials").select("id, name, code").eq("active", true).order("name")
    ]);
    if (productsError) throw productsError;
    if (itemsError) throw itemsError;

    setSelectOptions(document.getElementById("producaoProduto"), products || [], (product) => product.name);
    setSelectOptions(document.getElementById("metaProduto"), products || [], (product) => product.name);
    const movimentoMaterial = document.getElementById("movimentoMaterial");
    if (movimentoMaterial) {
        setSelectOptions(movimentoMaterial, items || [], (item) => `${item.name} (${item.code})`);
    }
}

async function currentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error("Sua sessão expirou. Faça login novamente.");
    return user;
}

function showProducao() {
    mostrarTela("producao");
    document.getElementById("producaoData").value ||= new Date().toISOString().slice(0, 10);
    document.getElementById("metaData").value ||= new Date().toISOString().slice(0, 10);
    loadProductionOptions().catch((error) => {
        document.getElementById("producaoStatus").textContent = `Não foi possível carregar os dados: ${error.message}`;
    });
}

function showMovimentacao() {
    mostrarTela("movimentacaoEstoque");
    loadProductionOptions().catch((error) => {
        document.getElementById("movimentacaoStatus").textContent = `Não foi possível carregar os itens: ${error.message}`;
    });
}

async function handleProductionSubmit(event) {
    event.preventDefault();
    const user = await currentUser();
    const produced = Number(document.getElementById("quantidadeProduzida").value);
    const defective = Number(document.getElementById("quantidadeDefeituosa").value);
    if (defective > produced) throw new Error("A quantidade defeituosa não pode superar a produzida.");

    const { error } = await supabaseClient.from("production_records").insert({
        production_date: document.getElementById("producaoData").value,
        responsible_id: user.id,
        product_id: document.getElementById("producaoProduto").value,
        quantity_produced: produced,
        quantity_defective: defective,
        quantity_approved: produced - defective
    });
    if (error) throw error;
    event.target.reset();
    document.getElementById("producaoStatus").textContent = "Produção registrada com sucesso.";
}

async function handleGoalSubmit(event) {
    event.preventDefault();
    const user = await currentUser();
    const { error } = await supabaseClient.from("production_goals").insert({
        goal_date: document.getElementById("metaData").value,
        created_by: user.id,
        product_id: document.getElementById("metaProduto").value,
        target_quantity: Number(document.getElementById("metaQuantidade").value)
    });
    if (error) throw error;
    event.target.reset();
    document.getElementById("producaoStatus").textContent = "Meta salva com sucesso.";
}

async function handleMaterialSubmit(event) {
    event.preventDefault();
    const payload = {
        name: document.getElementById("itemNome").value.trim(),
        unit: document.getElementById("itemPreco").value.trim(),
        minimum_stock: Number(document.getElementById("itemQtd").value),
        active: true
    };
    const { data: existing, error: findError } = await supabaseClient.from("materials").select("id").eq("code", payload.code).maybeSingle();
    if (findError) throw findError;
    const request = existing
        ? supabaseClient.from("products").update(payload).eq("id", existing.id)
        : supabaseClient.from("products").insert(payload);
    const { error } = await request;
    if (error) throw error;
    event.target.reset();
    await loadProductionOptions();
    document.getElementById("producaoStatus").textContent = "Material salvo com sucesso.";
}

async function handleMovementSubmit(event) {
    event.preventDefault();
    const user = await currentUser();
    const itemSelect = document.getElementById("movimentoMaterial");
    const itemName = itemSelect.options[itemSelect.selectedIndex]?.text || "Item não informado";
    const movementType = document.getElementById("tipoMovimento").value;
    const quantity = Number(document.getElementById("quantidadeMovimento").value);
    const notes = document.getElementById("observacaoMovimento").value.trim();
    const address = document.getElementById("itemEndereco")?.value.trim() || "";

    const { error } = await supabaseClient.from("material_stock_movements").insert({
        material_id: itemSelect.value,
        movement_type: movementType,
        quantity,
        created_by: user.id,
        notes
    });
    if (error) throw error;

    event.target.reset();
    try {
        gerarPdfMovimentacao({ itemName, movementType, quantity, notes, address, user });
        document.getElementById("movimentacaoStatus").textContent = "Movimentação salva e PDF gerado com sucesso.";
    } catch (pdfError) {
        document.getElementById("movimentacaoStatus").textContent = `Movimentação salva, mas não foi possível gerar o PDF: ${pdfError.message}`;
    }
}

function gerarPdfMovimentacao({ itemName, movementType, quantity, notes, address, user }) {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
        throw new Error("A biblioteca de PDF não foi carregada. Verifique sua conexão e tente novamente.");
    }

    const pdf = new JsPDF();
    const data = new Date().toLocaleString("pt-BR");
    const tipo = movementType.charAt(0).toUpperCase() + movementType.slice(1);

    pdf.setFontSize(18);
    pdf.text("Comprovante de movimentação de estoque", 20, 25);
    pdf.setFontSize(12);
    pdf.text(`Data: ${data}`, 20, 42);
    pdf.text(`Responsável: ${user.email || user.id}`, 20, 52);
    pdf.text(`Item: ${itemName}`, 20, 68);
    pdf.text(`Tipo: ${tipo}`, 20, 78);
    pdf.text(`Quantidade: ${quantity}`, 20, 88);
    if (address) pdf.text(`Endereço: ${address}`, 20, 98);
    if (notes) pdf.text(`Observação: ${notes}`, 20, address ? 108 : 98);
    pdf.line(20, 120, 190, 120);
    pdf.setFontSize(10);
    pdf.text("Documento gerado pelo sistema Cerâmica Riachuelo.", 20, 132);
    pdf.save(`movimentacao-estoque-${Date.now()}.pdf`);
}

function handleFormError(error, statusId = "producaoStatus") {
    document.getElementById(statusId).textContent = `Erro: ${error.message}`;
}

document.getElementById("formProducao").addEventListener("submit", (event) => handleProductionSubmit(event).catch(handleFormError));
document.getElementById("formMeta").addEventListener("submit", (event) => handleGoalSubmit(event).catch(handleFormError));
document.getElementById("formMovimentacao").addEventListener("submit", (event) => handleMovementSubmit(event).catch((error) => handleFormError(error, "movimentacaoStatus")));

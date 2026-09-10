
const formulario = document.getElementById("formItem");

formulario.addEventListener("submit", async function(event) {
    event.preventDefault();
    const status = document.getElementById("itemStatus");
    status.textContent = "Salvando item...";

    const dados = Object.fromEntries(new FormData(formulario));

    try {
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sua sessão expirou. Faça login novamente.");

      let etapa = "cliente";
      const { data: cliente, error: clienteError } = await supabaseClient
        .from("customers")
        .insert({ name: dados.itemCliente.trim(), address: dados.itemEndereco.trim() })
        .select("id")
        .single();
      if (clienteError) throw clienteError;

      etapa = "produto";
      const { data: produto, error: produtoError } = await supabaseClient
        .from("products")
        .upsert({
          code: crypto.randomUUID(),
          name: dados.itemNome.trim(),
          default_price: Number(dados.itemPreco)
        }, { onConflict: "code" })
        .select("id")
        .single();
      if (produtoError) throw produtoError;

      etapa = "entrega";
      const { data: entrega, error: entregaError } = await supabaseClient
        .from("deliveries")
        .insert({
          delivery_date: dados.dataEntrega,
          operator_id: user.id,
          customer_id: cliente.id,
          destination_name: dados.itemCliente.trim(),
          destination_address: dados.itemEndereco.trim(),
          created_by: user.id
        })
        .select("id")
        .single();
      if (entregaError) throw entregaError;

      etapa = "item da entrega";
      const { error: itemError } = await supabaseClient.from("delivery_items").insert({
        delivery_id: entrega.id,
        product_id: produto.id,
        quantity: Number(dados.itemQtd),
        unit_price: Number(dados.itemPreco)
      });
      if (itemError) throw itemError;

      formulario.reset();
      status.textContent = "Entrega cadastrada com sucesso.";
    } catch (erro) {
      const detalhes = [erro.code, erro.details, erro.hint].filter(Boolean).join(" | ");
      status.textContent = `Erro na etapa ${etapa}: ${erro.message}${detalhes ? ` | ${detalhes}` : ""}`;
    }
});

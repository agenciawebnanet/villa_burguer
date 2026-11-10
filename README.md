# Villa Burguer

Cardápio digital estático, sem dependências. O cliente escolhe os itens, revisa a sacola e abre uma mensagem preenchida no WhatsApp da loja. O envio é confirmado pelo cliente no aplicativo.

## Executar

Abra `index.html` no navegador. Para publicar, coloque o conteúdo desta pasta na raiz do repositório e aponte sua hospedagem estática para essa raiz.

## Atualizar o cardápio

- `catalogo.js` organiza categorias, produtos, ingredientes, fotos e opções. Os preços são em centavos.
- `menu.js` contém a configuração do WhatsApp. Está definido como `5584987839835`, com o nono dígito do celular brasileiro. Confirme o contato com a loja antes de publicar.
- `fotos/` contém imagens ilustrativas em WebP. As imagens foram geradas com base nos ingredientes do cardápio e em referências gastronômicas.
- A sacola fica no navegador. Nome, endereço e observações só entram na mensagem ao abrir o WhatsApp.

O subtotal representa os itens. Disponibilidade e taxa de entrega são confirmadas com a loja.

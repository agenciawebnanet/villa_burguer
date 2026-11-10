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

## Instalar como aplicativo

Em uma hospedagem HTTPS, use **Instalar aplicativo** na tela de demonstração ou no rodapé. No Safari do iPhone, use **Compartilhar → Adicionar à Tela de Início**. O navegador pede a confirmação da instalação.

## Painel em /master na Vercel

1. Conecte um Postgres ao projeto da Vercel. Neon pelo Marketplace é uma opção. A função usa `DATABASE_URL` ou `POSTGRES_URL`.
2. Adicione `ADMIN_PASSWORD` com uma senha forte de pelo menos 12 caracteres e `ADMIN_SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Configure os segredos no ambiente do projeto e faça um novo deploy. O painel cria suas tabelas na primeira operação que usa o banco.
3. Abra `/master`, entre com a senha, selecione o produto ou a variação e salve o preço e a foto. A foto é convertida em WebP no navegador e armazenada no Postgres. Uma alteração de preço pode ser salva sem selecionar uma nova foto.

O cardápio usa o catálogo padrão quando o banco está indisponível. Os dados do pedido são montados no navegador e seguem para o WhatsApp. Os bairros e taxas da demonstração estão definidos em `deliveryZones` no arquivo `menu.js`.

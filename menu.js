'use strict';

const phone = '5584987839835';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const format = cents => money.format(cents / 100);
const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const storageKey = 'villa-burguer-cart-v1';
const drawer = document.querySelector('#drawer');
const filters = document.querySelector('#filters');
const search = document.querySelector('#search');
const highlights = document.querySelector('#highlights');
const catalog = document.querySelector('#catalog');
const checkout = document.querySelector('#checkout');
const cartPanel = document.querySelector('#cart');
const variants = new Map();
const deliveryZones = new Map([
  ['Jardim da Villa', 500],
  ['Parque das Oliveiras', 700],
  ['Vila do Lago', 900],
  ['Alto das Palmeiras', 1200],
]);
let activeCategory = -1;
let cart = {};

function make(tag, value, className) {
  const element = document.createElement(tag);
  if (value) element.textContent = value;
  if (className) element.className = className;
  return element;
}

function button(label, className, action) {
  const element = make('button', label, className);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

catalogo.forEach((group, groupIndex) => {
  group.items.forEach((item, itemIndex) => {
    item.choices = item.options.map(([option, price], optionIndex) => {
      const key = [groupIndex, itemIndex, optionIndex].join('-');
      const variant = { key, price, name: item.name, option, category: group.name };
      variants.set(key, variant);
      return variant;
    });
  });
});

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const [key, quantity] of Object.entries(saved || {})) {
    if (variants.has(key) && Number.isInteger(quantity) && quantity > 0 && quantity <= 99) {
      cart[key] = quantity;
    }
  }
} catch {}

function changeQuantity(key, difference) {
  const quantity = Math.min(99, (cart[key] || 0) + difference);
  if (quantity > 0) cart[key] = quantity;
  else delete cart[key];
  try {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  } catch {}
  renderCart();
}

function productImage(item, index) {
  const variant = item.choices[index];
  return variant.image
    ? '/api/catalog?image=' + encodeURIComponent(variant.key) + '&v=' + encodeURIComponent(variant.image)
    : 'fotos/' + (item.optionPics?.[index] ?? item.pic) + '.webp';
}

function itemCard(item, group) {
  const card = make('article', '', 'item');
  const image = make('img');
  image.src = productImage(item, 0);
  image.alt = '';
  image.loading = 'lazy';
  image.width = 480;
  image.height = 480;
  const body = make('div', '', 'item-body');
  body.append(make('h4', item.name));
  if (item.desc) body.append(make('p', item.desc));
  const first = item.choices[0];
  let selection = first;
  const price = make('strong', format(first.price));
  if (item.choices.length > 1) {
    const label = make('label', 'Escolha uma opção');
    const select = make('select');
    select.setAttribute('aria-label', 'Opção de ' + item.name);
    for (const choice of item.choices) {
      const option = make('option', choice.option + ' · ' + format(choice.price));
      option.value = choice.key;
      select.append(option);
    }
    select.addEventListener('change', () => {
      selection = variants.get(select.value);
      price.textContent = format(selection.price);
      image.src = productImage(item, select.selectedIndex);
    });
    label.append(select);
    body.append(label);
  }
  const bottom = make('div', '', 'item-bottom');
  const add = button('', 'add', () => {
    changeQuantity(selection.key, 1);
    document.querySelector('#status').textContent = item.name + ' na sacola. Quantidade ' + cart[selection.key] + '.';
  });
  add.innerHTML = '<svg class="glyph" aria-hidden="true"><use href="#icon-plus"/></svg>';
  add.setAttribute('aria-label', 'Adicionar ' + item.name + ' (' + group.name + ')');
  bottom.append(price, add);
  body.append(bottom);
  card.append(image, body);
  return card;
}

function renderMenu() {
  catalog.replaceChildren();
  const query = normalize(search.value.trim());
  highlights.hidden = Boolean(query) || activeCategory !== -1;
  document.querySelector('#vitrine').hidden = Boolean(query);
  catalogo.forEach((group, index) => {
    if (activeCategory !== -1 && index !== activeCategory) return;
    const matches = group.items.filter(item =>
      normalize([group.name, item.name, item.desc, ...item.choices.map(choice => choice.option)].join(' ')).includes(query)
    );
    if (!matches.length) return;
    const section = make('section', '', 'group');
    section.append(make('h3', group.name));
    if (group.note) section.append(make('p', group.note, 'group-note'));
    const grid = make('div', '', 'grid');
    grid.append(...matches.map(item => itemCard(item, group)));
    section.append(grid);
    catalog.append(section);
  });
  if (!catalog.children.length) catalog.append(make('p', 'Nenhum item encontrado. Tente outro termo ou categoria.', 'group'));
}

function cartEntries() {
  return Object.entries(cart).map(([key, quantity]) => ({ ...variants.get(key), quantity }));
}

function renderCart() {
  const entries = cartEntries();
  const count = entries.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = entries.reduce((sum, item) => sum + item.quantity * item.price, 0);
  document.querySelector('#count').textContent = count;
  const dockCount = document.querySelector('#sticky-count');
  const dockTotal = document.querySelector('#sticky-total');
  dockCount.textContent = count;
  dockTotal.textContent = format(subtotal);
  dockCount.hidden = dockTotal.hidden = count === 0;
  renderTotals(subtotal);
  checkout.hidden = !count;

  const previousFocus = document.activeElement?.dataset.cartFocus;
  cartPanel.replaceChildren();
  if (!count) {
    cartPanel.append(make('p', 'Sua sacola está vazia. Escolha seus itens no cardápio.'));
    if (previousFocus) document.querySelector('#close').focus();
    return;
  }
  for (const item of entries) {
    const row = make('div', '', 'line');
    const details = make('div');
    details.append(make('strong', item.name));
    details.append(make('p', [item.category, item.option, format(item.price * item.quantity)].filter(Boolean).join(' · '), 'small'));
    const stepper = make('div', '', 'qty');
    const minus = button('−', 'icon', () => changeQuantity(item.key, -1));
    const plus = button('+', 'icon', () => changeQuantity(item.key, 1));
    minus.setAttribute('aria-label', 'Diminuir quantidade de ' + item.name);
    plus.setAttribute('aria-label', 'Aumentar quantidade de ' + item.name);
    minus.dataset.cartFocus = item.key + '-minus';
    plus.dataset.cartFocus = item.key + '-plus';
    stepper.append(minus, make('strong', String(item.quantity)), plus);
    row.append(details, stepper);
    cartPanel.append(row);
  }
  if (previousFocus) {
    (cartPanel.querySelector('[data-cart-focus="' + previousFocus + '"]') || cartPanel.querySelector('button')).focus();
  }
}

function renderTotals(subtotal = cartEntries().reduce((sum, item) => sum + item.quantity * item.price, 0)) {
  const delivery = checkout.elements.modo.value === 'Entrega';
  const fee = deliveryZones.get(checkout.elements.bairro.value);
  document.querySelector('#subtotal').textContent = format(subtotal);
  document.querySelector('#delivery-summary').hidden = !delivery;
  document.querySelector('#delivery-fee').textContent = fee === undefined ? 'Selecione o bairro' : format(fee);
  document.querySelector('#order-total').textContent = delivery && fee === undefined ? 'A calcular' : format(subtotal + (delivery ? fee : 0));
}

function updateAddress() {
  const delivery = checkout.elements.modo.value === 'Entrega';
  document.querySelector('#address').hidden = !delivery;
  for (const input of document.querySelectorAll('#address input, #address select')) input.disabled = !delivery;
  for (const name of ['bairro', 'rua', 'numero']) checkout.elements[name].required = delivery;
  renderTotals();
}

function updatePayment() {
  const cash = checkout.elements.pagamento.value === 'Dinheiro';
  document.querySelector('#cash-change').hidden = !cash;
  checkout.elements.troco.disabled = !cash;
}

function orderLink(entries, values) {
  const subtotal = entries.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const delivery = values.modo === 'Entrega';
  const fee = delivery ? deliveryZones.get(values.bairro) : 0;
  const lines = entries.map(item => {
    const description = [item.name, item.option, item.category].filter(Boolean).join(' · ');
    return '• ' + item.quantity + '× ' + description + ' — ' + format(item.quantity * item.price);
  });
  const message = [
    '🍔 *Pedido Villa Burguer*', '', ...lines, '',
    '*Subtotal:* ' + format(subtotal),
    ...(delivery ? ['*Taxa de entrega:* ' + format(fee) + ' (demonstração)'] : []),
    '💰 *Total:* ' + format(subtotal + fee), '',
    '👤 *Cliente:* ' + values.cliente.trim(),
    '📞 *Celular:* ' + values.telefone.trim(),
    '📦 *Recebimento:* ' + values.modo,
    '💳 *Pagamento:* ' + values.pagamento,
  ];
  if (delivery) {
    const address = [values.rua.trim() + ', ' + values.numero.trim(), values.bairro, values.complemento.trim()].filter(Boolean);
    message.push('📍 *Endereço:* ' + address.join(' · '));
    if (values.referencia.trim()) message.push('*Referência:* ' + values.referencia.trim());
  }
  if (values.troco?.trim()) message.push('*Troco para:* R$ ' + values.troco.trim());
  if (values.obs.trim()) message.push('📝 *Observações:* ' + values.obs.trim());
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message.join('\n'));
}

const categoryPhotos = [0, 6, 15, 22, 31, 38, 39, 45];
const featuredPhotos = [31, 15, 32];
function renderHighlights() {
  const featuredCards = featuredPhotos.map(photo => {
    const group = catalogo.find(category => category.items.some(item => item.pic === photo));
    return itemCard(group.items.find(item => item.pic === photo), group);
  });
  document.querySelector('#highlight-items').replaceChildren(...featuredCards);
}

['Tudo', ...catalogo.map(group => group.name)].forEach((name, index) => {
  const filter = button('', 'category', () => {
    activeCategory = index - 1;
    Array.from(filters.children).forEach((control, controlIndex) => {
      control.setAttribute('aria-pressed', String(index === controlIndex));
    });
    renderMenu();
  });
  const thumb = make('span', '', 'category-thumb');
  if (index === 0) {
    thumb.innerHTML = '<svg class="glyph" aria-hidden="true"><use href="#icon-menu"/></svg>';
  } else {
    const image = make('img');
    image.src = 'fotos/' + categoryPhotos[index - 1] + '.webp';
    image.alt = '';
    thumb.append(image);
  }
  filter.append(thumb, make('span', name));
  filter.setAttribute('aria-pressed', String(index === 0));
  filters.append(filter);
});
search.addEventListener('input', () => {
  if (activeCategory !== -1) filters.firstElementChild.click();
  else renderMenu();
});
search.addEventListener('keydown', event => {
  if (event.key === 'Enter') document.querySelector('#cardapio').scrollIntoView();
});
document.querySelector('[data-sandwiches]').addEventListener('click', () => {
  search.value = '';
  const sandwiches = catalogo.findIndex(group => group.name === 'Sanduíches');
  filters.children[sandwiches + 1].click();
  filters.children[sandwiches + 1].scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
document.querySelectorAll('[data-open]').forEach(control => {
  control.addEventListener('click', () => drawer.showModal());
});
document.querySelector('#close').addEventListener('click', () => drawer.close());
for (const [zone, fee] of deliveryZones) {
  const option = make('option', zone + ' · ' + format(fee));
  option.value = zone;
  checkout.elements.bairro.append(option);
}
checkout.elements.modo.addEventListener('change', updateAddress);
checkout.elements.bairro.addEventListener('change', () => renderTotals());
checkout.elements.pagamento.addEventListener('change', updatePayment);
checkout.elements.telefone.addEventListener('input', () => checkout.elements.telefone.setCustomValidity(''));
checkout.elements.troco.addEventListener('input', () => checkout.elements.troco.setCustomValidity(''));
checkout.addEventListener('submit', event => {
  event.preventDefault();
  const entries = cartEntries();
  if (!entries.length) return;
  const values = Object.fromEntries(new FormData(checkout));
  for (const input of [checkout.elements.cliente, checkout.elements.rua, checkout.elements.numero]) {
    if (input.required && !input.value.trim()) {
      input.value = '';
      input.reportValidity();
      return;
    }
  }
  if (!/^[1-9]{2}9?[0-9]{8}$/.test(values.telefone.replace(/\D/g, ''))) {
    checkout.elements.telefone.setCustomValidity('Informe um celular com DDD.');
    checkout.elements.telefone.reportValidity();
    return;
  }
  if (values.troco?.trim() && !/^\d+(?:[,.]\d{1,2})?$/.test(values.troco.trim())) {
    checkout.elements.troco.setCustomValidity('Informe um valor como 100,00.');
    checkout.elements.troco.reportValidity();
    return;
  }
  window.open(orderLink(entries, values), '_blank', 'noopener,noreferrer');
});
renderHighlights();
renderMenu();
renderCart();
updateAddress();
updatePayment();

fetch('/api/catalog', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
  .then(response => response.ok ? response.json() : null)
  .then(data => {
    if (!data?.items) return;
    for (const [key, update] of Object.entries(data.items)) {
      const variant = variants.get(key);
      if (!variant) continue;
      if (Number.isInteger(update.price) && update.price > 0) variant.price = update.price;
      if (typeof update.image === 'string') variant.image = update.image;
    }
    const hero = catalogo.flatMap(group => group.items).find(item => item.pic === 31);
    document.querySelector('.hero-photo').src = productImage(hero, 0);
    renderHighlights();
    renderMenu();
    renderCart();
  })
  .catch(() => {});


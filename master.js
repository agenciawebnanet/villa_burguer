'use strict';

const endpoint = '/api/catalog';
const loginForm = document.querySelector('#master-login');
const editor = document.querySelector('#master-editor');
const logout = document.querySelector('#logout');
const status = document.querySelector('#master-status');
const preview = document.querySelector('#master-photo');
const itemSelect = editor.elements.item;
const items = new Map();
let updates = {};
let previewUrl;

for (const [groupIndex, group] of catalogo.entries()) {
  const options = document.createElement('optgroup');
  options.label = group.name;
  for (const [itemIndex, item] of group.items.entries()) {
    for (const [optionIndex, [option, price]] of item.options.entries()) {
      const id = [groupIndex, itemIndex, optionIndex].join('-');
      const photo = item.optionPics?.[optionIndex] ?? item.pic;
      items.set(id, { price, photo });
      options.append(new Option(option ? item.name + ' · ' + option : item.name, id));
    }
  }
  itemSelect.append(options);
}

async function request(query = '', body) {
  const response = await fetch(endpoint + query, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Villa-Master': '1' },
    body: JSON.stringify(body),
  } : { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.error || 'Não foi possível acessar o painel.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function resetPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function updatePhoto() {
  resetPreview();
  const id = itemSelect.value;
  const file = editor.elements.photo.files[0];
  const image = updates[id]?.image;
  if (file) previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl || (image && !editor.elements.restore.checked
    ? endpoint + '?image=' + encodeURIComponent(id) + '&v=' + encodeURIComponent(image)
    : '/fotos/' + items.get(id).photo + '.webp');
}

function selectItem() {
  const id = itemSelect.value;
  const price = updates[id]?.price ?? items.get(id).price;
  editor.elements.price.value = (price / 100).toFixed(2).replace('.', ',');
  editor.elements.photo.value = '';
  editor.elements.restore.checked = false;
  editor.elements.restore.disabled = !updates[id]?.image;
  updatePhoto();
}

async function openEditor() {
  updates = (await request()).items;
  loginForm.hidden = true;
  editor.hidden = logout.hidden = false;
  status.textContent = 'Selecione o produto ou a opção que deseja editar.';
  selectItem();
}

function showLogin() {
  loginForm.hidden = false;
  editor.hidden = logout.hidden = true;
  status.textContent = 'Entre com a senha administrativa.';
}

async function webpBase64(file) {
  if (file.size > 12 * 1024 * 1024) throw Error('Escolha uma imagem de até 12 MB.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', 0.84);
    if (!data.startsWith('data:image/webp;base64,') || data.length > 1398100) throw Error('Escolha uma foto menor em JPG, PNG ou WebP.');
    return data.split(',')[1];
  } finally {
    image.close();
  }
}

async function run(form, action) {
  const controls = form.querySelectorAll('button, input, select');
  const enabled = Array.from(controls).filter(control => !control.disabled);
  enabled.forEach(control => { control.disabled = true; });
  try {
    await action();
  } catch (error) {
    if (error.status === 401 && form === editor) showLogin();
    status.textContent = error.message;
  } finally {
    enabled.forEach(control => { control.disabled = false; });
    if (form === editor) editor.elements.restore.disabled = !updates[itemSelect.value]?.image;
  }
}

loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const password = loginForm.elements.password.value;
  run(loginForm, async () => {
    await request('', { action: 'login', password });
    loginForm.reset();
    await openEditor();
  });
});

logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    await request('', { action: 'logout' });
    showLogin();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    logout.disabled = false;
  }
});

itemSelect.addEventListener('change', selectItem);
editor.elements.photo.addEventListener('change', () => {
  if (editor.elements.photo.files.length) editor.elements.restore.checked = false;
  updatePhoto();
});
editor.elements.restore.addEventListener('change', () => {
  if (editor.elements.restore.checked) editor.elements.photo.value = '';
  updatePhoto();
});

editor.addEventListener('submit', event => {
  event.preventDefault();
  const id = itemSelect.value;
  const value = editor.elements.price.value.trim();
  if (!/^\d{1,6}(?:[,.]\d{1,2})?$/.test(value) || Number(value.replace(',', '.')) <= 0) {
    status.textContent = 'Informe um preço maior que zero, como 29,90.';
    editor.elements.price.focus();
    return;
  }
  const price = Math.round(Number(value.replace(',', '.')) * 100);
  const file = editor.elements.photo.files[0];
  const restoreImage = editor.elements.restore.checked;
  run(editor, async () => {
    status.textContent = 'Salvando alterações…';
    const image = file ? await webpBase64(file) : null;
    updates[id] = await request('', { action: 'save', id, price, image, restoreImage });
    selectItem();
    status.textContent = 'Alterações salvas. O cardápio já pode carregar os novos dados.';
  });
});

request('?admin=1').then(data => {
  if (!data.configured) {
    status.textContent = 'O painel precisa de um banco e das credenciais administrativas na Vercel.';
    return;
  }
  return data.authenticated ? openEditor() : showLogin();
}).catch(error => { status.textContent = error.message; });

(async () => {
  const role = await LovePhone.data.read('character');
  document.querySelector('#title').textContent = `你好，${role?.name || '朋友'}`;

  const count = Number(await LovePhone.storage.get('count') || 0);
  const text = document.querySelector('#count');
  text.textContent = `你已经打开过 ${count} 次。`;

  document.querySelector('#hello').onclick = async () => {
    const next = count + 1;
    await LovePhone.storage.set('count', next);
    text.textContent = `问候已留下，这是第 ${next} 次。`;
  };
})();

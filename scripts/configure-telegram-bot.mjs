const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL;

if (!token || !miniAppUrl) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_MINI_APP_URL before running this command.');
  process.exit(1);
}

if (!miniAppUrl.startsWith('https://')) {
  console.error('TELEGRAM_MINI_APP_URL must be a public HTTPS URL.');
  process.exit(1);
}

const callBotApi = async (method, body = {}) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`${method}: ${result.description ?? response.statusText}`);
  }

  return result.result;
};

const bot = await callBotApi('getMe');

await callBotApi('setMyCommands', {
  commands: [
    { command: 'start', description: 'Открыть Sakura Vape' },
    { command: 'shop', description: 'Перейти в магазин' },
  ],
});

await callBotApi('setChatMenuButton', {
  menu_button: {
    type: 'web_app',
    text: 'Открыть магазин',
    web_app: { url: miniAppUrl },
  },
});

await callBotApi('setMyDescription', {
  description: 'Sakura Vape: каталог, корзина, доставка и история заказов в Telegram.',
});

await callBotApi('setMyShortDescription', {
  short_description: 'Sakura Vape в Telegram',
});

console.log(`Configured @${bot.username}: ${miniAppUrl}`);

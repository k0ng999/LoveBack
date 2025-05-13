import express from 'express';
import webpush from 'web-push';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs/promises'; // используем промисифицированный fs
import path from 'path';

const app = express();
app.use(cors({
    origin: ['http://localhost:5173', 'https://k0ng999.github.io'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));
app.use(bodyParser.json());

const port = process.env.PORT || 4000;
const subscriptionsFile = path.resolve('./subscriptions.json');

// 🔑 VAPID
const vapidKeys = {
    publicKey: 'BLJwDpwOACqIj4pn9vkzHE9wyrSvR64EzbzCdjK5G4GKRzMXv9d_Fr2qzdSuwtXxVI35-ZPlIPJDxlYZoz00fr4',
    privateKey: '9AGMPFIYdXbTdA5kgzVevjQMdj8aPDvXgNPrzAkSqIA',
};
webpush.setVapidDetails('mailto:test@example.com', vapidKeys.publicKey, vapidKeys.privateKey);

// --- Утилиты для работы с файлом ---
async function getSubscriptions() {
    try {
        const raw = await fs.readFile(subscriptionsFile, 'utf8');
        if (!raw.trim()) return [];
        return JSON.parse(raw);
    } catch (err) {
        // Если файл не найден или JSON некорректен — возвращаем пустой список
        if (err.code !== 'ENOENT') console.error('[FS] Ошибка чтения/парсинга:', err);
        return [];
    }
}


// --- Роуты ---
app.get('/vapidPublicKey', (req, res) => {
    res.send(vapidKeys.publicKey);
});

app.post('/subscribe', async (req, res) => {
    try {
        const subscription = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Неверный формат подписки' });
        }

        const subs = await getSubscriptions();
        const exists = subs.some(s => s.endpoint === subscription.endpoint);
        if (!exists) {
            console.log('[SERVER] Добавляем подписку:------------------------------------------------------------->', subscription);
        } else {
            // console.log('[SERVER] Подписка уже существует:', subscription.endpoint);
        }

        res.status(201).json({ success: true });
    } catch (err) {
        console.error('[SERVER] /subscribe error:', err);
        res.status(500).json({ error: 'Не удалось сохранить подписку' });
    }
});

app.post('/sendNotification', async (req, res) => {
    try {
        // 1) Забираем senderSubscription из тела
        let sender = req.body?.senderSubscription;
        // console.log('[SERVER] Raw senderSubscription:', sender);

        // 2) Если это строка — пробуем распарсить
        if (typeof sender === 'string') {
            try {
                sender = JSON.parse(sender);
            } catch (e) {
                // console.error('[SERVER] Невалидный JSON в senderSubscription:', e);
                return res.status(400).json({ error: 'Невалидный формат senderSubscription' });
            }
        }

        // 3) Проверяем, что у нас есть объект с endpoint
        if (!sender || typeof sender.endpoint !== 'string') {
            // console.error('[SERVER] senderSubscription.endpoint отсутствует или не строка');
            return res.status(400).json({ error: 'senderSubscription не указан или некорректен' });
        }

        // 4) Нормализуем endpoint (убираем пробелы по краям)
        const senderEndpoint = sender.endpoint.trim();
        // console.log('[SERVER] Using sender.endpoint =', senderEndpoint);

        // 5) Читаем все подписки
        const allSubs = await getSubscriptions();
        // console.log('[SERVER] All endpoints:', allSubs.map(s => s.endpoint));

        // 6) Фильтруем — оставляем только те, чей endpoint не равен senderEndpoint
        const recipients = allSubs.filter(s => {
            const ep = typeof s.endpoint === 'string' ? s.endpoint.trim() : '';
            return ep !== senderEndpoint;
        });
        // console.log('[SERVER] Recipients endpoints:', recipients.map(s => s.endpoint));

        // 7) Если никого нет — сразу ответ
        if (recipients.length === 0) {
            // console.log('[SERVER] Никого не нужно уведомлять');
            return res.status(200).json({ success: true, message: 'Нет получателей' });
        }

        // 8) Готовим и шлем payload
        let payload;
        const p256dh = sender.keys?.p256dh;

        if (p256dh === 'BDo-Qix-qhyRYYuHYLECkldeJl9yJ9WNjghF8HaGCvpgltIPk3o4UDDRPmAcpfni2ZTLGi7-5ZkBsCA_D8K-E4s') {
            payload = JSON.stringify({ title: 'Ангелина нажала на кнопку', body: 'Я тебя люблю!', icon: "logo.png" });
        } else if (p256dh === 'BIqSR4K4jKUp6bFd2ldmaiD_OziiWjhf8YGecHTUQZeARWJTea9KbAOOyOz-WE3Y_ao49TMP0FQVEvt81ZDrHK0') {
            payload = JSON.stringify({ title: 'Ваня нажал на кнопку', body: 'Я тебя люблю!' });
        } else {
            payload = JSON.stringify({ title: 'Ваня нажал на кнопку', body: 'Я тебя люблю!' });
        }

        await Promise.allSettled(
            recipients.map(sub => webpush.sendNotification(sub, payload))
        );

        return res.status(200).json({ success: true });
    } catch (err) {
        // console.error('[SERVER] /sendNotification error:', err);
        return res.status(500).json({ error: 'Ошибка отправки уведомлений' });
    }
});




app.use((err, req, res, next) => {
    // console.error('[SERVER] Unhandled error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => console.log(`Server started on port ${port}`));

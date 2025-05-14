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

        // 2) Если это строка — пробуем распарсить
        if (typeof sender === 'string') {
            try {
                sender = JSON.parse(sender);
            } catch (e) {
                // Если невалидный JSON — просто обнуляем, чтобы отправить всем
                sender = null;
            }
        }

        // 3) Если sender есть и корректен — нормализуем endpoint
        let senderEndpoint = null;
        if (sender && typeof sender.endpoint === 'string') {
            senderEndpoint = sender.endpoint.trim();
        }

        // 4) Читаем все подписки
        const allSubs = await getSubscriptions();

        // 5) Фильтруем — исключаем отправителя, если он известен
        const recipients = allSubs.filter(s => {
            const ep = typeof s.endpoint === 'string' ? s.endpoint.trim() : '';
            return senderEndpoint ? ep !== senderEndpoint : true;
        });

        // 6) Если никого нет — сразу ответ
        if (recipients.length === 0) {
            return res.status(200).json({ success: true, message: 'Нет получателей' });
        }

        // 7) Готовим payload
        let payload;
        const p256dh = sender?.keys?.p256dh;

        if (p256dh === 'BIpp8vWQzNbwg-kYYI11_FZoRu0N-pxLelRsx8s-FuR5AuMrFcZSvMabV-1eu7_d9M9P3OxqiqbLvftkUt1XxRA') {
            payload = JSON.stringify({ title: 'Ангелина нажала на кнопку', body: 'Я тебя люблю!', icon: "logo.png" });
        } else if (p256dh === 'BPixk2h1Ys5KnHTr7x1f2Dq3a86TyAL4MNDqi1uFW0MVUBGVel225vuIHCCDuR-7MGga-eI5Rvq5dVPkKLwfqps') {
            payload = JSON.stringify({ title: 'Ваня нажал на кнопку', body: 'Я тебя люблю!', icon: "logo.png" });
        } else {
            payload = JSON.stringify({ title: 'Ваня нажал на кнопку', body: 'Я тебя люблю!', icon: "logo.png" });
        }

        // 8) Рассылка
        await Promise.allSettled(
            recipients.map(sub => webpush.sendNotification(sub, payload))
        );

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: 'Ошибка отправки уведомлений' });
    }
});




app.use((err, req, res, next) => {
    // console.error('[SERVER] Unhandled error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => console.log(`Server started on port ${port}`));
// 1 - яндкес
// 2 - мой айфон
// 3 - ангелина
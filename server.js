import express from 'express';
import webpush from 'web-push';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs/promises'; // используем промисифицированный fs
import path from 'path';
import { Pool } from 'pg';

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




// Настройки подключения к базе subs
const pool = new Pool({
    user: 'postgres.syqsgbsymiigkocpdtpc',
    host: 'aws-0-us-east-2.pooler.supabase.com',
    database: 'postgres',  // имя базы данных
    password: '1IvannIvan1.',
    port: 5432,
});


async function addSubscription(subscription) {
    const query = `
    INSERT INTO subs(subscriptions)
    VALUES ($1::jsonb)
    RETURNING id;
  `;

    try {
        const res = await pool.query(query, [JSON.stringify(subscription)]);
        console.log('Inserted with id:', res.rows[0].id);
    } catch (err) {
        console.error('Error inserting subscription:', err);
    }
}



// Пример данных, которые нужно вставить
// const subscriptionData = {
//     endpoint: "https://fcm.googleapis.com/fcm/send/e9hIG0HdpwI:APA91bEerUc-x00YVI4xGlmU-xKKnFuaGps8WDnRx27JEQkYteK8ipTUA82fC_Vb2q8_SJscG-J1wD5tx802kVrDxhNSHxqoB6MAZnoV9SbpKueinCovKUlbTwmB5IT8IsrNpiwDN_Lb",
//     expirationTime: null,
//     keys: {
//         p256dh: "BPMPLS93-oCyTUYx9sttkec79LYs9kyKVf9USXfvMVnQooVMpmcJI1byVEY0fKcFXukA6PUI7DwEjBphWuO9qjs",
//         auth: "P-cSGFVGzFO4EEDUa6O17w"
//     }
// };

// addSubscription(subscriptionData);



async function getAllSubscriptions() {
    const query = `
    SELECT * FROM subs;
  `;

    try {
        const res = await pool.query(query);
        const subscriptions = res.rows.map(row => row.subscriptions);

        return subscriptions;
    } catch (err) {
        console.error('Error fetching subscriptions:', err);
        return [];
    }
}


// getAllSubscriptions().then(subs => {
//     // можно отправить уведомления каждому
//     subs.forEach(sub => {
//         console.log('Send push to:', sub.endpoint);
//     });
// });











app.post('/subscribe', async (req, res) => {
    try {
        const subscription = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Неверный формат подписки' });
        }

        const subs = await getAllSubscriptions();

        const exists = subs.some(s => s.endpoint === subscription.endpoint);

        if (!exists) {
            console.log('[SERVER] Добавляем подписку:', subscription.endpoint);
            await addSubscription(subscription);
        } else {
            console.log('[SERVER] Подписка уже существует:', subscription.endpoint);
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
        const allSubs = await getAllSubscriptions();

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

        payload = JSON.stringify({ title: 'Не скучай', body: 'Я тебя люблю!', icon: "logo.png" });


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

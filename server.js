import express from 'express'
import webpush from 'web-push'
import bodyParser from 'body-parser'
import cors from 'cors'

const app = express();
app.use(cors({
    origin: ['http://localhost:5173', 'https://k0ng999.github.io/Love/'], // Разрешённые источники
    methods: ['GET', 'POST'], // Разрешённые методы
    allowedHeaders: ['Content-Type'], // Разрешённые заголовки
}));

app.use(bodyParser.json());

const port = process.env.PORT || 4000
// 🔑 Твои VAPID-ключи
const vapidKeys = {
    publicKey: 'BLJwDpwOACqIj4pn9vkzHE9wyrSvR64EzbzCdjK5G4GKRzMXv9d_Fr2qzdSuwtXxVI35-ZPlIPJDxlYZoz00fr4',
    privateKey: '9AGMPFIYdXbTdA5kgzVevjQMdj8aPDvXgNPrzAkSqIA',
};

webpush.setVapidDetails(
    'mailto:test@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

let subscriptions = [];

app.get('/vapidPublicKey', (req, res) => {
    res.send(vapidKeys.publicKey);
});

app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    subscriptions.push(subscription);
    res.status(201).json({});
});

app.post('/sendNotification', async (req, res) => {
    const payload = JSON.stringify({
        title: 'Привет!',
        body: 'Это пуш по кнопке!',
    });

    const results = await Promise.allSettled(
        subscriptions.map(sub => webpush.sendNotification(sub, payload))
    );

    // Удалим невалидные подписки
    subscriptions = subscriptions.filter((_, i) => {
        const result = results[i];
        return !(result.status === 'rejected' &&
            result.reason?.statusCode === 410); // 410 = Gone
    });

    console.log('[SERVER] Push отправлен. Ошибки:', results.filter(r => r.status === 'rejected').length);
    res.status(200).send('Уведомление отправлено');
});


app.listen(port, () => console.log(`Server started on port ${port}`));

// server.js
import express from 'express';
import fs from 'fs';
import path from 'path';
const app = express();

app.use(express.json());
app.use(express.static('.')); 

app.put('/data/secura-data.json', (req, res) => {
    const filePath = path.resolve('./data/secura-data.json');
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.status(200).send({ status: 'ok' });
});

app.listen(3000, () => console.log('✅ SECURA backend sur http://localhost:3000'));
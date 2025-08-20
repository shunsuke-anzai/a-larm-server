const express = require('express');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/prompt/:number', (req, res) => {
  const number = parseInt(req.params.number);
  
  if (number < 1 || number > 5 || isNaN(number)) {
    return res.status(400).json({ error: 'プロンプト番号は1から5で指定してください' });
  }
  
  try {
    const message = fs.readFileSync(`${number}.txt`, 'utf8').trim();
    res.json({ message: message });
  } catch (error) {
    res.status(500).json({ error: `${number}.txtが読み込めませんでした` });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
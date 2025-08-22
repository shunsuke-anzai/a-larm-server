const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// 文字エンコーディングを適切に処理するための設定
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// VOICEVOX APIのベースURL
const VOICEVOX_BASE_URL = 'http://localhost:50021';

// キャラクター（話者）IDのマッピング
const SPEAKERS = {
  1: { name: '四国めたん（ノーマル）', id: 2 },
  2: { name: 'ずんだもん（ノーマル）', id: 3 },
  3: { name: '春日部つむぎ（ノーマル）', id: 8 },
  4: { name: '雨晴はう（ノーマル）', id: 10 },
  5: { name: '波音リツ（ノーマル）', id: 9 }
};

// 指定したキャラクターでテキストを音声合成するAPI
app.post('/api/prompt/:number', async (req, res) => {
  console.log('=== リクエスト受信 ===');
  console.log('URL:', req.url);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  
  const number = parseInt(req.params.number);
  const { text } = req.body;
  
  // パラメータ検証
  if (number < 1 || number > 5 || isNaN(number)) {
    return res.status(400).json({ 
      error: 'キャラクター番号は1から5の間で指定してください',
      available_characters: SPEAKERS
    });
  }
  
  if (!text || text.trim() === '') {
    return res.status(400).json({ 
      error: 'textパラメータが必要です',
      example: { text: '合成したいテキストをここに入力' }
    });
  }
  
  const speaker = SPEAKERS[number];
  console.log(`キャラクター: ${speaker.name} (ID: ${speaker.id})`);
  console.log(`テキスト: ${text.trim()}`);
  
  try {
    // 1. VOICEVOXでaudio_queryを生成
    console.log(`送信するテキスト: "${text.trim()}"`);
    console.log(`テキストの文字数: ${text.trim().length}`);
    
    const queryResponse = await axios.post(
      `${VOICEVOX_BASE_URL}/audio_query`,
      null,
      {
        params: {
          text: text.trim(),
          speaker: speaker.id
        },
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    console.log('audio_query生成成功');
    console.log('Query response size:', JSON.stringify(queryResponse.data).length);
    
    // 2. VOICEVOXで音声合成
    const synthesisResponse = await axios.post(
      `${VOICEVOX_BASE_URL}/synthesis`,
      queryResponse.data,
      {
        params: {
          speaker: speaker.id
        },
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/json'
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    console.log('音声合成成功');
    console.log('Synthesis response size:', synthesisResponse.data.byteLength);
    
    // 3. 音声ファイルを返す
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': `attachment; filename="character${number}_audio.wav"`
    });
    res.send(Buffer.from(synthesisResponse.data));
    
  } catch (error) {
    console.error('エラー詳細:', error.message);
    if (error.code === 'ECONNREFUSED') {
      res.status(500).json({ error: 'VOICEVOXエンジンに接続できません。起動していることを確認してください。' });
    } else if (error.response && error.response.status === 422) {
      res.status(400).json({ error: '音声合成に失敗しました。テキストが無効な可能性があります。' });
    } else {
      res.status(500).json({ error: '音声生成に失敗しました' });
    }
  }
});

// キャラクター一覧を取得するAPI
app.get('/api/characters', (req, res) => {
  res.json({
    characters: SPEAKERS,
    usage: 'POST /api/prompt/{character_number} with { "text": "your text" }'
  });
});

// サーバーの動作確認用
app.get('/', (req, res) => {
  res.json({
    message: "AI Alarm Server is running!",
    endpoints: [
      "POST /api/prompt/:number - 指定キャラクターで音声合成",
      "GET /api/characters - キャラクター一覧"
    ],
    example: {
      url: "POST /api/prompt/1",
      body: { text: "おはようございます！" }
    }
  });
});

// サーバー起動時にVOICEVOXの接続確認
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // 文字エンコーディングの確認
  console.log('デフォルト文字エンコーディング:', process.env.NODE_OPTIONS);
  
  // VOICEVOXの接続確認
  try {
    await axios.get(`${VOICEVOX_BASE_URL}/version`);
    console.log('✅ VOICEVOXエンジンとの接続確認完了');
  } catch (error) {
    console.log('❌ VOICEVOXエンジンに接続できません。先に起動してください。');
    console.log('   http://localhost:50021 で確認できます');
  }
});

// npm start でサーバーを起動
// terminalで run.exeで VOICEVOXエンジンを起動しておく
// ngrok http 3000 でトンネルを作成
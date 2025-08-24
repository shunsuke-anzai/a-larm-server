const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 文字エンコーディングを適切に処理するための設定
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// 静的ファイル（画像）を提供
app.use('/prompts', express.static(path.join(__dirname, 'prompts')));

// VOICEVOX APIのベースURL
const VOICEVOX_BASE_URL = 'http://localhost:50021';

// プロンプトファイルを読み込む関数
function loadSystemPrompt(folderName) {
  try {
    const filePath = path.join(__dirname, 'prompts', folderName, `${folderName}_model.txt`);
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.warn(`プロンプトファイルの読み込みに失敗: ${folderName}`, error.message);
    return `あなたは${folderName}キャラクターです。`;
  }
}

// 画像URLを生成する関数
function getImageUrl(folderName) {
  const imagePath = path.join(__dirname, 'prompts', folderName, `${folderName}.jpg`);
  if (fs.existsSync(imagePath)) {
    return `/prompts/${folderName}/${folderName}.jpg`;
  }
  return null;
}

// キャラクター（話者）IDのマッピング - AssistantPersona形式
const CHARACTERS = {
  "sporty_friend": { 
    id: "sporty_friend",
    displayName: "体育会系の友達",
    description: "元気で熱血！一緒にトレーニングしよう！",
    systemPromptTemplate: loadSystemPrompt('Athletic'),
    imageUrl: getImageUrl('Athletic'),
    speaker_id: 100, // 黒沢こはく
    voice_settings: {
      speedScale: 1.1,
      pitchScale: 0.05,
      intonationScale: 1.2,
      volumeScale: 1.0
    }
  },
  "gentle_mother": { 
    id: "gentle_mother",
    displayName: "優しいお母さん",
    description: "温かくて包容力のあるお母さん",
    systemPromptTemplate: loadSystemPrompt('Mother'),
    imageUrl: getImageUrl('Mother'),
    speaker_id: 20,  // もち子
    voice_settings: {
      speedScale: 1.0,
      pitchScale: 0.0,
      intonationScale: 1.1,
      volumeScale: 0.95
    }
  },
  "mature_sister": { 
    id: "mature_sister",
    displayName: "大人の魅力があるお姉さん",
    description: "落ち着いた大人の女性の魅力",
    systemPromptTemplate: loadSystemPrompt('Older'),
    imageUrl: getImageUrl('Older'),
    speaker_id: 9,  // 波音リツ
    voice_settings: {
      speedScale: 1.0,
      pitchScale: 0,
      intonationScale: 1.0,
      volumeScale: 0.9
    }
  },
  "tsundere_childhood": { 
    id: "tsundere_childhood",
    displayName: "ツンデレの幼馴染",
    description: "素直になれないけど本当は優しい幼馴染",
    systemPromptTemplate: loadSystemPrompt('Tsundere'),
    imageUrl: getImageUrl('Tsundere'),
    speaker_id: 47,  // 冥鳴ひまり
    voice_settings: {
      speedScale: 1.05,
      pitchScale: 0.0,
      intonationScale: 1.0,
      volumeScale: 1.0
    }
  },
  "active_sister": { 
    id: "active_sister",
    displayName: "活発な妹（カスタムなし）",
    description: "デフォルト設定での音声生成（処理時間比較用）",
    systemPromptTemplate: loadSystemPrompt('Younger'),
    imageUrl: getImageUrl('Younger'),
    speaker_id: 3,  // ずんだもん
    voice_settings: {
      speedScale: 1.0,
      pitchScale: 0.0,
      intonationScale: 1.0,
      volumeScale: 1.0
    }
  }
};

// 指定したキャラクターでテキストを音声合成するAPI
app.post('/api/prompt/:id', async (req, res) => {
  const startTime = Date.now(); // 処理開始時間を記録
  
  console.log('=== リクエスト受信 ===');
  console.log('URL:', req.url);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  console.log('処理開始時刻:', new Date(startTime).toISOString());
  
  const characterId = req.params.id;
  const { text } = req.body;
  
  // パラメータ検証
  if (!CHARACTERS[characterId]) {
    return res.status(400).json({ 
      error: `キャラクターID '${characterId}' が見つかりません`,
      available_characters: Object.keys(CHARACTERS)
    });
  }
  
  const character = CHARACTERS[characterId];
  
  if (!text || text.trim() === '') {
    return res.status(400).json({ 
      error: 'textパラメータが必要です',
      example: { text: '合成したいテキストをここに入力' }
    });
  }

  console.log(`キャラクター: ${character.displayName}`);
  console.log(`テキスト: ${text.trim()}`);
  console.log(`音声設定:`, character.voice_settings);
  
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
          speaker: character.speaker_id
        },
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    console.log('audio_query生成成功');
    console.log('Query response size:', JSON.stringify(queryResponse.data).length);
    
    // 2. 音声パラメータをカスタマイズ
    const audioQuery = queryResponse.data;
    const settings = character.voice_settings;
    
    audioQuery.speedScale = settings.speedScale;
    audioQuery.pitchScale = settings.pitchScale;
    audioQuery.intonationScale = settings.intonationScale;
    audioQuery.volumeScale = settings.volumeScale;
    
    console.log('音声パラメータを適用:', settings);
    
    // 3. VOICEVOXで音声合成
    const synthesisResponse = await axios.post(
      `${VOICEVOX_BASE_URL}/synthesis`,
      audioQuery,
      {
        params: {
          speaker: character.speaker_id
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
    
    // 処理完了時間を記録
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.log('処理完了時刻:', new Date(endTime).toISOString());
    console.log(`🕒 総処理時間: ${processingTime}ms (${(processingTime/1000).toFixed(2)}秒)`);
    
    // 4. 音声ファイルを返す
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': `attachment; filename="character_${characterId}.wav"`,
      'X-Processing-Time': `${processingTime}ms` // ヘッダーにも処理時間を追加
    });
    res.send(Buffer.from(synthesisResponse.data));
    
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    console.error('エラー詳細:', error.message);
    console.log(`❌ エラー発生時の処理時間: ${processingTime}ms (${(processingTime/1000).toFixed(2)}秒)`);
    
    if (error.code === 'ECONNREFUSED') {
      res.status(500).json({ 
        error: 'VOICEVOXエンジンに接続できません。起動していることを確認してください。',
        processingTime: `${processingTime}ms`
      });
    } else if (error.response && error.response.status === 422) {
      res.status(400).json({ 
        error: '音声合成に失敗しました。テキストが無効な可能性があります。',
        processingTime: `${processingTime}ms`
      });
    } else {
      res.status(500).json({ 
        error: '音声生成に失敗しました',
        processingTime: `${processingTime}ms`
      });
    }
  }
});

// キャラクター一覧を取得するAPI - AssistantPersona形式
app.get('/api/characters', (req, res) => {
  const characterList = Object.values(CHARACTERS).map(char => ({
    id: char.id,
    displayName: char.displayName,
    description: char.description,
    systemPromptTemplate: char.systemPromptTemplate,
    imageUrl: char.imageUrl
  }));
  
  res.json(characterList);
});

// サーバーの動作確認用
app.get('/', (req, res) => {
  res.json({
    message: "AI Alarm Server is running!",
    endpoints: [
      "POST /api/prompt/:id - 指定キャラクターIDで音声合成",
      "GET /api/characters - キャラクター一覧"
    ],
    example: {
      url: "POST /api/prompt/sporty_friend",
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
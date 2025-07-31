<script setup>
import { inject, ref, reactive, onMounted, vModelCheckbox, computed } from "vue"
import socketManager from '../socketManager.js'
import io from "socket.io-client"
import { GoogleGenAI } from "@google/genai";

class Message {
  constructor(user, text, dateTime, isLabeled){
    this.user = user;
    this.text = text;
    this.dateTime = dateTime;
    this.isLabeled = isLabeled;
  }
}

const label_1 = "重要"
const label_2 = "交通手段"
const label_3 = "観光場所"
const labels = [label_1, label_2, label_3]

const ai = new GoogleGenAI({
  apiKey: "API_KEY_HERE"
});

// #region global state
const userName = inject("userName")
// #endregion

// #region local variable
const socket = socketManager.getInstance()
// #endregion

// #region reactive variable
const chatContent = ref("")
const participants = ref("")
const participantsList = ref([])
const chatList = reactive([])
const isLabeled = reactive([false, false])
// isLabeled.value = [false, false]
const geminiResponse = ref("")
const isGeminiLoading = ref(false)
// #endregion

// マークダウンをHTMLに変換する関数
const parseMarkdown = (text) => {
  return text
    .replace(/### (.*$)/gim, '<h3>$1</h3>')
    .replace(/## (.*$)/gim, '<h2>$1</h2>')
    .replace(/# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\* (.*$)/gim, '<li>$1</li>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/(\n<li>.*<\/li>)+/gim, '<ul>$&</ul>')
    .replace(/\n/gim, '<br>')
}

// マークダウンを適用したGemini応答
const formattedGeminiResponse = computed(() => {
  if (!geminiResponse.value) return ''
  return parseMarkdown(geminiResponse.value)
})

// #region lifecycle
onMounted(() => {
  registerSocketEvent()
})
// #endregion

// #region browser event handler
// 投稿メッセージをサーバに送信する
const onPublish = () => {
  //console.log("a")
  if (chatContent.value.trim() === "") {
    alert("投稿内容を入力してください")
    return
  }
  const nowTime = new Date();
  const sendLabels = [...isLabeled]
  const newMessage = new Message(userName.value, chatContent.value, nowTime, sendLabels)
  console.log(newMessage)
  socket.emit("publishEvent", newMessage);
  // 入力欄を初期化
  chatContent.value = ""
  clearLabeled()
}

function clearLabeled(){
  for (let i = 0; i < labels.length; i++){
    isLabeled[i] = false
  }
}
// 退室メッセージをサーバに送信する
const onExit = () => {

  socket.emit("exitEvent", userName.value + "さんが退室しました。")

}

// メモを画面上に表示する
const onMemo = () => {
  // メモの内容を表示
  chatList.unshift(userName.value + "さんのメモ：" + chatContent.value)
  // 入力欄を初期化
  chatContent.value = ""
}

// #endregion

// #region socket event handler
// サーバから受信した入室メッセージ画面上に表示する
const onReceiveEnter = (data) => {
  chatList.unshift(data + "さんが入室しました。")
}

// サーバから受信した退室メッセージを受け取り画面上に表示する
const onReceiveExit = (data) => {
  chatList.unshift(data)
}

// サーバから受信した投稿メッセージを画面上に表示する
const onReceivePublish = (data) => {
  chatList.unshift(data.user + "さん: " + data.text)
}

// 参加者一覧を更新
const onReceiveUpdateParticipants = (data) => {
  participants.value = data
  participantsList.value = data.split(", ")
  console.log(participantsList, participants, data)
}

// 過去メッセージを取得
const onGetMessages = (data) => {
  data.forEach(function(element, index, array) {
    const message = Object.assign(new Message(), element)
    chatList.push(message.user + "さん: " + message.text)
  })
}
// #endregion

// #region local methods
// イベント登録をまとめる
const registerSocketEvent = () => {
  // 入室イベントを受け取ったら実行
  socket.on("enterEvent", (data) => {
    onReceiveEnter(data)
  })

  // 退室イベントを受け取ったら実行
  socket.on("exitEvent", (data) => {
    onReceiveExit(data)
  })

  // 投稿イベントを受け取ったら実行
  socket.on("publishEvent", (data) => {
    onReceivePublish(data)
  })

  // 参加者一覧更新を受け取ったら実行
  socket.on("updateParticipants", (data) => {
    onReceiveUpdateParticipants(data);
  })

  socket.on("getMessages", (data) => {
    onGetMessages(data)
  })
}
// #endregion

socket.emit("getMessages", "")

//ctrl+enter or command+enter で投稿
const onKeydownPublish = (e) =>{
  if (e.ctrlKey || e.metaKey){
    onPublish();
  }
}

async function requestGemini() {
  isGeminiLoading.value = true;
  try {
    // チャット履歴を文字列として結合
    const chatHistory = chatList.join('\n');
    
    const prompt = `以下のチャット履歴を要約して、重要なポイントをまとめてください(新しいチャットが上にあり、古いチャットが下になっています。)：

${chatHistory}

重要な情報、決定事項、注目すべき点を整理して、簡潔にまとめてください。特に、「決まっていること」「やらなければいけないこと」「相談事項」をまとめてください。`;
    console.log("DEBUG(prompt): " + prompt)

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    console.log(response.text);
    geminiResponse.value = response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    geminiResponse.value = "エラーが発生しました。もう一度お試しください。";
  } finally {
    isGeminiLoading.value = false;
  }
}

</script>

<template>
  <div class="mx-auto my-5 px-4">
    <h1 class="text-h3 font-weight-medium">Vue.js Chat チャットルーム</h1>
    <div class="mt-10">
      <button class="button-normal" @click="requestGemini" :disabled="isGeminiLoading">
        <span v-if="!isGeminiLoading">Geminiで要約</span>
        <span v-else>
          <div class="loading-spinner"></div>
          生成中...
        </span>
      </button>
      <div class="mt-5" v-if="geminiResponse">
        <h3>Gemini要約結果:</h3>
        <div class="gemini-response" v-html="formattedGeminiResponse"></div>
      </div>
      
      <p>ログインユーザ：{{ userName }}さん</p>

      <p>参加者: {{ participants }}</p>
      <textarea variant="outlined" placeholder="投稿文を入力してください" rows="4" class="area" v-model="chatContent" @keydown.enter="onKeydownPublish"></textarea>

      <div class="mt-5">
        <button class="button-normal" @click="onPublish">投稿</button>
        <button class="button-normal util-ml-8px" @click="onMemo">メモ</button>
      </div>
      <!-- <div class="mt-5" v-if="labels.length !== 0">
          <input class = "label-input" v-for = "(label, i) in labels" :key = "i" v-model = "isLabeled.value" type = "checkbox">
      </div> -->
      <div class="mt-5" v-for = "(checked, i) in isLabeled" :key = i>
        <label for = "a">
          <input class = "label-input" type = "checkbox" v-model="isLabeled[i]"></input>
          {{ labels[i] }}
        </label>
      </div>
      <div class="mt-5" v-if="chatList.length !== 0">
        <ul>
          <li class="item mt-4" v-for="(chat, i) in chatList" :key="i">{{ chat }}</li>
        </ul>
      </div>
    </div>
    <router-link to="/" class="link">
      <button type="button" class="button-normal button-exit" @click="onExit">退室する</button>
    </router-link>
  </div>
  <div class="hamburger-menu">
  <input type="checkbox" id="menu-btn-check">
  <label for="menu-btn-check" class="menu-btn">
    <span></span>
    <span></span>
    <span></span>
  </label>
  
  <div class="menu-content">
    <div class="menu-item menu-profile">
      <span class="user-name">参加者</span>
    </div>

    <div class = "active-user">
      <span class="user-name">
        <div v-for="(participant, i) in participantsList" :key="i">
          {{ participant }}さん
        </div>
      </span>
    </div>

    <div class="menu-item menu-labels">
      <p class="menu-title">ラベル一覧</p>
      <ul>
        <li v-for="(label, i) in labels" :key="i"><a href="#">{{ label }}</a></li>
      </ul>
    </div>

    <div class="menu-item menu-actions">
      <router-link to="/" class="link">
      <button type="button" class="button-normal button-exit" @click="onExit">退室</button>
    </router-link>
    </div>
  </div>
  </div>
</template>

<style scoped>
.link {
  text-decoration: none;
}

.area {
  width: 500px;
  border: 1px solid #000;
  margin-top: 8px;
}

.item {
  display: block;
  white-space: pre-line;
}

.util-ml-8px {
  margin-left: 8px;
}

.button-exit {
  color: #000;
  margin-top: 8px;
}

.hamburger-menu {
  position: fixed;
  right: 20px;
  top: 20px;
  z-index: 100;
}

#menu-btn-check {
  display: none;
}

.menu-btn {
  display: block;
  width: 33px;
  height: 33px;
  background: #333;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  z-index: 2;
}

.menu-btn span {
  display: block;
  width: 15px;
  height: 2px;
  background-color: #fff;
  position: absolute;
  left: 9px;
  transition: all 0.5s;
}

.menu-btn span:nth-of-type(1) {
  top: 9px;
}

.menu-btn span:nth-of-type(2) {
  top: 15px;
}

.menu-btn span:nth-of-type(3) {
  bottom: 9px;
}

#menu-btn-check:checked ~ .menu-btn span:nth-of-type(1) {
  top: 15px;
  transform: rotate(45deg);
}

#menu-btn-check:checked ~ .menu-btn span:nth-of-type(2) {
  opacity: 0;
}

#menu-btn-check:checked ~ .menu-btn span:nth-of-type(3) {
  top: 15px;
  transform: rotate(-45deg);
}

.menu-content {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 0;
  right: -100%; 
  z-index: 1;
  background-color: #f1f1f1;
  transition: all 0.5s;
  padding-top: 60px;
}

.menu-content ul {
  padding: 0 20px;
}

.menu-content ul li {
  list-style: none;
  margin-bottom: 20px;
}

.menu-content ul li a {
  color: #333;
  text-decoration: none;
  font-size: 1.2rem;
}

#menu-btn-check:checked ~ .menu-content {
  right: 0; 
}

.menu-content {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 80px 20px 20px 20px; 
}

.active-user {
  width: 100%;
  max-width: 280px;
  border-bottom: 1px solid #ddd;
  padding: 20px 0;
  text-align: center; 
}

.menu-item {
  width: 100%;
  max-width: 280px; 
  border-bottom: 1px solid #ddd;
  padding: 20px 0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-profile {
  display: flex;
  align-items: center;
  border-bottom: none;
  padding-bottom: 0; 
}

.user-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 15px;
}

.user-name {
  font-weight: bold;
}

.menu-labels .menu-title {
  font-size: 0.9em;
  color: #777;
  margin: 0 0 10px 0;
}

.menu-labels ul {
  padding: 0;
  list-style: none;
}

.menu-labels ul li a {
  display: block;
  padding: 10px 0;
  color: #333;
  text-decoration: none;
  transition: background-color 0.2s;
}
.menu-labels ul li a:hover {
  background-color: #e9e9e9;
}

.menu-actions {
  text-align: center;
}

.gemini-response {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.5;
}

.gemini-response h1, .gemini-response h2, .gemini-response h3 {
  margin: 10px 0 5px 0;
  color: #333;
}

.gemini-response h1 {
  font-size: 18px;
}

.gemini-response h2 {
  font-size: 16px;
}

.gemini-response h3 {
  font-size: 14px;
}

.gemini-response ul {
  margin: 10px 0;
  padding-left: 20px;
}

.gemini-response li {
  margin: 5px 0;
}

.gemini-response strong {
  font-weight: bold;
}

.gemini-response em {
  font-style: italic;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #333;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>


<script setup>
import { inject, ref, reactive, onMounted, nextTick } from "vue"
import { useRouter } from "vue-router"
import socketManager from '../socketManager.js'
import VueMarkdown from 'vue3-markdown-it'

class Message {
  constructor(id, user, text, dateTime, isLabeled){
    this.id = id;
    this.user = user;
    this.text = text;
    this.dateTime = dateTime;
    this.isLabeled = isLabeled;
  }
}

var id;

const label_1 = "重要"
const label_2 = "旅行先"
const label_3 = "日程"
const label_4 = "交通手段"
const label_5 = "宿泊施設"
const label_6 = "予算"
const labels = [label_1, label_2, label_3, label_4, label_5, label_6]
// 各ラベルに対応するアイコンを追加
const labelIcons = [
  "priority_high", // 重要
  "place",         // 旅行先
  "calendar_today",// 日程
  "directions_car",// 交通手段
  "hotel",         // 宿泊施設
  "attach_money"   // 予算
]


// #region global state
const userName = inject("userName")
const router = useRouter()
// #endregion

// #region local variable
const socket = socketManager.getInstance()
const chatListRef = ref(null)
// #endregion

// #region reactive variable
const chatContent = ref("")
const participants = ref("")
const participantsList = ref([])
const chatList = reactive([])
const messageList = reactive([])
const isLabeled = reactive([false, false, false, false, false, false])
const isSelected = reactive([false, false, false, false, false, false])
const replyMessage = ref(null) // リプライ対象のメッセージ情報を格納
const availableLabels = reactive([
  { name: "重要", color: "#e74c3c", icon: "mdi-star" },
  { name: "旅行先", color: "#349834", icon: "mdi-map" },
  { name: "日程", color: "#27ae60", icon: "mdi-calendar" },
  { name: "交通手段", color: "#f39c12", icon: "mdi-car" },
  { name: "宿泊施設", color: "#8e44ad", icon: "mdi-home" },
  { name: "予算", color: "#a9a029", icon: "mdi-currency-usd" }
])
const summaryDocument = ref("")
const isLoadingSummary = ref(false)
// #endregion


// #region lifecycle
onMounted(() => {
  registerSocketEvent()
  socket.emit("getMessages", "")
  scrollToBottom()
})
// #endregion

// #region methods
const scrollToBottom = () => {
  nextTick(() => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    }
  })
}

const formatTime = (dateTime) => {
  return new Date(dateTime).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDate = (dateTime) => {
  return new Date(dateTime).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric'
  })
}

function clearLabeled(){
  for (let i = 0; i < labels.length; i++){
    isLabeled[i] = false
  }
}

const isEqualArray = function (array1, array2) {
  console.log(array1[0], array2[0])
   var i = array1.length;
   if (i != array2.length) return false;

   while (i--) {
     if (array1[i] !== array2[i]) return false;
   }
   return true;
 };

const select = function (messageLabels, selectedLabels){
  for(let i = 0; i < selectedLabels.length; i++){
    if(messageLabels[i] && selectedLabels[i]){
      return true
    }
  }
  return false
}

const onChangeSelection = () =>{
  console.log(isSelected)
  // console.log(chatList[0])
  console.log(messageList[0].isLabeled)
  console.log(messageList[0])
}

// リプライをクリアする処理
const clearReply = () => {
  replyMessage.value = null
}

const generateSummary = () => {
  socket.emit("requestGemini", "")
  isLoadingSummary.value = true
}

// #endregion

// #region browser event handler
// 投稿メッセージをサーバに送信する
const onPublish = () => {
  if (chatContent.value.trim() === "") {
    alert("投稿内容を入力してください")
    return
  }

  const nowTime = new Date()
  const sendLabels = [...isLabeled]

  socket.emit("getId");
  const newId = id;

  // リプライメッセージがある場合は元のメッセージを追加
  let messageText = chatContent.value.trim()
  if (replyMessage.value) {
    messageText += " > " + replyMessage.value.text
  }

  // const sendLabels = labels.filter((label, index) => isLabeled[index])
  const newMessage = new Message(newId, userName.value, messageText, nowTime, sendLabels)

  socket.emit("publishEvent", newMessage)

  // 入力欄を初期化
  chatContent.value = ""
  clearLabeled()

  // リプライメッセージをクリア
  replyMessage.value = null
  scrollToBottom()
}

const onDelete = (message) => {
  console.log(message)
  if (confirm("メッセージを削除します. よろしいですか?")){
    socket.emit("deleteEvent", message);
  }
}

const onExit = () => {
  router.push({ name: "login" })
}

const onReset = () => {
  for(let i = 0; i < isSelected.length; i++){
    isSelected[i] = false
  }
}

// リプライボタンがクリックされた時の処理
const onReply = (message) => {
  replyMessage.value = {
    text: message.text,
    user: message.user,
    timestamp: message.dateTime
  }
  console.log("リプライ先:", replyMessage.value)
}

//ctrl+enter or command+enter で投稿
const onKeydownPublish = (e) =>{
  if (e.ctrlKey || e.metaKey){
    onPublish();
  }
}

const onReceivePublish = (data) => {
  messageList.unshift(data)
  scrollToBottom()
}

const onReceiveUpdateParticipants = (data) => {
  participants.value = data
  participantsList.value = data.split(", ")
}

const onGetMessages = (data) => {
  data.forEach(function(element, index, array) {
    const message = Object.assign(new Message(), element)
    messageList.push(message)
  })
  scrollToBottom()
}

const onReceiveDeleteMessages = (data) => {

  let indexToRemove = messageList.findIndex(message => message.id === data.id);

  if (indexToRemove !== -1) {
    messageList.splice(indexToRemove, 1);
  }
}

const onReceiveNewId = (data) => {
  id = data;
}

const onUpdateGeminiResponse = (data) => {
  summaryDocument.value = data
  isLoadingSummary.value = false
}
// #endregion

// #region local methods
const registerSocketEvent = () => {
  socket.on("publishEvent", (data) => {
    // shownChatList = onChangeSelection()
    onReceivePublish(data)
  })

  socket.on("updateParticipants", (data) => {
    onReceiveUpdateParticipants(data)
  })

  socket.on("getMessages", (data) => {
    onGetMessages(data)
  })

  socket.on("deleteMessages", (data) => {
    onReceiveDeleteMessages(data)
  })

  socket.on("newId", (data) => {
    onReceiveNewId(data)
  })

  socket.on("updateGeminiResponse", (data) => {
    onUpdateGeminiResponse(data)
  })
}
// #endregion

socket.emit("getId");

</script>
<template>
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

  <div class="chat-container">
    <div class="ai-summary-menu">
      <input type="checkbox" id="ai-menu-btn-check">
      <label for="ai-menu-btn-check" class="menu-btn">
        <span class="material-icons">summarize</span>
      </label>
      <div class="menu-content">
        <div class="summary-container">
          <p class="menu-title">AI 会話要約</p>
          <div class="summary-document">
            <div v-if="isLoadingSummary" class="loading-spinner"></div>
            <VueMarkdown v-else-if="summaryDocument" :source="summaryDocument" class="markdown-content" />
            <div v-else class="empty-summary">
              <span class="material-icons" style="font-size: 48px; color: #bdc3c7; margin-bottom: 1rem;">chat_bubble_outline</span>
              <p style="color: #7f8c8d; text-align: center;">会話の要約を生成するには、下のボタンをクリックしてください。</p>
            </div>
          </div>
          <div class="summary-button-container">
            <v-btn
              @click="generateSummary"
              :loading="isLoadingSummary"
              :disabled="isLoadingSummary"
              color="primary"
              class="generate-button"
              :class="{ 'loading': isLoadingSummary }"
              block
            >
              <v-progress-circular
                v-if="isLoadingSummary"
                indeterminate
                size="20"
                width="2"
                color="white"
                class="mr-2"
              ></v-progress-circular>
              <span v-if="!isLoadingSummary" class="material-icons">auto_fix_high</span>
              {{ isLoadingSummary ? '生成中...' : '要約を生成' }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>


  <div class="hamburger-menu">
  <input type="checkbox" id="menu-btn-check">
  <label for="menu-btn-check" class="menu-btn">
    <span></span>
    <span></span>
    <span></span>
  </label>

  <div class="menu-content">

    <div class="menu-horizontal-container">
      <div class="participants-column">
        <div class="menu-item menu-profile">
          <span class="user-name">ログイン中のユーザ</span>
        </div>
        <div class="active-user">
          <span class="user-name">
            <div v-for="(participant, i) in participantsList" :key="i">
              {{ participant }}さん
            </div>
          </span>
        </div>
      </div>

      <div class="vertical-divider"></div>

      <div class="menu-item menu-labels">
  <p class="label-title">ラベルで絞り込み</p>
  <div class="label-checkboxes vertical-labels">  <label
      v-for="(label, i) in labels"
      :key="i"
      class="label-checkbox"
      :class="{ 'selected': isSelected[i] }"
    >
      <input
        type="checkbox"
        v-model="isSelected[i]"
        @change="onChangeSelection"
        class="checkbox-input"
      >
      <span class="material-icons">{{ labelIcons[i] }}</span>
      <span class="label-text">{{ label }}</span>
    </label>
  </div>
  <button type="button" class="button-normal button-reset" @click="onReset">リセット</button>
</div>
    </div>
    <div class="exit-section">
        <v-btn
          @click="onExit"
          block
          varilant="outlined"
          color="success"
          class="exit-main-button"
        >
          退室
        </v-btn>
      </div>
  </div>
  </div>

  <!-- メインコンテンツ -->
  <div class="chat-main">

    <!-- タイトル部分 -->
    <div class="chat-header">
      <h1 class="chat-title">旅行計画チャットルーム</h1>
      <p class="user-info">{{ userName }} さんでログイン中</p>
    </div>

      <!-- チャットエリア -->
      <div class="chat-messages" ref="chatListRef">
        <div class="messages-container">
          <!-- メッセージリスト -->
          <div
            v-for="(message, index) in (isEqualArray(isSelected, [false, false, false, false, false, false]) ? messageList : messageList.filter(message => {
              return select(message.isLabeled, isSelected)
            }))"
            :key="index"
            :class="[
              'message-item',
              {
                'own-message': message.user === userName,
              }
            ]"
          >
            <div class="message-bubble">
              <div class="message-header">
                <span class="message-user">{{ message.user }}</span>
                <div class="message-buttons">
                  <button class="reply-button" @click="onReply(message)" title="リプライ">
                    <span class="material-icons">reply</span>
                  </button>
                  <button class="delete-button" v-if="message.user == userName" @click="onDelete(message)">
                    <span class="material-icons">delete</span>
                  </button>
                </div>
              </div>
              <div class="message-content">{{ message.text }}</div>
              <div v-for="(label, i) in (labels)" :key="i">
                <v-chip
                  v-if="message.isLabeled[i]"
                  size="x-small"
                  :color="availableLabels.find(l => l.name == labels[i])?.color"
                  class="message-label"
                  variant="flat"
                >
                <span class="material-icons label-icons">{{ labelIcons[i] }}</span>
                <!--
                  <v-icon
                    size="x-small"
                    :icon="availableLabels.find(l => l.name == labels[i])?.icon"
                    start
                  ></v-icon>
                -->

                  {{ labels[i] }}
                </v-chip>
              </div>
              <div class="message-meta">
                <span class="message-time">{{ formatTime(message.dateTime) }}</span>
                <span class="message-date">{{ formatDate(message.dateTime) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 投稿エリア -->
      <div class="chat-input-area">
        <div class="input-container">
          <!-- リプライ表示 -->
          <div v-if="replyMessage" class="reply-section">
            <div class="reply-message">
              <v-icon color="primary" size="16">mdi-reply</v-icon>
              <span class="reply-text">{{ replyMessage.user }}さんへの返信: {{ replyMessage.text }}</span>
              <v-btn
                icon
                size="x-small"
                variant="text"
                @click="clearReply"
                class="clear-reply-btn"
              >
                <span class="material-icons">reply</span>
              </v-btn>
            </div>
          </div>

          <!-- ラベル選択 -->
          <div class="label-selection">
            <p class="label-title">ラベルを選択:</p>
            <div class="label-checkboxes">
              <label
                v-for="(label, i) in labels"
                :key="i"
                class="label-checkbox"
                :class="{ 'selected': isLabeled[i] }"
              >
                <input
                  type="checkbox"
                  v-model="isLabeled[i]"
                  class="checkbox-input"
                >
                <span class="material-icons">{{ labelIcons[i] }}</span>
                <span class="label-text">{{ label }}</span>
              </label>
            </div>
          </div>

          <!-- メッセージ入力 -->
          <div class="message-input-section">
            <div class="input-wrapper">
              <v-textarea
                v-model="chatContent"
                placeholder="メッセージを入力してください... (Ctrl+Enter / Cmd+Enterで送信)"
                variant="outlined"
                rows="3"
                no-resize
                class="chat-textarea"
                @keydown.enter="onKeydownPublish"
              ></v-textarea>
              <v-btn
                @click="onPublish"
                color="primary"
                size="large"
                class="send-button"
                :disabled="!chatContent.trim()"
              >
                <span class="material-icons">send</span>
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- 退室ボタン -->
      <div class="exit-section">
        <v-btn
          @click="onExit"
          block
          varilant="outlined"
          color="success"
          class="exit-main-button"
        >
          退室
        </v-btn>
      </div>
    </div>
  </div>

</template>

<style scoped>
/* ページ全体のスタイル */
.chat-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  position: relative;
}

/* メインコンテンツ */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: 2rem 1rem;
  gap: 1rem;
}

/* チャットタイトル */
.chat-header {
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  text-align: center;
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.user-info {
  color: #7f8c8d;
  font-size: 1rem;
  /* ユーザー名のみ 強調 */
  font-weight: bold;
  margin-top: 4px;
  display: inline-block;
}

/* チャットメッセージエリア */
.chat-messages {
  flex: 1;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  padding: 1.5rem;
  max-height: 400px;
  min-height: 300px;
}

.messages-container {
  display: flex;
  flex-direction: column-reverse;
  gap: 1rem;
}

.message-item {
  display: flex;
  align-items: flex-start;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-item.own-message {
  justify-content: flex-end;
}


.message-bubble {
  max-width: 70%;
  background: #f8f9fa;
  border-radius: 18px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.own-message .message-bubble {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
}


.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 0.8rem;
  opacity: 0.7;
}

.message-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.reply-button {
  background: rgba(52, 152, 219, 0.1);
  border: none;
  border-radius: 8px;
  padding: 4px 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reply-button:hover {
  background: rgba(52, 152, 219, 0.2);
}

.delete-button {
  background: rgb(210, 29, 29);
  border: none;
  border-radius: 8px;
  padding: 4px 7px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-button:hover {
  background: rgb(255, 41, 41);
}

.reply-section {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 12px;
  border-left: 4px solid #3498db;
}

.reply-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reply-text {
  flex: 1;
  font-size: 0.9rem;
  color: #2c3e50;
}

.clear-reply-btn {
  min-width: auto !important;
  width: 24px !important;
  height: 24px !important;
}

.filter-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.filter-checkbox:hover {
  background: rgba(255, 255, 255, 0.1);
}

.filter-text {
  font-size: 0.9rem;
  color: #2c3e50;
}

.reset-filter-btn {
  width: 100%;
  margin-top: 0.5rem;
}

.message-user {
  font-weight: 600;
}

.message-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.message-content {
  font-size: 0.95rem;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: pre-line;
}

.message-labels {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.reply-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 10px;
  min-width: 28px;
  height: 28px;
}

.reply-button .material-icons {
  font-size: 16px;
}

.reply-button:hover {
  background-color: #0056b3;
}

.util-ml-8px {
  margin-left: 8px;
}

.button-exit {
  color: #000;
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.message-label {
  height: 20px;
}

/* 投稿エリア */
.chat-input-area {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.label-selection {
  margin-bottom: 1rem;
}

.label-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.label-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.05rem;
}

.label-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  transition: all 0.3s ease;
  border: 2px solid #ecf0f1;
}

.label-checkbox.selected {
  background: #f8f9fa;
  border-color: #3498db;
}

.checkbox-input {
  display: none;
}

.label-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: #2c3e50;
}

.message-input-section {
  display: flex;
  gap: 1rem;
}

.input-wrapper {
  display: flex;
  gap: 1rem;
  width: 100%;
  align-items: flex-end;
}

.chat-textarea {
  flex: 1;
  border-radius: 12px;
}

.send-button {
  border-radius: 12px;
  height: 56px;
  width: 56px;
  min-width: 56px;
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
  transition: all 0.3s ease;
}

.send-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
}

/* 退室ボタン */
.exit-section {
  text-align: center; /* 退室ボタンの位置を中央に */
}

/* 退室ボタンのスタイル */
.exit-main-button {
  border-radius: 12px; /* 退室ボタンの角を丸く */
  font-weight: 800; /* 退室ボタンのフォントを太く */
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
}

/* 退室ボタンのホバー効果 */
.exit-main-button.v-btn--outlined:hover {
  background-color: rgba(40,167,69,0.1) !important; /* ホバー時の薄緑 */
}



/* ハンバーガーメニュー（元のデザインを保持） */
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
  background: rgb(0, 0, 0);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  position: relative;
  cursor: pointer;
  z-index: 2;
  transition: all 0.3s ease;
}

.menu-btn:hover {
  background: rgb(176, 176, 176);
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
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
  backdrop-filter: blur(20px);
  transition: all 0.5s;
  padding-top: 80px;
}

.menu-content ul {
  padding: 0 20px;
}

.menu-content ul li {
  list-style: none;
  margin-bottom: 0;
}

.ai-summary-menu .menu-content {
    left: -100%;
    right: auto;
}

#menu-btn-check:checked ~ .menu-content {
  right: 0;
}

#ai-menu-btn-check:checked ~ .menu-content {
  left: 0;
}

.menu-content {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  padding: 80px 20px 20px 20px;
}

#menu-btn-check:checked ~ .menu-content {
  right: 0;
}

.active-user {
  width: 100%;
  max-width: 340px;
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


.user-name{
  font-size: 1rem;
  color: #777;
  margin: 0 0 10px 0;
}

.menu-labels .menu-title {
  font-size: 1rem;
  color: #777;
  margin: 0 0 10px 0;
}

.menu-labels ul {
  padding: 0;
  list-style: none;
}

.label-button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  background: none;
  border: none;
  padding: 10px 5px;
  cursor: pointer;
  text-align: left;
  font-size: 1.2rem;
  color: #333;
  transition: background-color 0.2s;
  border-radius: 4px;
}

.label-button:hover {
  background-color: #e9e9e9;
}

.label-button .material-icons {
  font-size: 1.5rem;
}

.menu-actions {
  text-align: center;
}

.button-exit {
  color: #fff;
  background: linear-gradient(135deg, #94e54d, #36eb09); /* 退室ボタンのグラデーション */
  margin-top: 15px;
}

/* スクロールバーのカスタマイズ */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* AI Summary Menu */
.ai-summary-menu {
  position: fixed;
  left: 20px;
  top: 20px;
  z-index: 100;
}

#ai-menu-btn-check {
  display: none;
}

.ai-summary-menu .menu-btn > .material-icons {
  position: static !important;
  width: auto !important;
  height: auto !important;
  background: none !important;
  top: auto !important;
  left: auto !important;
  display: inline-flex !important;
  font-size: 30px; /* 必要なサイズに */
  color: white; /* アイコン色 */
}

.ai-summary-menu .menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  border-radius: 50%;
  cursor: pointer;
  z-index: 2;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
  position: relative;
}

.ai-summary-menu .menu-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4);
  background: linear-gradient(135deg, #2980b9, #1f639a);
}

.ai-summary-menu .menu-btn .material-icons {
  color: white; /* アイコンの色 */
  font-size: 30px; /* アイコンのサイズ */
}

.ai-summary-menu .menu-content {
  width: 400px;
  height: 100vh;
  position: fixed;
  top: 0;
  left: -400px;
  z-index: 1;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 249, 250, 0.95));
  backdrop-filter: blur(20px);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
}

#ai-menu-btn-check:checked ~ .menu-content {
  left: 0;
}

.summary-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  padding: 50px 20px 20px 20px;
  overflow: hidden;
}

.summary-container .menu-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #2c3e50;
  margin-bottom: 1.5rem;
  text-align: center;
  background: linear-gradient(135deg, #3498db, #2980b9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.summary-document {
  flex-grow: 1 1 auto;
  overflow-y: auto;
  background: white;
  border-radius: 15px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  color: #2c3e50;
  line-height: 1.7;
  font-size: 0.95rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(52, 152, 219, 0.1);
  min-height: 300px;
}

/* ボタンを常に下に見せる（押し出されない・スクロール外にいかない） */
.summary-button-container {
  position: sticky;
  bottom: 0;
}

.summary-document::-webkit-scrollbar {
  width: 6px;
}

/* スクロールバーのスタイル */
.summary-document::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}


/* スクロールバーのサムのスタイル */
.summary-document::-webkit-scrollbar-thumb {
  background: linear-gradient(135deg, #3498db, #2980b9);
  border-radius: 3px;
}

/* スクロールバーのサムのホバー時のスタイル */
.summary-document::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(135deg, #2980b9, #1f639a);
}

.generate-button {
  flex-shrink: 0;
  background: linear-gradient(135deg, #3498db, #2980b9) !important;
  color: white !important;
  border-radius: 12px !important;
  padding: 12px 24px !important;
  font-weight: 600 !important;
  font-size: 1rem !important;
  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3) !important;
  transition: all 0.3s ease !important;
  border: none !important;
}

.generate-button:hover:not(.loading) {
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4) !important;
}

.generate-button.loading {
  background: linear-gradient(135deg, #95a5a6, #7f8c8d) !important;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.generate-button .material-icons {
  margin-right: 8px;
  font-size: 20px;
}

.empty-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  text-align: center;
}

.loading-spinner {
  border: 3px solid rgba(52, 152, 219, 0.1);
  border-top: 3px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 30px auto;
}

.summary-footer {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95); /* 必要なら背景をつけて内容と被らないように */
  display: flex;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}


@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}



/* レスポンシブデザイン */
@media (max-width: 768px) {
  .chat-main {
    padding: 1rem 0.5rem;
  }

  .chat-header {
    padding: 1.5rem;
  }

  .chat-title {
    font-size: 1.5rem;
  }

  .message-bubble {
    max-width: 85%;
  }

  .label-checkboxes {
    justify-content: center;
  }

  .input-wrapper {
    flex-direction: column;
    align-items: stretch;
  }

  .send-button {
    height: 48px;
    width: 100%;
    min-width: auto;
  }
}
.reply-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.clear-reply-button {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.clear-reply-button .material-icons {
  font-size: 16px;
}

.clear-reply-button:hover {
  background-color: #c82333;
}

.menu-horizontal-container {
  display: flex;
  justify-content: space-evenly;
  align-items: flex-start;
  width: 100%;
  max-width: 340px;
  border-bottom: 1px solid #ddd;
  padding: 20px 0;
}

.menu-horizontal-container > div.participants-column,
.menu-horizontal-container > div.menu-labels {
  display: flex;
  flex-direction: column;
}

.menu-horizontal-container .menu-item,
.menu-horizontal-container .active-user {
  border-bottom: none;
  padding: 0;
  width: auto;
  max-width: none;
}
.menu-horizontal-container .menu-profile {
  padding-bottom: 10px;
}

.vertical-divider {
  width: 1px;
  align-self: stretch;
  background-color: #ccc;
}

.menu-horizontal-container .active-user {
  text-align: left;
}

.menu-horizontal-container .active-user .user-name div {
  font-size: 1.2rem;
  padding: 5px 0;
  color: #333;
}

.menu-labels .menu-title {
  font-size: 1rem;
  color: #777;
  margin: 0 0 10px 0;
  /* ★追加：少しだけ左に余白を持たせる */
  padding-left: 5px;
}

/* ★追加：チェックボックスとラベルのスタイル */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 5px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.checkbox-label:hover {
  background-color: #e9e9e9;
}

.checkbox-label .material-icons {
  font-size: 1.5rem;
  color: #555;
}

.checkbox-label span {
  font-size: 1.2rem;
  color: #333;
}

.checkbox-label .label-input {
  /* チェックボックスを右端に配置 */
  margin-left: auto;
  /* サイズを少し大きくする */
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.button-reset {
  margin-top: 15px;
  width: 100%;
  padding: 8px 0;
  font-size: 1.1rem;
}

.label-icons {
  font-size: 12px;
}

.vertical-labels {
  flex-direction: column;
  gap: 0.5rem; 
}

.menu-content .exit-section {
  width: 90%; 
  max-width: 340px; 
  margin: 20px auto 0 auto; 
}

.label-checkboxes .material-icons{
  font-size: 17px;
}

/* マークダウンコンテンツのスタイル */
.markdown-content {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: #2c3e50;
}

.markdown-content h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 0.5rem;
}

.markdown-content h2 {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 1.5rem 0 1rem 0;
  color: #34495e;
}

.markdown-content h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem 0;
  color: #34495e;
}

.markdown-content p {
  margin-bottom: 1rem;
}

.markdown-content ul, .markdown-content ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.markdown-content li {
  margin-bottom: 0.5rem;
}

.markdown-content strong {
  font-weight: 600;
  color: #2c3e50;
}

.markdown-content em {
  font-style: italic;
  color: #7f8c8d;
}

.markdown-content code {
  background: #f8f9fa;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  color: #e74c3c;
}

.markdown-content pre {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.markdown-content pre code {
  background: none;
  padding: 0;
  color: #2c3e50;
}

.markdown-content blockquote {
  border-left: 4px solid #3498db;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #7f8c8d;
  font-style: italic;
}
</style>

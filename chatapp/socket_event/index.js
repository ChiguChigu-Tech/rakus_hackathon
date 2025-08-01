import { GoogleGenAI } from "@google/genai"
import dotenv from "dotenv"

dotenv.config()

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE"
});

const clients = new Map()
// let messages = []
let messages = [
  {id: 18, user: "イトウ", text: "飛行機取ったよ！往復で1人77000円です！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 17, user: "イトウ", text: "僕やっとくね！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 16, user: "サトウ", text: "そういえば飛行機の予約誰か頼めるかな", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 15, user: "サトウ", text: "予約取れた！1人88000円です！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 14, user: "イトウ", text: "賛成〜！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 13, user: "タナカ", text: "賛成〜！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 12, user: "サトウ", text: "みんないいならここにしよう！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 11, user: "サトウ", text: "ラクラクホテル良さそうだね！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 10, user: "イトウ", text: "あ！そこ良さそう！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 9, user: "タナカ", text: "ここもいいんじゃないかな？『ラクラクホテル』", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 8, user: "イトウ", text: "こんなところもみつけたよ。『ムズムズホテル』『ホテルワズラワシーサイド』", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 7, user: "サトウ", text: "ありがとう！他にもいくつか候補を出して決めたいね", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 6, user: "タナカ", text: "ここなんてどうですか？ 『ホテルメンドー』", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 5, user: "サトウ", text: "そう！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 4, user: "イトウ", text: "日程は3月13日~3月19日ですよね？", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 3, user: "サトウ", text: "日程は決まっているから泊まるホテルを決めたいね、どこにしたい？", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 2, user: "タナカ", text: "そうしよ〜！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
  {id: 1, user: "サトウ", text: "スペイン旅行の計画の続きを考えよう！", dateTime: new Date(), isLabeled: [false, false, false, false, false, false]},
]
let id = 18

export default (io, socket) => {
  const updateParticipants = () => {
    let participant = Array.from(clients.values()).join(", ")
    io.sockets.emit("updateParticipants", participant);
  }

  socket.on("getId", () => {
    id += 1;
    socket.emit("newId", id);
  })

  // 入室メッセージをクライアントに送信する
  socket.on("enterEvent", (data) => {
    socket.broadcast.emit("enterEvent", data)
    clients.set(socket.id, data)
    updateParticipants()
    //console.log(clients)
  })

  // 退室メッセージをクライアントに送信する
  socket.on("exitEvent", (data) => {
    socket.broadcast.emit("exitEvent", data)
    clients.delete(socket.id)
    updateParticipants()
  })

  // 投稿メッセージを送信する
  socket.on("publishEvent", (data) => {
    messages.unshift(data)
    //console.log(messages)
    io.sockets.emit("publishEvent", data)
  })

  //投稿を削除する
  socket.on("deleteEvent", (data) => {
    var newList = messages.filter((message) => message.id != data.id)
    messages = newList
    io.sockets.emit("deleteMessages", data)
    console.log(messages)
  })

  // ソケット切断時
  socket.on("disconnect", (reason) => {
    clients.delete(socket.id)
    updateParticipants()
    //console.log(reason)
  })

  socket.on("getMessages", (data) => {
    socket.emit("getMessages", messages)
  })

  socket.on("requestGemini", async (data) => {
    const chatHistory = messages.map(message => 
      `${message.user}: ${message.text}`
    ).join('\n');

    const prompt = `以下のチャット履歴を要約して、重要なポイントをまとめてください(新しいチャットが上にあり、古いチャットが下になっています。)：

チャット履歴(何も無い可能性があります。)):

${chatHistory}

(ここまでチャット履歴)
重要な情報、決定事項、注目すべき点を整理して、簡潔にまとめてください。特に、「決まっていること」「やらなければいけないこと」「相談事項」をまとめてください。`;
    console.log("DEBUG(prompt): " + prompt)

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      console.log("Gemini Response:", response.text);
      io.sockets.emit("updateGeminiResponse", response.text)
    } catch (error) {
      console.error("Gemini API Error:", error);
      io.sockets.emit("updateGeminiResponse", error)
    }
  })
}

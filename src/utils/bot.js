import { db } from '../firebase'

// Envoie un message automatique (bot) dans le chat
export function botMsg(channel, text) {
  db.collection('chat').doc(channel).collection('messages').add({
    text,
    userId: 'bot',
    userName: 'Bot Point S',
    userRole: 'bot',
    isBot: true,
    date: new Date().toISOString(),
  })
}

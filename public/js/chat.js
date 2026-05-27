import { getLocalPrivateKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage } from './crypto.js';
import { fetchChatToken } from './api.js';

let ws = null;
let currentSharedSecret = null;
let currentChatId = null;

export async function openChat(currentUser, targetUser) {
  const chatModal = document.getElementById('chatModal');
  const chatMessages = document.getElementById('chatMessages');
  const chatHeader = document.getElementById('chatHeader');
  
  if (!chatModal || !chatMessages || !chatHeader) return;

  // 1. Check if user has generated keys
  const localPrivateKey = await getLocalPrivateKey();
  if (!localPrivateKey) {
    alert("You need to enable DMs first! Go to 'Edit Profile' and click 'Enable Encrypted DMs'.");
    return;
  }

  if (!targetUser.public_key) {
    alert(`${targetUser.username} hasn't enabled Encrypted DMs yet.`);
    return;
  }

  // 2. Fetch Chat Token
  let chatToken;
  try {
    const res = await fetchChatToken();
    chatToken = res.token;
  } catch (err) {
    alert("Failed to authenticate chat session.");
    return;
  }

  // 3. Derive Shared Secret
  try {
    const targetPubKey = await importPublicKey(targetUser.public_key);
    currentSharedSecret = await deriveSharedSecret(localPrivateKey, targetPubKey);
  } catch (err) {
    alert("Cryptographic error establishing secure channel.");
    return;
  }

  // 3. Setup Chat UI
  chatHeader.textContent = `Chat with ${targetUser.username}`;
  chatMessages.innerHTML = '<div style="text-align:center; opacity:0.5; font-size:10px;">Establishing secure connection...</div>';
  chatModal.style.display = 'flex';

  // Record as recent chat
  let recent = JSON.parse(localStorage.getItem('recent_chats') || '[]');
  if (!recent.find(u => u.username === targetUser.username)) {
    recent.unshift({ username: targetUser.username, avatar_url: targetUser.avatar_url, id: targetUser.id, public_key: targetUser.public_key });
    localStorage.setItem('recent_chats', JSON.stringify(recent.slice(0, 20)));
  }

  // 4. Connect WebSocket
  // Use deterministic ID: sort by ID to ensure both users join the same room
  const ids = [currentUser.id, targetUser.id].sort();
  currentChatId = `${ids[0]}_${ids[1]}`;
  
  // Use the same domain the user is currently on, just prefix with chat.
  const host = window.location.hostname;
  const wsUrl = `wss://chat.${host}/${currentChatId}?session=${chatToken}`;

  console.log(`Connecting to chat at: ${wsUrl}`);

  if (ws) {
    console.log("Closing existing WebSocket connection...");
    ws.close();
  }
  
  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    console.error("Failed to create WebSocket instance:", e);
    chatMessages.innerHTML += `<div style="color:red; font-size:10px; text-align:center;">Failed to initialize connection: ${e.message}</div>`;
    return;
  }

  ws.onopen = () => {
    console.log("WebSocket connection established.");
    chatMessages.innerHTML = '<div style="text-align:center; opacity:0.5; font-size:10px; margin-bottom: 8px;">End-to-End Encrypted 🔒</div>';
  };

  ws.onmessage = async (event) => {
    console.log("Received WebSocket message:", event.data);
    const data = JSON.parse(event.data);
    if (data.type === "all") {
      chatMessages.innerHTML = '<div style="text-align:center; opacity:0.5; font-size:10px; margin-bottom: 8px;">End-to-End Encrypted 🔒</div>';
      for (const msg of data.messages) {
        await renderMessage(msg, currentUser);
      }
    } else if (data.type === "add") {
      await renderMessage(data, currentUser);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket Error:", err);
    chatMessages.innerHTML += '<div style="color:red; font-size:10px; text-align:center;">Connection error. Check console for details.</div>';
  };

  ws.onclose = (event) => {
    console.log(`WebSocket closed: Code ${event.code}, Reason: ${event.reason || 'none'}`);
    if (event.code === 1008) {
      chatMessages.innerHTML += '<div style="color:red; font-size:10px; text-align:center;">Authentication failed (1008).</div>';
    }
  };

  const sendBtn = document.getElementById('chatSendBtn');
  const input = document.getElementById('chatInput');

  // Remove old listeners by cloning
  const newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

  newSendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    
    input.value = '';
    
    // Encrypt
    const { ciphertext, iv } = await encryptMessage(text, currentSharedSecret);
    
    const payload = {
      type: "add",
      id: crypto.randomUUID(),
      sender: currentUser.username,
      ciphertext,
      iv,
      timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(payload));
  };
}

export function closeChat() {
  const chatModal = document.getElementById('chatModal');
  if (chatModal) chatModal.style.display = 'none';
  if (ws) {
    ws.close();
    ws = null;
  }
  currentSharedSecret = null;
  currentChatId = null;
}

async function renderMessage(msg, currentUser) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const plaintext = await decryptMessage(msg.ciphertext, msg.iv, currentSharedSecret);
  
  const isMe = msg.sender === currentUser.username;
  
  const div = document.createElement('div');
  div.className = `chat-msg-container ${isMe ? 'chat-msg-me' : 'chat-msg-them'}`;
  
  div.innerHTML = `
    <span class="chat-msg-meta">${msg.sender} • ${new Date(msg.timestamp).toLocaleTimeString()}</span>
    <div class="chat-msg-bubble ${isMe ? 'chat-bubble-me' : 'chat-bubble-them'}">
      ${plaintext}
    </div>
  `;
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

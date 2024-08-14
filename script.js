const chatBox = document.getElementById('chat-box');
const startChatButton = document.getElementById('start-chat');
const chatLog = document.getElementById('chat-log');

startChatButton.addEventListener('click', () => {
    // Start chat session here
});

chatBox.addEventListener('message', (event) => {
    const message = event.data;
    console.log(message);
    chatLog.textContent = message;
});
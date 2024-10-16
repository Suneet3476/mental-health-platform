// Send message function
function sendMessage() {
    let input = document.getElementById("message-input").value;
    let messages = document.getElementById("messages");

    if(input.trim() === "") return;

    // Append the user's message
    let userMessage = document.createElement("p");
    userMessage.textContent = "You: " + input;
    userMessage.style.color = "#333";
    userMessage.style.fontWeight = "bold";
    messages.appendChild(userMessage);

    // Simulate bot response
    let botMessage = document.createElement("p");
    botMessage.textContent = "Bot: I'm here to help! What would you like to talk about?";
    botMessage.style.color = "#007bff";
    messages.appendChild(botMessage);

    document.getElementById('loginForm').addEventListener('submit', (event) => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        event.preventDefault();
        alert('Both fields are required!');
    }
});


    // Clear the input field
    document.getElementById("message-input").value = "";

    // Auto-scroll to the bottom
    messages.scrollTop = messages.scrollHeight;
}

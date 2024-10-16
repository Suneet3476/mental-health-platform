function sendMessage() {
    let input = document.getElementById("message-input").value;
    let messages = document.getElementById("messages");

    if(input.trim() === "") return;

    // Append the user's message
    let userMessage = document.createElement("p");
    userMessage.textContent = "You: " + input;
    messages.appendChild(userMessage);

    // Simulate bot response
    let botMessage = document.createElement("p");
    botMessage.textContent = "Bot: I'm here to help! What would you like to talk about?";
    messages.appendChild(botMessage);

    document.getElementById("message-input").value = ""; // Clear input
}

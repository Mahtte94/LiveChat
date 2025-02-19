document.addEventListener("DOMContentLoaded", function () {
  const chatTrigger = document.getElementById("chat-trigger");
  const chatContainer = document.getElementById("chat-container");
  const realInput = document.getElementById("input");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const messages = document.getElementById("messages");

  const scrollToLatest = () => {
    messages.scrollTop = messages.scrollHeight;
  };

  chatTrigger.addEventListener("click", function () {
    chatTrigger.style.display = "none";
    chatContainer.style.display = "block";
    chatContainer.classList.add("visible");
    realInput.focus();
  });

  document.addEventListener("click", function (event) {
    if (
      !chatContainer.contains(event.target) &&
      event.target !== chatTrigger
    ) {
      chatContainer.classList.remove("visible");
      chatContainer.style.display = "none";
      chatTrigger.style.display = "block";
      scrollToLatest();
      input.focus();
    }
  });

  // Initialize socket with both transport options
  const socket = io(window.location.origin, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true
  });

  // Connection event handlers
  socket.on("connect", () => {
    messages.innerHTML = ""; // Clear messages on reconnect
  });

  // Message handler
  socket.on("chat message", (msg) => {
    const item = document.createElement("li");

    // Store the message ID and log it
    if (msg._id) {
      item.dataset.messageId = msg._id.toString();
    }

    if (typeof msg === "string") {
      item.textContent = msg;
    } else if (msg && msg.content) {
      item.textContent = `${msg.content}`;

      // Style based on sender
      if (msg.sender === socket.id) {
        item.classList.add("own-message");
      } else {
        item.classList.add("other-message");
      }
    }

    messages.appendChild(item);
    window.scrollTo(0, document.body.scrollHeight);
    messages.scrollTop = messages.scrollHeight;
    scrollToLatest();
  });

  socket.on("message deleted", (messageId) => {
    const messages = document.getElementById("messages");
    const messageElements = messages.getElementsByTagName("li");

    for (let element of messageElements) {
      if (element.dataset.messageId === messageId) {
        element.remove();
        break;
      }
    }
  });

  socket.on("messages cleared", () => {
    console.log("All messages cleared");
    const messages = document.getElementById("messages");
    messages.innerHTML = "";
  });

  // Form submission
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value) {
      const clientOffset = `${socket.id}-${Date.now()}`;

      socket.emit("chat message", input.value, clientOffset, (error) => {
        if (error) {
          console.error("Error sending message:", error);
          return;
        }
        console.log("Message sent successfully");
      });

      input.value = "";
    }
  });
});
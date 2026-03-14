window.addEventListener("message", (event) => {
  if (event.origin !== "https://mailtrack-9umwjyu1b-nikolas-projects-34cf3b94.vercel.app" && 
      event.origin !== "http://localhost:3000" &&
    event.origin !== "https://mailtrack-mvp.vercel.app") return;
  
  if (event.data?.type === "SET_TOKEN") {
    chrome.runtime.sendMessage({
      type: "SET_TOKEN",
      token: event.data.token,
      userId: event.data.userId,
      userEmail: event.data.userEmail,
    }, (res) => {
      console.log("[MailTrack bridge] Token relayed:", res);
    });
  }
});

console.log("[MailTrack bridge] Active on dashboard");
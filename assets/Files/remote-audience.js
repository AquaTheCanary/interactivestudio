(function () {
  const params = new URLSearchParams(location.search);
  const code = params.get("room");
  if (!code || !window.studioRooms) return;
  const $ = id => document.getElementById(id);
  let answered = false;
  let stopRoom = null;
  let currentSlide = 0;
  let roomData = null;

  function render() {
    if (!roomData) return;
    const slides = roomData.slides || [];
    currentSlide = Math.max(0, Math.min(Number(roomData.activeSlide) || 0, slides.length - 1));
    const slide = slides[currentSlide];
    if (!slide) return;
    const root = $("slide");
    root.replaceChildren();
    root.style.background = slide.bg || "#fff";
    const kicker = document.createElement("div");
    kicker.className = "kicker";
    kicker.textContent = slide.kicker || "";
    const heading = document.createElement("h1");
    heading.textContent = slide.heading || "";
    heading.style.color = slide.ink || "#202431";
    const copy = document.createElement("p");
    copy.textContent = slide.copy || "";
    root.append(kicker, heading, copy);

    if (slide.decision) {
      const section = document.createElement("section");
      section.className = "decision";
      const question = document.createElement("h2");
      question.textContent = slide.decision.question || "Choose what happens next";
      const choices = document.createElement("div");
      choices.className = "choices";
      (slide.decision.choices || []).forEach(choice => {
        const button = document.createElement("button");
        button.className = "choice";
        button.textContent = choice.label;
        button.disabled = answered;
        button.addEventListener("click", async () => {
          if (answered) return;
          answered = true;
          choices.querySelectorAll("button").forEach(item => item.disabled = true);
          try {
            await studioRooms.castVote(code, choice.label, currentSlide);
            const feedback = document.createElement("div");
            feedback.className = "feedback";
            feedback.textContent = "Your choice has been sent. Thank you!";
            section.append(feedback);
          } catch (error) {
            answered = false;
            choices.querySelectorAll("button").forEach(item => item.disabled = false);
            $("status").textContent = "● Vote failed: " + error.message;
          }
        });
        choices.append(button);
      });
      section.append(question, choices);
      root.append(section);
    }
    $("decktitle").textContent = roomData.title || "Audience display";
    $("count").textContent = "Slide " + (currentSlide + 1) + " / " + slides.length;
    $("status").textContent = "● Live · room " + code.toUpperCase();
  }

  studioRooms.joinRoom(code).then(joined => {
    roomData = joined.room;
    render();
    stopRoom = studioRooms.subscribeRoom(code, room => {
      if (!room) {
        $("status").textContent = "● This presentation has ended";
        return;
      }
      const changedSlide = Number(room.activeSlide) !== currentSlide;
      roomData = room;
      if (changedSlide) answered = false;
      render();
    }, error => {
      $("status").textContent = "● Connection error: " + error.message;
    });
  }).catch(error => {
    $("status").textContent = "● " + error.message;
  });
  window.addEventListener("pagehide", () => stopRoom && stopRoom());
})();
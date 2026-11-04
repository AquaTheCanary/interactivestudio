// Shared Firebase/Firestore room transport for Interactive Studio.
// Loads the Firebase compat SDK on demand and reuses the app/auth setup in auth-config.js.
(function () {
  const SDK_VERSION = "10.14.1";
  let readyPromise;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === src);
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error("Could not load Firebase SDK: " + src));
      document.head.appendChild(script);
    });
  }

  function appPath(path) {
    return window.getAppUrl ? window.getAppUrl(path) : path;
  }

  async function initialise() {
    if (!window.firebase || !firebase.apps.length) {
      await loadScript("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-app-compat.js");
    }
    if (!firebase.auth) {
      await loadScript("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-auth-compat.js");
    }
    if (!firebase.firestore) {
      await loadScript("https://www.gstatic.com/firebasejs/" + SDK_VERSION + "/firebase-firestore-compat.js");
    }
    if (!window.studioAuth) {
      await loadScript(appPath("/assets/Files/auth-config.js"));
    }
    if (!window.studioAuth) throw new Error("Interactive Studio authentication did not initialise.");
    await window.studioAuth.ready;
    let user = firebase.auth().currentUser;
    if (!user) {
      const credential = await firebase.auth().signInAnonymously();
      user = credential.user;
    }
    return { db: firebase.firestore(), user };
  }

  function ready() {
    if (!readyPromise) readyPromise = initialise().catch(error => {
      readyPromise = null;
      throw error;
    });
    return readyPromise;
  }

  function publicDeck(deck) {
    return {
      title: String(deck.title || "Untitled presentation").slice(0, 160),
      slides: (deck.slides || []).map(slide => ({
        heading: String(slide.heading || "").slice(0, 500),
        copy: String(slide.copy || "").slice(0, 3000),
        kicker: String(slide.kicker || "").slice(0, 160),
        bg: /^#[0-9a-f]{6}$/i.test(slide.bg || "") ? slide.bg : "#ffffff",
        ink: /^#[0-9a-f]{6}$/i.test(slide.ink || "") ? slide.ink : "#202431",
        decision: slide.decision ? {
          question: String(slide.decision.question || "").slice(0, 500),
          choices: (slide.decision.choices || []).slice(0, 12).map(choice => ({
            label: String(choice.label || "").slice(0, 120),
            action: choice.action === "message" ? "message" : "slide",
            target: Number.isInteger(Number(choice.target)) ? Number(choice.target) : 0,
            message: String(choice.message || "").slice(0, 1000)
          }))
        } : null
      }))
    };
  }

  function privateNotes(deck) {
    return (deck.slides || []).map((slide, index) => ({
      slideIndex: index,
      notes: String(slide.notes || "").slice(0, 5000)
    }));
  }

  function makeCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte => alphabet[byte % alphabet.length]).join("");
  }

  async function createRoom(deck) {
    const { db, user } = await ready();
    const clean = publicDeck(deck);
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = makeCode();
      const ref = db.collection("rooms").doc(code);
      const existing = await ref.get();
      if (existing.exists) continue;
      await ref.set({
        ownerUid: user.uid,
        title: clean.title,
        slides: clean.slides,
        activeSlide: 0,
        status: "live",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await ref.collection("private").doc("notes").set({
        ownerUid: user.uid,
        slides: privateNotes(deck),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { code, ownerUid: user.uid };
    }
    throw new Error("Could not allocate a unique room code. Please try again.");
  }

  async function updateRoom(code, deck, activeSlide) {
    const { db, user } = await ready();
    const clean = publicDeck(deck);
    const ref = db.collection("rooms").doc(String(code).toUpperCase());
    await ref.update({
      title: clean.title,
      slides: clean.slides,
      activeSlide: Math.max(0, Math.min(clean.slides.length - 1, Number(activeSlide) || 0)),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await ref.collection("private").doc("notes").set({
      ownerUid: user.uid,
      slides: privateNotes(deck),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function joinRoom(code) {
    const { db, user } = await ready();
    const roomCode = String(code || "").trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(roomCode)) throw new Error("Enter a valid 6-character room code.");
    const roomRef = db.collection("rooms").doc(roomCode);
    const snapshot = await roomRef.get();
    if (!snapshot.exists || snapshot.data().status !== "live") throw new Error("That presentation could not be found or is no longer live.");
    const participantRef = roomRef.collection("participants").doc(user.uid);
    const participantSnapshot = await participantRef.get();
    if (participantSnapshot.exists) {
      await participantRef.update({
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      await participantRef.set({
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    return { code: roomCode, uid: user.uid, room: snapshot.data() };
  }

  async function saveActiveSlide(code, activeSlide) {
    const { db } = await ready();
    await db.collection("rooms").doc(String(code).toUpperCase()).update({
      activeSlide: Math.max(0, Number(activeSlide) || 0),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function saveNotes(code, deck) {
    const { db, user } = await ready();
    await db.collection("rooms").doc(String(code).toUpperCase()).collection("private").doc("notes").set({
      ownerUid: user.uid,
      slides: privateNotes(deck),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function castVote(code, choice, slideIndex) {
    const { db, user } = await ready();
    await db.collection("rooms").doc(String(code).toUpperCase()).collection("votes").add({
      uid: user.uid,
      choice: String(choice || "").slice(0, 120),
      slideIndex: Math.max(0, Number(slideIndex) || 0),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function resetVotes(code) {
    const { db } = await ready();
    const votesRef = db.collection("rooms").doc(String(code).toUpperCase()).collection("votes");
    const snapshot = await votesRef.get();
    const docs = snapshot.docs;
    for (let start = 0; start < docs.length; start += 450) {
      const batch = db.batch();
      docs.slice(start, start + 450).forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    return docs.length;
  }

  function subscribeRoom(code, callback, onError) {
    let unsubscribe;
    ready().then(({ db }) => {
      unsubscribe = db.collection("rooms").doc(String(code).toUpperCase()).onSnapshot(
        snapshot => callback(snapshot.exists ? snapshot.data() : null),
        error => onError && onError(error)
      );
    }).catch(error => onError && onError(error));
    return () => unsubscribe && unsubscribe();
  }

  function subscribeVotes(code, callback, onError) {
    let unsubscribe;
    ready().then(({ db }) => {
      unsubscribe = db.collection("rooms").doc(String(code).toUpperCase()).collection("votes")
        .orderBy("createdAt", "asc").onSnapshot(
          snapshot => callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
          error => onError && onError(error)
        );
    }).catch(error => onError && onError(error));
    return () => unsubscribe && unsubscribe();
  }

  async function getNotes(code) {
    const { db, user } = await ready();
    const snapshot = await db.collection("rooms").doc(String(code).toUpperCase()).collection("private").doc("notes").get();
    if (!snapshot.exists || snapshot.data().ownerUid !== user.uid) throw new Error("Presenter notes are only available to the room owner.");
    return snapshot.data().slides || [];
  }

  window.studioRooms = {
    ready, createRoom, updateRoom, joinRoom, saveActiveSlide, saveNotes,
    castVote, resetVotes, subscribeRoom, subscribeVotes, getNotes, publicDeck
  };
})();

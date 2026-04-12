const inputs    = document.querySelectorAll(".otp-input");
const verifyBtn = document.getElementById("verify-btn");
const resendBtn = document.getElementById("resend-btn");
const timerEl   = document.getElementById("timer");

const verificationId = sessionStorage.getItem("verificationId");

let timerInterval;
let unsubscribeSnapshot = null;

// ================= FIREBASE INIT =================
const firebaseConfig = {
  apiKey: "AIzaSyB0mukFbPbekKJi_lREOJ-arWcBT_4mGXQ",
  authDomain: "motorcycle-management-sy-f6090.firebaseapp.com",
  projectId: "motorcycle-management-sy-f6090",
  storageBucket: "motorcycle-management-sy-f6090.appspot.com",
  messagingSenderId: "128142378243",
  appId: "1:128142378243:web:80b4b99f9f85cb11c55536",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db   = firebase.firestore();

// ================= UTILS =================

const isAllFilled = () =>
  Array.from(inputs).every((i) => i.value.trim() !== "");

const getOtp = () =>
  Array.from(inputs).map((i) => i.value.trim()).join("");

const updateVerifyBtn = () => {
  verifyBtn.disabled = !isAllFilled();
};

// ================= COUNTDOWN =================

const startCountdown = () => {
  let timeLeft = 60;
  resendBtn.disabled = true;
  timerEl.textContent = timeLeft;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      resendBtn.disabled = false;
    }
  }, 1000);
};

startCountdown();

// ================= INPUT EVENTS =================

inputs.forEach((input, idx) => {
  input.addEventListener("keypress", (e) => {
    if (!/[0-9]/.test(e.key)) e.preventDefault();
  });

  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 1);
    if (input.value && idx < inputs.length - 1) inputs[idx + 1].focus();
    input.classList.toggle("filled", !!input.value);
    updateVerifyBtn();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && idx > 0) {
      inputs[idx - 1].focus();
      inputs[idx - 1].value = "";
      inputs[idx - 1].classList.remove("filled");
      updateVerifyBtn();
    }
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    inputs.forEach((inp, i) => {
      inp.value = data[i] || "";
      inp.classList.toggle("filled", !!inp.value);
    });
    const lastFilled = Math.min(data.length, inputs.length) - 1;
    if (lastFilled >= 0) inputs[lastFilled].focus();
    updateVerifyBtn();
  });
});

// ================= REALTIME LISTENER =================

function listenVerified(docRef) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  unsubscribeSnapshot = docRef.onSnapshot((snap) => {
    if (!snap.exists) return;
    const data = snap.data();
    console.log("[onSnapshot] verified =", data.verified, "| uid =", data.uid);

    if (data.verified === true) {
      unsubscribeSnapshot();
      inputs.forEach((i) => i.classList.add("otp-success"));
      sessionStorage.clear();
      window.location.href = "../../Sys_Manager/index.html";
    }
  }, (err) => {
    // FIX: Bắt lỗi listener — thường do Firestore Rules chặn read
    console.error("[onSnapshot] Lỗi listener:", err.code, err.message);
  });
}

// ================= VERIFY OTP =================

const verifyOTP = async () => {
  if (!isAllFilled()) return;

  const otpCode = getOtp();
  verifyBtn.disabled    = true;
  verifyBtn.textContent = "Đang xác thực...";

  try {
    // Bước 1: Xác thực OTP với Firebase Auth
    const credential = firebase.auth.PhoneAuthProvider.credential(
      verificationId,
      otpCode
    );
    const result = await auth.signInWithCredential(credential);
    const user   = result.user;
    console.log("[Auth] signInWithCredential thành công, uid:", user.uid);

    // Bước 2: Tìm document Firestore
    let docRef  = null;
    const docId = sessionStorage.getItem("doc_id");
    console.log("[Firestore] doc_id từ sessionStorage:", docId);

    if (docId) {
      docRef = db.collection("users").doc(docId);
    } else {
      // Fallback tìm theo phone_number
      const phone = sessionStorage.getItem("phone_number");
      console.log("[Firestore] Fallback tìm theo phone:", phone);

      const snapshot = await db
        .collection("users")
        .where("phone_number", "==", phone)
        .get();

      if (!snapshot.empty) {
        docRef = snapshot.docs[0].ref;
        console.log("[Firestore] Tìm thấy doc:", snapshot.docs[0].id);
      } else {
        console.error("[Firestore] Không tìm thấy document với phone:", phone);
        alert("Không tìm thấy tài khoản. Vui lòng đăng ký lại.");
        verifyBtn.textContent = "Xác nhận";
        updateVerifyBtn();
        return;
      }
    }

    // Bước 3: Bắt đầu lắng nghe TRƯỚC khi update
    listenVerified(docRef);

    // Bước 4: Dùng set() với merge:true thay vì update()
    // → tránh lỗi khi field uid chưa tồn tại trong document
    await docRef.set({
      uid:       user.uid,
      verified:  true,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log("[Firestore] set() verified:true thành công");

  } catch (err) {
    console.error("[verifyOTP] Lỗi:", err.code, err.message);

    inputs.forEach((i) => {
      i.classList.add("otp-error");
      setTimeout(() => i.classList.remove("otp-error"), 500);
    });

    verifyBtn.textContent = "Xác nhận";
    updateVerifyBtn();

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (err.code === "auth/invalid-verification-code") {
      alert("Mã OTP không đúng. Vui lòng thử lại.");
    } else if (err.code === "auth/code-expired") {
      alert("Mã OTP đã hết hạn. Vui lòng gửi lại.");
    } else {
      alert("Lỗi: " + err.code + " — " + err.message);
    }
  }
};

verifyBtn.addEventListener("click", verifyOTP);

// ================= RESEND OTP =================

resendBtn.addEventListener("click", async () => {
  try {
    const phone = sessionStorage.getItem("phone_number");

    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }

    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
      "recaptcha-container",
      { size: "invisible" }
    );
    await window.recaptchaVerifier.render();

    const confirmation = await auth.signInWithPhoneNumber(
      phone,
      window.recaptchaVerifier
    );

    sessionStorage.setItem("verificationId", confirmation.verificationId);

    inputs.forEach((i) => {
      i.value = "";
      i.classList.remove("filled");
    });
    updateVerifyBtn();
    startCountdown();
    alert("📩 Đã gửi lại OTP!");

  } catch (err) {
    console.error("Lỗi gửi lại OTP:", err);
    alert("❌ Không thể gửi lại OTP: " + err.message);
  }
});
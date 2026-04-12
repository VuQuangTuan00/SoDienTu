// ================= UI TOGGLE =================
const container   = document.getElementById("container");
const registerBtn = document.getElementById("register");
const loginBtn    = document.getElementById("login");

registerBtn?.addEventListener("click", () => container.classList.add("active"));
loginBtn?.addEventListener("click",    () => container.classList.remove("active"));

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

// ================= LOADING HELPERS =================
const authLoading = document.getElementById("auth-loading");

function hideLoading() {
  // Fade out loading overlay
  authLoading.classList.add("hide");
  // Hiện giao diện login sau khi loading biến mất
  setTimeout(() => {
    authLoading.style.display = "none";
    container.classList.add("visible");
  }, 400);
}

// ================= AUTO LOGIN =================
// onAuthStateChanged chạy 1 lần ngay khi load trang
// → nếu đã đăng nhập: redirect thẳng dashboard, không hiện login
// → nếu chưa: ẩn loading, hiện giao diện login
auth.onAuthStateChanged((user) => {
  if (user) {
    // Đã đăng nhập → redirect, giữ loading để không bị nháy UI
    console.log("[Auth] Đã đăng nhập:", user.phoneNumber);
    window.location.href = "../Sys_Manager/index.html";
  } else {
    // Chưa đăng nhập → ẩn loading, hiện form
    hideLoading();
    initRecaptcha();
  }
});

// ================= RECAPTCHA =================
let recaptchaReady = false;

async function initRecaptcha() {
  if (recaptchaReady && window.recaptchaVerifier) return;

  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear(); } catch (_) {}
    window.recaptchaVerifier = null;
  }

  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
    "recaptcha-container",
    {
      size: "invisible",
      callback: () => {
        console.log("[reCAPTCHA] Solved");
      },
      "expired-callback": () => {
        console.warn("[reCAPTCHA] Token hết hạn, reset");
        recaptchaReady = false;
        if (window.recaptchaVerifier) {
          try { window.recaptchaVerifier.clear(); } catch (_) {}
          window.recaptchaVerifier = null;
        }
      },
    }
  );

  await window.recaptchaVerifier.render();
  recaptchaReady = true;
  console.log("[reCAPTCHA] Sẵn sàng");
}

// ================= UTILS =================
const phoneRegex = /^(0|\+84)[0-9]{9}$/;

const formatPhoneE164 = (phone) =>
  phone.startsWith("0") ? "+84" + phone.slice(1) : phone;

// ================= ĐĂNG KÝ =================
const registerForm = document.getElementById("registerForm");

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("registerUsername").value.trim();
  const phone    = document.getElementById("registerPhone").value.trim();

  if (!username) { alert("Vui lòng nhập tên tài khoản"); return; }
  if (!phoneRegex.test(phone)) { alert("Số điện thoại không hợp lệ"); return; }

  try {
    const existing = await db
      .collection("users")
      .where("phone_number", "==", phone)
      .get();

    if (!existing.empty) {
      alert("Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.");
      container.classList.remove("active");
      return;
    }

    await db.collection("users").add({
      user_name:    username,
      phone_number: phone,
      verified:     false,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });

    alert("Đăng ký thành công! Vui lòng đăng nhập để xác thực.");

    const loginPhoneInput = document.getElementById("loginPhone");
    if (loginPhoneInput) loginPhoneInput.value = phone;
    container.classList.remove("active");

  } catch (err) {
    console.error("Lỗi đăng ký:", err);
    alert("Đăng ký thất bại: " + err.message);
  }
});

// ================= ĐĂNG NHẬP =================
const loginForm = document.getElementById("loginForm");

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = document.getElementById("loginPhone").value.trim();
  if (!phoneRegex.test(phone)) { alert("Số điện thoại không hợp lệ"); return; }

  try {
    const snapshot = await db
      .collection("users")
      .where("phone_number", "==", phone)
      .get();

    if (snapshot.empty) {
      alert("Số điện thoại chưa được đăng ký. Vui lòng tạo tài khoản trước.");
      container.classList.add("active");
      return;
    }

    const userData = snapshot.docs[0].data();
    sessionStorage.setItem("auth_type",    "login");
    sessionStorage.setItem("phone_number", phone);
    sessionStorage.setItem("user_name",    userData.user_name);
    sessionStorage.setItem("doc_id",       snapshot.docs[0].id);

    await sendOTP(phone);

  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    alert("Đăng nhập thất bại: " + err.message);
  }
});

// ================= GỬI OTP =================
async function sendOTP(phone) {
  const phoneE164 = formatPhoneE164(phone);

  try {
    if (!recaptchaReady || !window.recaptchaVerifier) {
      await initRecaptcha();
    }

    const confirmationResult = await auth.signInWithPhoneNumber(
      phoneE164,
      window.recaptchaVerifier
    );

    sessionStorage.setItem("verificationId", confirmationResult.verificationId);
    window.location.href = "../OTP/OTP_UI/index.html";

  } catch (err) {
    console.error("Lỗi gửi OTP:", err.code, err.message);

    recaptchaReady = false;
    if (window.recaptchaVerifier) {
      try { window.recaptchaVerifier.clear(); } catch (_) {}
      window.recaptchaVerifier = null;
    }

    switch (err.code) {
      case "auth/invalid-phone-number":
        alert("Số điện thoại không đúng định dạng");
        break;
      case "auth/too-many-requests":
        alert("Quá nhiều yêu cầu. Vui lòng thử lại sau vài phút");
        break;
      case "auth/unauthorized-domain":
        alert("Domain chưa được cấp phép trong Firebase Console");
        break;
      default:
        alert("Không gửi được OTP: " + err.code + " — " + err.message);
    }
  }
}
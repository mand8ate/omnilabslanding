const languageButton = document.getElementById("language-button");
const languageButtonMobile = document.getElementById("language-button-mobile");

const changeLanguage = (button) => {
  button.addEventListener("click", () => {
    if (button.innerHTML === "En/Ja") {
      window.location.href = "index-ja.html";
    } else {
      window.location.href = "index.html";
    }
  });
};

changeLanguage(languageButton);
changeLanguage(languageButtonMobile);

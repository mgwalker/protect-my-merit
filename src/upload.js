import loadSF50 from "./sf50";

export default () => {
  return new Promise((resolve) => {
    const inputContainer = document.getElementById("upload-section");
    const input = document.getElementById("sf50-input");
    const dropArea = document.getElementById("sf50-drop");
    const passwordContainer = document.getElementById("needs-password");

    let sf50 = null;

    const setupPassword = () => {
      if (sf50 && sf50.needsPassword) {
        passwordContainer.style.display = "";
      } else {
        passwordContainer.style.display = "none";
      }
    };

    passwordContainer
      .querySelector("button")
      .addEventListener("click", async () => {
        const password = passwordContainer.querySelector("input").value;
        if (sf50) {
          await sf50.setPassword(password);
          setupPassword();
        }
      });

    const dataReady = (data) => {
      inputContainer.style.display = "none";
      passwordContainer.style.display = "none";
      resolve(data);
    };

    const handleFile = async (file) => {
      dropArea.innerText = `Got ${file.name}`;

      sf50 = await loadSF50(file);
      setupPassword();
      sf50.onReady(dataReady);
    };

    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (file) {
        handleFile(file);
      }
    });

    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      const item = e.dataTransfer?.items?.[0];
      if (item && item.kind === "file") {
        handleFile(item.getAsFile());
      }
    });

    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
  });
};

import loadSF50 from "./sf50";

export default () => {
  return new Promise((resolve) => {
    // Get references to the various DOM nodes we interact with.
    const inputContainer = document.getElementById("upload-section");
    const input = document.getElementById("sf50-input");
    const dropArea = document.getElementById("sf50-drop");
    const passwordContainer = document.getElementById("needs-password");

    let sf50 = null;

    const updatePasswordUI = () => {
      if (sf50 && sf50.needsPassword) {
        passwordContainer.style.display = "";
      } else {
        passwordContainer.style.display = "none";
      }
    };

    // When the password button is clicked, try to open the SF-50 again. Then
    // reset the UI accordingly.
    passwordContainer
      .querySelector("button")
      .addEventListener("click", async () => {
        const password = passwordContainer.querySelector("input").value;
        if (sf50) {
          await sf50.setPassword(password);
          // TODO: Probably ought to flag if the provided pasword was incorrect
          // instead of the UI just not changing at all.
          updatePasswordUI();
        }
      });

    // When we get SF-50 data, hide the input/upload and password UI. We don't
    // need those anymore. Then resolve, so the main script can proceed.
    const dataReady = (data) => {
      inputContainer.style.display = "none";
      passwordContainer.style.display = "none";
      resolve(data);
    };

    // Given a file, update the drop area and attempt the load the SF-50. Also
    // register our data ready handler so we'll know when the SF-50 is ready.
    const handleFile = async (file) => {
      dropArea.innerText = `Got ${file.name}`;

      // Keep a reference to the SF50 object. This has metadata about whether
      // it needs a password, a function for supplying the password, and a
      // callback for when the data is successfully loaded.
      sf50 = await loadSF50(file);
      updatePasswordUI();
      sf50.onReady(dataReady);
    };

    // When the file input changes, handle the file.
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (file) {
        handleFile(file);
      }
    });

    // Same when a file is dropped on our drop area.
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      const item = e.dataTransfer?.items?.[0];
      if (item && item.kind === "file") {
        handleFile(item.getAsFile());
      }
    });

    // Ignore the default browser behavior for dragover.
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
  });
};

import { loadMSPB185 } from "./mspb185";
import handleUpload from "./upload";
import { sf50FieldNames } from "./fieldMapping";
import * as PDFJS from "pdfjs-dist";

const main = async () => {
  PDFJS.GlobalWorkerOptions.workerSrc = "pdf.worker.mjs";

  const dataContainer = document.getElementById("sf50-data");
  let mspbFormDataURL = null;

  // Hook up the upload handlers. This resolves when an SF-50 is uploaded and
  // has been parsed into data fields. Use a .then() instead of await so we
  // don't block anything.
  handleUpload().then(async (data) => {
    // Show the data container.
    dataContainer.style.display = "";

    // If we already have an MSPB data URL, revoke it to prevent memory leaks.
    if (mspbFormDataURL) {
      URL.revokeObjectURL(mspbFormDataURL);
    }
    // ...and then get a new one with the new data.
    mspbFormDataURL = await loadMSPB185(data);
    dataContainer.querySelector("a").href = mspbFormDataURL;

    // Display the information that we pulled from the SF-50 so the user can
    // review it without necessarily having to open/save the PDF. It's just a
    // nicety.
    const container = dataContainer.querySelector(".row .grid .row");
    for (const [key, value] of data) {
      if (sf50FieldNames.has(key)) {
        const name = sf50FieldNames.get(key);
        const col = document.createElement("div");
        col.className = "col-3 margin-top-1 padding-0.5";
        col.innerHTML = `<strong>${name}:</strong><br>${value}`;
        container.appendChild(col);
      }
    }
  });
};

document.addEventListener("DOMContentLoaded", main);

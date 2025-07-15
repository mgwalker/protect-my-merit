import { loadMSPB185 } from "./mspb185";
import handleUpload from "./upload";
import { sf50FieldNames } from "./fieldMapping";

const main = async () => {
  const dataContainer = document.getElementById("sf50-data");
  let mspbFormDataURL = null;

  handleUpload().then(async (data) => {
    dataContainer.style.display = "";

    if (mspbFormDataURL) {
      URL.revokeObjectURL(mspbFormDataURL);
    }
    mspbFormDataURL = await loadMSPB185(data);

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

    dataContainer.querySelector("a").href = mspbFormDataURL;
  });
};

document.addEventListener("DOMContentLoaded", main);

import { loadMSPB185 } from "./mspb185";
import { getSF50data } from "./sf50";

const main = async () => {
  const pdfArrayBuffer = await fetch("data/packet.pdf").then((r) =>
    r.arrayBuffer(),
  );
  const sf50 = await getSF50data(pdfArrayBuffer);

  await loadMSPB185(sf50);
};

document.addEventListener("DOMContentLoaded", main);

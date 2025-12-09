import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import * as PDFJS from "pdfjs-dist/legacy/build/pdf.mjs";
import { getSF50data } from "./src/sf50.js";
import { loadMSPB185 } from "./src/mspb185.js";
import mspbToSF50Mapping from "./src/fieldMapping.js";

dotenv.config();

const { SOURCE_DIRECTORY } = process.env;
const OUTPUT_DIRECTORY = path.join(SOURCE_DIRECTORY, "mspb");

const ucwords = (str) =>
  str.toLowerCase().replace(/\b[a-z]/, (letter) => letter.toUpperCase());

const openPDF = async (file) =>
  new Promise(async (resolve) => {
    const data = await fs.readFile(file);

    PDFJS.getDocument({
      data: new Uint8Array(data),
    })
      .promise.then((pdf) => resolve(pdf))
      .catch((e) => {
        if (e.name === "PasswordException")
          PDFJS.getDocument({
            data: new Uint8Array(data),
            password: "GSA_Separation",
          })
            .promise.then((pdf) => {
              resolve(pdf);
            })
            .catch((e) => {
              console.log(`===== ERROR ON ${file}`);
              console.log(e.message);
              console.log("============================");
              resolve(null);
            });
      });
  });

const main = async () => {
  const sf50s = await fs
    .readdir(SOURCE_DIRECTORY)
    .then((files) =>
      files
        .filter((file) => file.endsWith(".pdf"))
        .map((file) => path.join(SOURCE_DIRECTORY, file)),
    );

  const mspbData = new Uint8Array(
    await fs.readFile("./data/MSPB-185-09-23.pdf"),
  ).buffer;

  mspbToSF50Mapping.set("Address", "Address");
  mspbToSF50Mapping.set("City", "City");
  mspbToSF50Mapping.set("State", "State");
  mspbToSF50Mapping.set("Zip Code", "Zip Code");
  mspbToSF50Mapping.set("Agency Name", "Agency Name");
  mspbToSF50Mapping.set("Agency Address", "Agency Address");
  mspbToSF50Mapping.set("Agency City", "Agency City");
  mspbToSF50Mapping.set("Agency State", "Agency State");
  mspbToSF50Mapping.set("Agency Zip", "Agency Zip");

  const errors = [];
  const lines = [];

  lines.push(["filename", ...mspbToSF50Mapping.keys()]);

  for await (const sf50 of sf50s) {
    const line = [path.basename(sf50)];
    lines.push(line);

    const pdf = await openPDF(sf50);
    if (!pdf) {
      errors.push(sf50);
      continue;
    }
    try {
      const data = await getSF50data(pdf);
      if (data.size === 0) {
        errors.push(sf50);
        continue;
      }

      for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();

        // For some reason, the FEHB enrollment form's text content starts
        // with the payroll office number, so if we see that, then we can
        // probably grab this person's address from it.
        if (text?.items?.[0]?.str !== "47000016") {
          continue;
        }

        const fields = await page.getAnnotations();

        for (const { fieldName, fieldValue } of fields) {
          switch (fieldName) {
            case "4 Home address including ZIP Code":
              const [, street, city, state, zip] =
                fieldValue
                  .replace(/\r/g, "~")
                  .replace(/\~\~/g, "~")
                  .match(/(.+?)\~(.+?), (\S+)  (\d{4})/) ?? [];

              data.set("Address", street.trim());
              data.set("City", city.trim());
              data.set("State", state.trim());
              data.set("Zip Code", zip.trim());

              break;

            default:
              break;
          }
        }
        break;
      }

      data.set("Agency Name", "GENERAL SERVICES ADMINISTRATION");
      data.set("Agency Address", "1800 F ST NW");
      data.set("Agency City", "WASHINGTON");
      data.set("Agency State", "DC");
      data.set("Agency Zip", "20405");

      const outName = `${ucwords(data.get("first name"))} ${ucwords(data.get("last name"))} - MSPB 185.pdf`;
      console.log(outName);

      for (const [, key] of mspbToSF50Mapping) {
        line.push(data.get(key));
      }

      try {
        const blob = await loadMSPB185(data, { data: mspbData });
        await fs.writeFile(path.join(OUTPUT_DIRECTORY, outName), blob);
      } catch (e) {
        console.log(e);
      }
    } catch (e) {
      errors.push(sf50);
    }
  }

  const csv = lines
    .map((line) => line.map((entry) => `"${entry}"`).join(","))
    .join("\n");
  await fs.writeFile(path.join(OUTPUT_DIRECTORY, "sf50-data.csv"), csv);

  console.log(errors);
};

main();

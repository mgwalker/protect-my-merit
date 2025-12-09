import * as pdfjs from "pdfjs-dist";
import mapping from "./fieldMapping.js";

export const loadMSPB185 = async (sf50, { data }) => {
  const formArrayBuffer = data
    ? data.slice(0, data.byteLength)
    : await fetch("data/MSPB-185-09-23.pdf").then((r) => r.arrayBuffer());
  const doc = await pdfjs.getDocument(formArrayBuffer).promise;

  // We can modify this annotationStorage object in order to persist changes.
  const annotations = doc.annotationStorage;

  // We'll work one page at a time, because that's how we access annotations.
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const formFields = await page.getAnnotations();

    for (const field of formFields) {
      if (!field.fieldName) {
        continue;
      }

      // If we have a mapping for this MSPB field into the SF-50 data, then
      // we can update the annotationStorage object accordingly.
      if (mapping.has(field.fieldName)) {
        // The key of the annotation is the field ID. The value is whatever
        // we got from the SF-50.
        annotations.setValue(field.id, {
          value: sf50.get(mapping.get(field.fieldName)),
        });
      }
    }
  }

  // Save the modified document to bytes.
  const saved = await doc.saveDocument();

  if (data) {
    return saved;
  }

  // Create a browser-local URL from the bytes.
  return URL.createObjectURL(new Blob([saved]));
};

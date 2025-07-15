import { getResolvedPDFJS } from "unpdf";
import mapping from "./fieldMapping.js";

export const loadMSPB185 = async (sf50) => {
  const formArrayBuffer = await fetch("data/MSPB-185-09-23.pdf").then((r) =>
    r.arrayBuffer(),
  );
  const pdfjs = await getResolvedPDFJS();
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
  const saved = new Blob([await doc.saveDocument()]);

  // Create a browser-local URL from the bytes.
  const url = URL.createObjectURL(saved);

  // Create a link, set its href, set its download attribute to trigger the
  // browser to save it, add it to the document, and click it.
  const a = document.createElement("a");
  a.href = url;
  a.download = "mspb-18f.pdf";
  document.body.appendChild(a);
  a.click();

  // Wait a tick, then revoke the URL. Otherwise you've got a memory leak.
  // While we're at it, remove the link, too.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 10);
};

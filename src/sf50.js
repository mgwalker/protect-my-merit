import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

dayjs.extend(duration);

export const getSF50data = async (doc) => {
  const sf50data = new Map();

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const text = await page.getTextContent();

    // We're currently only looking for the SF-50, which can be identified
    // consistently by the second text item. If this isn't the SF-50, skip it.
    if (text?.items?.[2]?.str !== "Standard Form 50") {
      continue;
    }

    // Default to GSA. For some reason, SF-50s don't always have the agency
    // name, even though there's a spot for it. :shrug:
    sf50data.set(
      "positionorganization_14_1",
      "General Services Administration",
    );

    // See if the SF-50 has field annotations. If it does, we can pull all of
    // the fields and just pass it right along. Easy peasy. SF-50s from eOPF
    // are formatted with field annotations, so those are kind of ideal.
    const formFields = await page.getAnnotations();
    if (formFields.length) {
      formFields.forEach(({ fieldName, fieldValue }) => {
        sf50data.set(fieldName, fieldValue);
      });
    }
    // If there aren't any field annotations, then we'll have to look at the
    // text contents instead.
    else {
      const lines = text.items.map(({ str }) => str);

      // This is all suuuuuper risky. Assuming all of the SF-50s were produced
      // in the same way, this *should* work. But alas, we can't really
      // guarantee that. For example, if someone re-saved their separation
      // packet, that could completely change the text content. So... this is
      // pretty fragile, but hopefully it'll work for our immediate needs.

      sf50data.set("name_01_1", lines[214]);
      sf50data.set("effectivedate_04_1", lines[217]);
      sf50data.set("natureofaction_05B_1", lines[219]);

      // GSA does not identify itself in our SF-50s for some reason. It only
      // identifies FAS and org parts below that, not GSA itself.
      sf50data.set(
        "positionorganization_14_1",
        "General Services Administration",
      );
      sf50data.set("positionorganization_14A_1", lines[234]);

      // Appointment type checkbox
      sf50data.set("positionoccupied_34_1", lines[254]);

      // Position code, grade level, job title, and duty station.
      sf50data.set("occcode_09_1", lines[225]);
      sf50data.set("gradeorlevel_10_1", lines[226]);
      sf50data.set("titleandnumber_07_1", lines[222]);
      sf50data.set("dutystation_39_1", lines[259]);

      // Veterans preference code
      sf50data.set("veteranspreference_23_1", lines[240]);

      // Service computation date
      sf50data.set("servicecompdate_31_1", lines[251]);
    }

    // If we didn't continue earlier, then this is the SF-50 page, so stop.
    // SF-50s are a single page, so we should be good to go. I think an SF-50
    // can contain addendums, but they're for free-form text which probably
    // isn't useful to us.
    break;
  }

  // The SF-50 has the employee's "full name" as a single string, but the MSPB
  // form wants first, middle initial, and last names. Which is very, very
  // rude.
  if (sf50data.has("name_01_1")) {
    // TODO: This is too simple. We need to handle the case where there's no
    // middle initial, at least. There may be other cases too, since names do
    // not, in fact, adhere to any rules, despite what the government wants us
    // to believe with its forms.
    const [last, first, middle] = sf50data
      .get("name_01_1")
      .split(" ")
      .map((e) => e.replace(/,/g, ""));

    sf50data.set("last name", last);
    sf50data.set("first name", first);
    sf50data.set("middle initial", middle.slice(0, 1));
  }

  // The MSPB form identifies a few different actions that can be appealed. If
  // we know we have one of those, we can pre-select it. The only one I know how
  // to identify from the SF-50 is RIF.
  if (sf50data.has("natureofaction_05B_1")) {
    const action = sf50data.get("natureofaction_05B_1");
    if (action === "SEPARATION-RIF") {
      sf50data.set("action: RIF", true);
    }
  }

  // The SF-50 lists veterans preference by a numeric code, but the MSPB form
  // has a checkbox for simply yes or no. If the code is 1, there is no
  // veterans preference; otherwise, there is. Since there are two checkboxes,
  // we need two values.
  if (sf50data.has("veteranspreference_23_1")) {
    const code = +sf50data.get("veteranspreference_23_1");
    sf50data.set("veterans preference yes", code > 1);
    sf50data.set("veterans preference no", code === 1);
  }

  // Similar siutation with the appointment type. It's a code in the SF-50 and
  // a checkbox in the MSPB form, so we convert. The MSPB form also contains a
  // checkbox for USPS employees, but that's not an option on the SF-50, so I
  // dunno what to do with that one. I guess postal employees should proofread.
  if (sf50data.has("positionoccupied_34_1")) {
    const code = +sf50data.get("positionoccupied_34_1");
    sf50data.set("position: competitive", code === 1);
    sf50data.set("position: excepted", code === 2);
    sf50data.set("position: ses", code === 3 || code === 4);
  }

  // If we have a service computation date and an SF-50 effective date, we can
  // compute the number of years and months of service. The MSPB form wants it
  // broken down that way.
  if (
    sf50data.has("servicecompdate_31_1") &&
    sf50data.has("effectivedate_04_1")
  ) {
    const scd = dayjs(sf50data.get("servicecompdate_31_1"));
    const effective = dayjs(sf50data.get("effectivedate_04_1"));

    const duration = dayjs.duration(effective.diff(scd));
    let years = duration.years();
    let months = duration.months();
    const days = duration.days();

    // We need to figure out the right rules here. For now, we're incrementing
    // the months if your service time was more than 15 days into the month.
    if (days > 15) {
      months += 1;
      if (months > 11) {
        years += 1;
        months = 0;
      }
    }

    sf50data.set("service years", `${years}`);
    sf50data.set("service months", `${months}`);
  }

  // If the document has metadata, we can use that to determine the EARLIEST
  // date the SF-50 was sent. It could have been sent later, but not earlier.
  const metadata = await doc.getMetadata().then((m) => m.metadata);
  if (metadata) {
    let date = false;
    if (metadata.get("xmp:modifydate")) {
      date = metadata.get("xmp:modifydate");
      sf50data.set("delivered", metadata.get("xmp:modifydate").split("T")[0]);
    } else {
      date = metadata.get("xmp:createdate");
    }

    if (date) {
      const [, year, month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})T/);
      sf50data.set("delivered", `${month}/${day}/${year}`);
    }
  }

  return sf50data;
};

// Given a browser File object, attempt to load it as a PDF and then parse it
// as an SF-50 document.
export default async (file) => {
  // Read the file into an array buffer. The browser API for this is event-based
  // so we wrap it in a promise to make it a little nicer to deal with.
  const readFile = () =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", (e) => {
        resolve(e.target.result);
      });
      reader.readAsArrayBuffer(file);
    });

  const data = await readFile();

  // By default, assume the PDF does not need a password. We'll see.
  let needsPassword = false;

  // Helper function. Attempts to read the file provided above as a PDf and
  // parse it into SF-50 data. Sets the needsPassword function as appropriate.
  const loadPDF = async (data, password) => {
    // Make a copy of the data to be loaded as a PDF. This is not ideal, but
    // we may need to try loading this PDF again and we don't want it to already
    // be detached.
    const options = { data: data.slice(0, data.byteLength) };

    // If we have a password, set that too.
    if (password) {
      options.password = password;
    }

    // Attempt to load the PDF.
    return pdfjs
      .getDocument(options)
      .promise.then((pdf) => {
        // If we succeed, clear the needsPassword flag and then attempt to
        // parse the PDF into SF-50 data. Return the parsed data.
        needsPassword = false;
        return getSF50data(pdf);
      })
      .catch((e) => {
        // If there is a password exception, set the needsPassword flag so the
        // UI can be updated accordingly.
        if (e.name === "PasswordException") {
          needsPassword = true;
        } else {
          // For other exceptions, preserve them so they show up in the console
          // and we can debug them as we encounter them.
          throw e;
        }
      });
  };

  // Ready handler, subscribed from whoever calls us. (In this case, that
  // happens in the upload.js script.)
  let readyHandler = null;

  // Try to get SF-50 data. If we succeed and there's a ready handler, call it.
  let sf50data = await loadPDF(data);
  if (sf50data?.size > 0 && readyHandler) {
    readyHandler(sf50data);
  }

  // If we previously tried to load the PDF and failed because we needed a
  // password, we can try again with the password.
  const setPassword = async (password) => {
    sf50data = await loadPDF(data, password);
    if (sf50data?.size > 0 && readyHandler) {
      readyHandler(sf50data);
    }
  };

  return {
    // Getter for the needsPassword flag, so it'll always reference our internal
    // variable instead of creating a copy.
    get needsPassword() {
      return needsPassword;
    },

    // Expose the setPassword helper.
    setPassword,

    // Subscribe to ready callback.
    onReady(handler) {
      // If there was not already a ready callback AND we already have SF-50
      // data, immediately call the new handler. This way if someone attaches
      // the callback after initializing this object, they can still get the
      // callback as expected.
      if (readyHandler === null && handler !== null && sf50data?.size > 0) {
        handler(sf50data);
      }

      readyHandler = handler;
    },
  };
};

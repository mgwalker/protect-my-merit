import dayjs from "dayjs";
import duration from "dayjs/plugin/duration.js";
import { getResolvedPDFJS } from "unpdf";

dayjs.extend(duration);

export const getSF50data = async (pdfArrayBuffer) => {
  const pdfjs = await getResolvedPDFJS();

  // Load the PDF from bytes. If there's a password, like for the separation
  // packet, use it.
  const doc = await pdfjs.getDocument({
    password: "*** put password here ***",
    data: pdfArrayBuffer.slice(0, pdfArrayBuffer.byteLength),
  }).promise;

  const sf50data = new Map();

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const text = await page.getTextContent();

    // We're currently only looking for the SF-50, which can be identified
    // consistently by the second text item. If this isn't the SF-50, skip it.
    if (text?.items?.[2].str !== "Standard Form 50") {
      continue;
    }

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
      sf50data.set("positionorganization_14_1", "");
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
    if (metadata.get("xmp:modifydate")) {
      sf50data.set("delivered", metadata.get("xmp:modifydate").split("T")[0]);
    } else {
      sf50data.set("delivered", metadata.get("xmp:createdate").split("T")[0]);
    }
  }

  return sf50data;
};

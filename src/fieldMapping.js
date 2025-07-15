const mapping = new Map();

// The keys are the field names in the MSPB form. The values are the field
// names from the parsed SF-50 data.

mapping.set("Last Name", "last name");
mapping.set("First", "first name");
mapping.set("M Initial", "middle initial");
mapping.set("Agency Name", "positionorganization_14_1");
mapping.set("Bureau1", "positionorganization_14A_1");
mapping.set("Competitive", "position: competitive");
mapping.set("Excepted", "position: excepted");
mapping.set("SES", "position: ses");
mapping.set("Occupational Series", "occcode_09_1");
mapping.set("Grade or Pay Band", "gradeorlevel_10_1");
mapping.set("Position Title", "titleandnumber_07_1");
mapping.set("Duty Station", "dutystation_39_1");
mapping.set("Yes Vet", "veterans preference yes");
mapping.set("No Vet", "veterans preference no");
mapping.set("Decision Letter Effective Date_af_date", "effectivedate_04_1");
mapping.set("Decision Letter Date", "delivered");
mapping.set("Years", "service years");
mapping.set("Months", "service months");
mapping.set(
  "Separation demotion or furlough for more than 30 days by",
  "action: RIF",
);

export default mapping;

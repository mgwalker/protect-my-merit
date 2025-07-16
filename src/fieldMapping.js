// The keys are the field names in the MSPB form. The values are the field
// names from the parsed SF-50 data.
const mspbToSF50Mapping = new Map();
mspbToSF50Mapping.set("Last Name", "last name");
mspbToSF50Mapping.set("First", "first name");
mspbToSF50Mapping.set("M Initial", "middle initial");
mspbToSF50Mapping.set("Agency Name", "positionorganization_14_1");
mspbToSF50Mapping.set("Bureau1", "positionorganization_14A_1");
mspbToSF50Mapping.set("Competitive", "position: competitive");
mspbToSF50Mapping.set("Excepted", "position: excepted");
mspbToSF50Mapping.set("SES", "position: ses");
mspbToSF50Mapping.set("Occupational Series", "occcode_09_1");
mspbToSF50Mapping.set("Grade or Pay Band", "gradeorlevel_10_1");
mspbToSF50Mapping.set("Position Title", "titleandnumber_07_1");
mspbToSF50Mapping.set("Duty Station", "dutystation_39_1");
mspbToSF50Mapping.set("Yes Vet", "veterans preference yes");
mspbToSF50Mapping.set("No Vet", "veterans preference no");
mspbToSF50Mapping.set(
  "Decision Letter Effective Date_af_date",
  "effectivedate_04_1",
);
mspbToSF50Mapping.set("Decision Letter Date", "delivered");
mspbToSF50Mapping.set("Years", "service years");
mspbToSF50Mapping.set("Months", "service months");
mspbToSF50Mapping.set(
  "Separation demotion or furlough for more than 30 days by",
  "action: RIF",
);

export default mspbToSF50Mapping;

// Map of SF-50 field names to human-meaningful names.
export const sf50FieldNames = new Map();
sf50FieldNames.set("last name", "Last name");
sf50FieldNames.set("first name", "First name");
sf50FieldNames.set("middle initial", "Middle initial");
sf50FieldNames.set("positionorganization_14_1", "Agency name");
sf50FieldNames.set("positionorganization_14A_1", "Bureau");
sf50FieldNames.set("position: competitive", "Competitive apointment");
sf50FieldNames.set("position: excepted", "Excepted appointment");
sf50FieldNames.set("position: ses", "SES appointment");
sf50FieldNames.set("occcode_09_1", "Job series");
sf50FieldNames.set("gradeorlevel_10_1", "GS grade");
sf50FieldNames.set("titleandnumber_07_1", "Job title");
sf50FieldNames.set("dutystation_39_1", "Duty station");
sf50FieldNames.set("veterans preference yes", "Veterans preference, yes");
sf50FieldNames.set("veterans preference no", "Veterans preference, no");
sf50FieldNames.set("effectivedate_04_1", "Action effective date");
sf50FieldNames.set("delivered", "Letter date");
sf50FieldNames.set("service years", "Years of service");
sf50FieldNames.set("service months", "Months of service");
sf50FieldNames.set("servicecompdate_31_1", "Service computation date");
sf50FieldNames.set("action: RIF", "RIFed");

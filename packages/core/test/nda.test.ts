import { describe } from "vitest";
import { fixtureSuite } from "./fixture-suite.js";
import { clientNda } from "./fixtures/nda.js";

describe("fixture: client NDA", () => {
  fixtureSuite({
    text: clientNda,
    placeholders: {
      "Ikenga Fintech Ltd": "CLIENT_1",
      "Delta Creek Analytics Limited": "ORG_1",
      "Dr. Halima Abubakar": "PERSON_1",
      "Halima Abubakar": "PERSON_1",
      "Mr. Tamunosiki Briggs": "PERSON_2",
      "Mr. Briggs": "PERSON_2",
      "Ms. Ebiere Alagoa": "PERSON_3",
      "USD 250,000": "AMOUNT_USD_1",
      "₦50,000,000": "AMOUNT_NGN_LARGE_1",
      "legal@ikengafintech.com.ng": "EMAIL_1",
      "+2348051234567": "PHONE_1",
      "07061234567": "PHONE_2",
    },
    secrets: ["Ikenga", "Delta Creek", "Abubakar", "Briggs", "Alagoa", "250,000"],
  });
});

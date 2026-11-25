import { describe } from "vitest";
import { fixtureSuite } from "./fixture-suite.js";
import { tenancyLetter } from "./fixtures/tenancy.js";

describe("fixture: tenancy letter", () => {
  fixtureSuite({
    text: tenancyLetter,
    placeholders: {
      "Mrs. Ngozi Okafor": "TENANT_1",
      "Mrs. Okafor": "TENANT_1",
      "Chief Emeka Eze": "LANDLORD_1",
      "Chief Eze": "LANDLORD_1",
      "Barr. Aisha Bello": "PERSON_1",
      "Eze Properties Limited": "ORG_1",
      "Access Bank": "ORG_2",
      "Okonkwo & Co": "ORG_3",
      "₦2,400,000": "AMOUNT_NGN_MID_1",
      "₦1.2m": "AMOUNT_NGN_MID_2",
      "₦60,000": "AMOUNT_NGN_SMALL_1",
      "2034567891": "ACCOUNT_1",
      "0809 876 5432": "PHONE_1",
      "tenancy@ezeproperties.ng": "EMAIL_1",
      "Flat 3, Plot 5, Admiralty Way": "ADDRESS_1",
      Lekki: "CITY_NG_1",
    },
    secrets: ["Okafor", "Emeka", "Eze", "Aisha", "Okonkwo", "5432", "Admiralty", "Lekki"],
  });
});

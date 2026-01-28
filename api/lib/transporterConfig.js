import dotenv from "dotenv";
dotenv.config();

const { EMAIL_USER, EMAIL_PASS } = process.env;
export function transporterConfig() {
  return {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    // bcc: BCC_EMAIL ,
  };
}
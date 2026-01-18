import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

const sendEmail = async function (to, subject, message) {
    try {
        const info = await transporter.sendMail({
            from: `"Security Alert" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: message,
        });

        console.log('Email sent:', info.messageId);
        console.log('Preview URL (if using ethereal):', nodemailer.getTestMessageUrl(info));
        return true;
    } catch (error) {
        console.error("Email failed:", error);
        return false;
    }
};

export default sendEmail;

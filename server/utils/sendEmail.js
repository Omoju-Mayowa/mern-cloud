import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
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
